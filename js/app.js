/* ===== app.js — orquesta cámara, gestos, cursor, reproductor y configuración ===== */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    splash: $("splash"), startBtn: $("startBtn"), stage: $("stage"), video: $("player"),
    title: $("videoTitle"), empty: $("emptyState"), overlay: $("transitionOverlay"),
    cursor: $("cursor"), handsLayer: $("handsLayer"), toast: $("gestureToast"),
    miniCam: $("miniCam"), camVideo: $("camVideo"), camCanvas: $("camCanvas"),
    dot: $("statusDot"), statusText: $("statusText"), fpsText: $("fpsText"),
    handsText: $("handsText"), settingsBtn: $("settingsBtn"), panel: $("settingsPanel"),
    closeSettings: $("closeSettingsBtn"), savePhoto: $("savePhotoBtn"),
    closePhoto: $("closePhotoBtn"), photoCard: $("photoCard"), hint: document.querySelector(".splash-hint")
  };

  const LABEL = {
    fist: "✊ Silencio / sonido", peace: "✌ Adelantar 10 s", call: "🤙 Retroceder 10 s",
    thumbUp: "👍 Volumen +", thumbDown: "👎 Volumen −", point: "☝ Ajustes",
    loveYou: "🤟 Pantalla completa", bothFist: "✊✊ Reproducir / Pausa",
    bothPeace: "✌✌ Efectos visuales", heart: "❤ ¡Foto recuerdo!",
    swipeRight: "👉 Siguiente video", swipeLeft: "👈 Video anterior"
  };

  /* ---------- Mapa gesto → acción (un gesto, una función) ---------- */
  const ACTIONS = {
    one: {
      point: () => togglePanel(),
      peace: () => Player.seek(10),
      call: () => Player.seek(-10),
      thumbUp: () => Player.changeVolume(0.1),
      thumbDown: () => Player.changeVolume(-0.1),
      loveYou: () => Player.toggleFullscreen(),
      fist: () => Player.toggleMute()
    },
    two: {
      bothFist: () => Player.togglePlay(),
      bothPeace: () => {
        const on = !AppSettings.get().effects;
        AppSettings.set({ effects: on });
        AppSettings.syncUI();
        Player.flashIcon(on ? "✨ Efectos activados" : "Efectos desactivados");
      },
      heart: () => {
        Effects.burst(innerWidth / 2, innerHeight / 2, "#ff4fd8", 60);
        Photo.capture(els.camVideo, AppSettings.get().mirror);
      },
      swipeRight: () => { Player.next(); },
      swipeLeft: () => { Player.prev(); }
    }
  };

  /* ---------- Mostrar / ocultar elementos ---------- */
  function togglePanel(force) {
    const open = force !== undefined ? force : els.panel.classList.contains("hidden");
    els.panel.classList.toggle("hidden", !open);
  }

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove("show"), 1400);
  }

  function setStatus(kind, text) {
    els.dot.className = "dot " + kind;
    els.statusText.textContent = text;
  }

  /* ---------- Cursor y clics con pellizco ---------- */
  const pointer = { x: 0, y: 0, down: false, kind: null, target: null, hovered: null };

  function pickPrimary(hands) {
    return hands.find((h) => h.id === "R" && h.ext.index) || hands.find((h) => h.ext.index) || hands[0] || null;
  }

  function updateHover() {
    const el = document.elementFromPoint(pointer.x, pointer.y);
    const target = el && el.closest("button, input, select, summary, label, .btn-primary, .btn-ghost");
    if (pointer.hovered && pointer.hovered !== target) pointer.hovered.classList.remove("hover-el");
    if (target && !target.disabled) target.classList.add("hover-el");
    pointer.hovered = target;
  }

  function dragRange(el) {
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (pointer.x - r.left) / r.width));
    const min = +el.min, max = +el.max, step = +el.step || 1;
    let v = min + t * (max - min);
    v = Math.round((v - min) / step) * step + min;
    if (String(el.value) !== String(v)) {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function pointerDown() {
    const el = document.elementFromPoint(pointer.x, pointer.y);
    pointer.down = true;
    pointer.target = null;
    if (!el) { pointer.kind = "none"; return; }
    const range = el.closest('input[type="range"]');
    const select = el.closest("select");
    const click = el.closest("button, summary, label, input[type='checkbox']");
    if (range) { pointer.kind = "range"; pointer.target = range; dragRange(range); }
    else if (select) {
      // Un pellizco sobre un menú desplegable pasa a la siguiente opción
      pointer.kind = "select";
      const n = select.options.length;
      select.selectedIndex = (select.selectedIndex + 1) % n;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      showToast(`Opción: ${select.options[select.selectedIndex].text}`);
    }
    else if (click) { pointer.kind = "click"; pointer.target = click; }
    else if (els.stage.contains(el)) { pointer.kind = "stage"; }
    else pointer.kind = "none";
    Effects.burst(pointer.x, pointer.y, "#5ef2ff", 14);
  }

  function pointerUp() {
    if (!pointer.down) return;
    pointer.down = false;
    if (pointer.kind === "click" && pointer.target) {
      const now = document.elementFromPoint(pointer.x, pointer.y);
      if (now && pointer.target.contains(now)) pointer.target.click();
    } else if (pointer.kind === "stage") {
      Player.togglePlay();
    }
    pointer.kind = null;
    pointer.target = null;
  }

  function updatePointer(frame) {
    const primary = pickPrimary(frame.hands);
    if (!primary) {
      els.cursor.classList.add("hidden");
      if (pointer.hovered) { pointer.hovered.classList.remove("hover-el"); pointer.hovered = null; }
      // Si se pierde la mano a mitad de un pellizco, se cancela sin ejecutar nada
      pointer.down = false; pointer.kind = null; pointer.target = null;
      return;
    }
    const W = innerWidth, H = innerHeight;
    pointer.x = primary.cursor.x * W;
    pointer.y = primary.cursor.y * H;
    els.cursor.classList.remove("hidden");
    els.cursor.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
    const anyPinch = frame.hands.some((h) => h.pinching);
    els.cursor.classList.toggle("pinch", anyPinch);
    els.cursor.classList.toggle("hover", !!pointer.hovered);
    updateHover();

    if (frame.hands.some((h) => h.pinchStart)) pointerDown();
    if (frame.hands.some((h) => h.pinchEnd)) pointerUp();
    if (pointer.down && pointer.kind === "range" && pointer.target) dragRange(pointer.target);
  }

  /* ---------- Frames de la cámara ---------- */
  let lastStatusAt = 0;
  let lastSeenHand = 0;

  function onFrame(frame) {
    const cfg = AppSettings.get();
    if (els.stage.classList.contains("hidden") === false) {
      Effects.drawHands(frame.hands, cfg, Gestures.toScreen);
    }
    updatePointer(frame);

    const now = performance.now();
    if (frame.count > 0) lastSeenHand = now;

    // Progreso de un gesto de dos manos (corazón, dos puños…): se actualiza en cada frame
    const c = frame.combined;
    if (c && c.name) {
      const txt = { heart: "❤ Mantén el corazón", bothFist: "✊✊ Mantén los puños", bothPeace: "✌✌ Mantén la paz" };
      setStatus("ok", `${txt[c.name] || c.name} · ${Math.round(c.progress * 100)}%`);
      lastStatusAt = now;
      return;
    }

    if (now - lastStatusAt > 400) {
      lastStatusAt = now;
      els.handsText.textContent = `${frame.count} ${frame.count === 1 ? "mano" : "manos"}`;
      els.fpsText.textContent = `${Gestures.fps} fps`;
      if (frame.count === 0) setStatus("err", now - lastSeenHand > 1500 ? "Muestra tus manos a la cámara" : "Buscando…");
      else if (frame.hands.some((h) => h.gesture)) setStatus("ok", "Gesto detectado");
      else setStatus("warn", "Manos detectadas · sin gesto");
    }
  }

  /* ---------- Gestos ---------- */
  function onGesture(g) {
    const map = g.scope === "two" ? ACTIONS.two : ACTIONS.one;
    const fn = map[g.name];
    if (!fn) return;
    fn();
    if (LABEL[g.name]) showToast(LABEL[g.name]);
    if (g.name !== "heart") Effects.burst(innerWidth / 2, innerHeight / 2, "#8b5cff", 10);
  }

  function onSwipe(s) {
    const name = s.dir === "right" ? "swipeRight" : "swipeLeft";
    ACTIONS.two[name]();   // Player.load() ya dispara la transición
    showToast(LABEL[name]);
  }

  /* ---------- Ajustes en vivo ---------- */
  function applyCfg(cfg) {
    els.miniCam.classList.toggle("hidden", !cfg.showCam);
    els.miniCam.classList.toggle("mirror-off", !cfg.mirror);
    els.camCanvas.style.transform = cfg.mirror ? "scaleX(-1)" : "none";
    Gestures.reconfigure(cfg);
    Effects.configure(cfg);
  }

  /* ---------- Teclado (respaldo) ---------- */
  function onKey(e) {
    if (els.stage.classList.contains("hidden")) return;
    const k = e.key;
    if (k === " ") { e.preventDefault(); Player.togglePlay(); }
    else if (k === "ArrowRight") Player.next();
    else if (k === "ArrowLeft") Player.prev();
    else if (k === "ArrowUp") Player.changeVolume(0.1);
    else if (k === "ArrowDown") Player.changeVolume(-0.1);
    else if (k === "m" || k === "M") Player.toggleMute();
    else if (k === "f" || k === "F") Player.toggleFullscreen();
    else if (k === "s" || k === "S") togglePanel();
    else if (k === "p" || k === "P") ACTIONS.two.heart();
    else if (k === "Escape") togglePanel(false);
  }

  /* ---------- Arranque ---------- */
  async function start() {
    els.startBtn.disabled = true;
    els.startBtn.textContent = "Conectando…";
    try {
      document.body.appendChild(els.cursor);
      els.stage.classList.remove("hidden");
      els.miniCam.classList.remove("hidden");
      els.settingsBtn.classList.remove("hidden");

      Effects.init(els.handsLayer);
      Effects.configure(AppSettings.get());
      Player.init({ video: els.video, title: els.title, empty: els.empty, stage: els.stage, overlay: els.overlay });
      Player.load(0, { animate: false });

      await Gestures.start(els.camVideo, els.camCanvas, AppSettings.get);
      applyCfg(AppSettings.get());

      els.splash.classList.add("fade-out");
      setTimeout(() => els.splash.classList.add("hidden"), 650);
      setStatus("warn", "Buscando manos…");
    } catch (err) {
      console.error(err);
      els.startBtn.disabled = false;
      els.startBtn.textContent = "Reintentar";
      els.stage.classList.add("hidden");
      els.miniCam.classList.add("hidden");
      els.settingsBtn.classList.add("hidden");
      els.hint.textContent = (err && err.name === "NotAllowedError")
        ? "Permiso de cámara denegado. Actívalo en el navegador y vuelve a intentar."
        : "No se pudo iniciar: " + (err && err.message ? err.message : "error desconocido");
    }
  }

  function init() {
    AppSettings.init();
    AppSettings.onChange(applyCfg);

    Gestures.on("frame", onFrame);
    Gestures.on("gesture", onGesture);
    Gestures.on("swipe", onSwipe);

    els.startBtn.addEventListener("click", start);
    els.settingsBtn.addEventListener("click", () => togglePanel());
    els.closeSettings.addEventListener("click", () => togglePanel(false));
    els.savePhoto.addEventListener("click", async () => {
      const r = await Photo.save();
      showToast(r === "descargado" ? "Foto guardada" : r === "compartido" ? "Foto compartida" : "Listo");
    });
    els.closePhoto.addEventListener("click", () => Photo.close());
    document.addEventListener("keydown", onKey);
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
})();
