/* ===== gestures.js — detección de manos y clasificación de gestos ===== */
(function () {
  "use strict";

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* Gestos de UNA mano que disparan acciones (con tiempo de confirmación). */
  const SINGLE_ACTIONS = new Set(["fist", "peace", "call", "thumbUp", "thumbDown", "point", "loveYou"]);

  /* ---------- Análisis geométrico de una mano (21 landmarks) ---------- */
  function analyzeHand(lm) {
    const wrist = lm[0];
    const size = Math.max(0.04, dist(wrist, lm[9]));

    const ext = {
      index:  dist(lm[8], wrist)  > dist(lm[6], wrist)  * 1.15,
      middle: dist(lm[12], wrist) > dist(lm[10], wrist) * 1.15,
      ring:   dist(lm[16], wrist) > dist(lm[14], wrist) * 1.12,
      pinky:  dist(lm[20], wrist) > dist(lm[18], wrist) * 1.12,
      thumb:  dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.12
    };
    const count = [ext.index, ext.middle, ext.ring, ext.pinky].filter(Boolean).length;
    const pinchRatio = dist(lm[4], lm[8]) / size;

    let gesture = null;
    if (count === 0 && ext.thumb) {
      if (lm[4].y < lm[2].y - size * 0.3) gesture = "thumbUp";
      else if (lm[4].y > lm[2].y + size * 0.3) gesture = "thumbDown";
    } else if (count === 0) gesture = "fist";
    else if (count === 4) gesture = "palm";
    else if (ext.index && ext.middle && !ext.ring && !ext.pinky) gesture = "peace";
    else if (ext.thumb && ext.pinky && !ext.index && !ext.middle && !ext.ring) gesture = "call";
    else if (ext.thumb && ext.index && ext.pinky && !ext.middle && !ext.ring) gesture = "loveYou";
    else if (ext.index && !ext.middle && !ext.ring && !ext.pinky && !ext.thumb) gesture = "point";

    return { lm, ext, size, count, pinchRatio, gesture, wrist };
  }

  /* Corazón con dos manos (seña de dedos): las puntas de los índices se juntan arriba
     y los pulgares se acercan abajo. No exige que el pulgar esté "extendido", porque
     en esta seña el pulgar casi siempre queda doblado hacia el índice. */
  function isHeart(A, B) {
    const fingersCurled = (h) => [h.ext.middle, h.ext.ring, h.ext.pinky].filter(Boolean).length <= 1;
    if (!fingersCurled(A) || !fingersCurled(B)) return false;
    // Las dos manos deben tener un tamaño parecido (misma distancia a la cámara)
    const ratio = A.size / B.size;
    if (ratio < 0.5 || ratio > 2) return false;
    const sz = (A.size + B.size) / 2;
    const idxGap = dist(A.lm[8], B.lm[8]) / sz;      // puntas de índice juntas
    const thumbGap = dist(A.lm[4], B.lm[4]) / sz;    // pulgares cerca
    const openA = dist(A.lm[4], A.lm[8]) / A.size;   // índice y pulgar forman la curva
    const openB = dist(B.lm[4], B.lm[8]) / B.size;
    return idxGap < 1.1 && thumbGap < 1.6 && openA > 0.12 && openA < 1.6 && openB > 0.12 && openB < 1.6;
  }

  /* Gesto combinado según las dos manos (o null) */
  function comboNameFor(A, B) {
    if (A.gesture === "fist" && B.gesture === "fist") return "bothFist";
    if (A.gesture === "peace" && B.gesture === "peace") return "bothPeace";
    if (isHeart(A, B)) return "heart";
    return null;
  }

  /* ---------- Estado ---------- */
  const emitter = new EventTarget();
  let cfgGetter = () => ({});
  let hands = null;
  let camVideo = null, miniCanvas = null, miniCtx = null;
  let running = false, busy = false, lastSend = 0;
  let fpsFrames = 0, fpsTime = performance.now(), fps = 0;
  let lastFrame = null;
  let lastCombinedFire = 0, lastSwipeFire = 0;
  let swipeHistory = [];
  let slots = { L: null, R: null };
  let combined = { name: null, since: 0, lastSeen: 0, fired: false };
  const COMBO_TOLERANCE = 220; // ms que un gesto combinado aguanta un parpadeo de detección

  function emit(type, detail) { emitter.dispatchEvent(new CustomEvent(type, { detail })); }

  function newSlot(label) {
    return { label, pinching: false, cand: null, since: 0, fired: false,
             cur: null, seen: 0, analysis: null, pinchStartAt: 0 };
  }

  /* Convierte coordenadas de cámara a [0..1] de la pantalla, con margen de alcance. */
  function toScreen(p, mirror) {
    const u = mirror ? 1 - p.x : p.x;
    return { x: clamp((u - 0.08) / 0.84, 0, 1), y: clamp((p.y - 0.08) / 0.84, 0, 1) };
  }

  function updateSingle(slot, name, now, cfg) {
    if (name !== slot.cand) { slot.cand = name; slot.since = now; slot.fired = false; }
    if (!name || slot.fired || !SINGLE_ACTIONS.has(name)) return;
    const need = name === "point" ? cfg.holdMs * 2 : cfg.holdMs;
    // "fist" de una sola mano (silenciar) sólo cuando no hay otra mano; "dos puños" es otra acción.
    const visibleHands = (slots.L ? 1 : 0) + (slots.R ? 1 : 0);
    if (name === "fist" && visibleHands > 1) return;
    if (now - lastCombinedFire < 1100) return;
    if (now - slot.since >= need) {
      slot.fired = true;
      emit("gesture", { name, scope: "one", hand: slot.label });
    }
  }

  function isComboActive(now) {
    return !!combined.name && now - combined.lastSeen < COMBO_TOLERANCE;
  }

  function comboProgress(now, cfg) {
    if (!isComboActive(now)) return 0;
    return Math.min(1, (now - combined.since) / Math.max(1, cfg.holdMs));
  }

  function updateCombined(name, now, cfg) {
    if (name) {
      if (name !== combined.name) combined = { name, since: now, lastSeen: now, fired: false };
      else combined.lastSeen = now;
    } else {
      // Sin gesto: sólo se olvida tras un rato, para no perder el conteo por un parpadeo
      if (combined.name && now - combined.lastSeen < COMBO_TOLERANCE) return;
      combined = { name: null, since: now, lastSeen: now, fired: false };
      return;
    }
    if (combined.fired) return;
    if (now - combined.since >= cfg.holdMs) {
      combined.fired = true;
      lastCombinedFire = now;
      emit("gesture", { name, scope: "two" });
    }
  }

  function detectSwipe(now, cfg, bothPalm, centroidX) {
    if (!bothPalm) { swipeHistory = []; return; }
    swipeHistory.push({ t: now, x: centroidX });
    swipeHistory = swipeHistory.filter((s) => now - s.t < 480);
    if (swipeHistory.length < 4 || now - lastSwipeFire < 900) return;
    const dx = swipeHistory[swipeHistory.length - 1].x - swipeHistory[0].x;
    if (Math.abs(dx) > 0.2) {
      // En modo espejo, mover la mano a la derecha reduce x en la imagen cruda.
      const screenDx = cfg.mirror ? -dx : dx;
      lastSwipeFire = now;
      swipeHistory = [];
      emit("swipe", { dir: screenDx > 0 ? "right" : "left" });
    }
  }

  /* ---------- Procesar resultados de MediaPipe ---------- */
  function onResults(results) {
    const cfg = cfgGetter();
    const now = performance.now();

    fpsFrames++;
    if (now - fpsTime >= 1000) { fps = Math.round((fpsFrames * 1000) / (now - fpsTime)); fpsFrames = 0; fpsTime = now; }

    const list = results.multiHandLandmarks || [];
    const info = results.multiHandedness || [];

    // Asignar cada mano a un slot estable (L / R) según su etiqueta
    const present = { L: null, R: null };
    list.forEach((lm, i) => {
      const label = info[i] && info[i].label === "Left" ? "L" : "R";
      const key = present[label] ? (label === "L" ? "R" : "L") : label;
      present[key] = analyzeHand(lm);
    });

    ["L", "R"].forEach((k) => {
      if (!present[k]) { slots[k] = null; return; }
      if (!slots[k]) slots[k] = newSlot(k);
      slots[k].analysis = present[k];
      slots[k].seen = now;
    });

    // Si hay un gesto de dos manos (o uno en curso), los gestos de una mano se ignoran
    // para que el corazón no active "ajustes" ni haga clic con el pellizco.
    const A = present.L, B = present.R;
    const comboNow = A && B ? comboNameFor(A, B) : null;
    const suppress = !!comboNow || isComboActive(now);

    const out = [];
    ["L", "R"].forEach((k) => {
      const s = slots[k];
      if (!s || !s.analysis) return;
      const a = s.analysis;

      // Pellizco con histéresis para evitar parpadeos
      const T = cfg.pinchThreshold * 5;
      const wasPinching = s.pinching;
      s.pinching = !suppress && (wasPinching ? a.pinchRatio < T * 1.35 : a.pinchRatio < T);
      const pinchStart = s.pinching && !wasPinching;
      const pinchEnd = !s.pinching && wasPinching;

      // Cursor suavizado (dedo índice)
      const target = toScreen(a.lm[8], cfg.mirror);
      if (!s.cur) s.cur = target;
      const alpha = clamp(1 - cfg.smoothing, 0.1, 1);
      s.cur = { x: lerp(s.cur.x, target.x, alpha), y: lerp(s.cur.y, target.y, alpha) };

      const gesture = s.pinching ? "pinch" : a.gesture;
      updateSingle(s, s.pinching || suppress ? null : a.gesture, now, cfg);

      out.push({
        id: k, label: k === "L" ? "Izquierda" : "Derecha", lm: a.lm, ext: a.ext,
        cursor: s.cur, gesture, pinching: s.pinching, pinchStart, pinchEnd,
        palmCenter: a.lm[9], count: a.count
      });
    });

    // Gestos combinados (dos manos)
    updateCombined(comboNow, now, cfg);
    if (A && B) {
      const bothPalm = A.gesture === "palm" && B.gesture === "palm";
      detectSwipe(now, cfg, bothPalm, (A.lm[9].x + B.lm[9].x) / 2);
    } else {
      swipeHistory = [];
    }

    // Pulsos de pellizco para la emisión de eventos
    out.forEach((h) => { if (h.pinchStart) emit("pinch", { hand: h.id, state: "down", cursor: h.cursor }); });
    out.forEach((h) => { if (h.pinchEnd) emit("pinch", { hand: h.id, state: "up", cursor: h.cursor }); });

    const activeName = isComboActive(now) ? combined.name : null;
    lastFrame = {
      hands: out, fps, count: out.length, t: now,
      combined: { name: activeName, progress: comboProgress(now, cfg) }
    };
    emit("frame", lastFrame);
    drawMini(results, out, cfg);
  }

  /* ---------- Mini cámara de diagnóstico ---------- */
  const CONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

  function drawMini(results, out, cfg) {
    if (!miniCanvas || !results.image) return;
    const w = results.image.width || 640, h = results.image.height || 480;
    if (miniCanvas.width !== w || miniCanvas.height !== h) { miniCanvas.width = w; miniCanvas.height = h; }
    miniCtx.save();
    miniCtx.drawImage(results.image, 0, 0, w, h);
    miniCtx.fillStyle = "rgba(6,7,13,0.25)";
    miniCtx.fillRect(0, 0, w, h);
    out.forEach((hd) => {
      const color = hd.id === "L" ? "#5ef2ff" : "#ff4fd8";
      miniCtx.strokeStyle = color; miniCtx.lineWidth = 2.2; miniCtx.shadowColor = color; miniCtx.shadowBlur = 8;
      CONN.forEach(([a, b]) => {
        miniCtx.beginPath();
        miniCtx.moveTo(hd.lm[a].x * w, hd.lm[a].y * h);
        miniCtx.lineTo(hd.lm[b].x * w, hd.lm[b].y * h);
        miniCtx.stroke();
      });
      hd.lm.forEach((p) => {
        miniCtx.beginPath(); miniCtx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
        miniCtx.fillStyle = "#fff"; miniCtx.fill();
      });
      const tag = hd.pinching ? "pellizco" : (hd.gesture || "sin gesto");
      miniCtx.shadowBlur = 0;
      miniCtx.font = `600 ${Math.round(h * 0.06)}px system-ui, sans-serif`;
      miniCtx.fillStyle = color;
      miniCtx.fillText(`${hd.label}: ${tag}`, hd.lm[0].x * w, hd.lm[0].y * h - 10);
    });
    // Banner del gesto de dos manos y su progreso (para diagnosticar el corazón)
    if (lastFrame && lastFrame.combined && lastFrame.combined.name) {
      const c = lastFrame.combined;
      const names = { heart: "❤ Corazón", bothFist: "✊✊ Dos puños", bothPeace: "✌✌ Dos paz" };
      const pct = Math.round(c.progress * 100);
      miniCtx.font = `700 ${Math.round(h * 0.07)}px system-ui, sans-serif`;
      miniCtx.fillStyle = "#ffd23d";
      miniCtx.fillText(`${names[c.name] || c.name} ${pct}%`, 12, Math.round(h * 0.09));
    }
    miniCtx.restore();
  }

  /* ---------- Bucle de procesamiento ---------- */
  async function loop(ts) {
    if (!running) return;
    const cfg = cfgGetter();
    const minInterval = 1000 / (cfg.processFps || 24);
    if (!busy && camVideo.readyState >= 2 && ts - lastSend >= minInterval) {
      busy = true; lastSend = ts;
      try { await hands.send({ image: camVideo }); }
      catch (e) { console.warn("Frame omitido:", e); }
      finally { busy = false; }
    }
    requestAnimationFrame(loop);
  }

  function createHands(cfg) {
    if (!window.Hands) throw new Error("MediaPipe no cargó (revisa tu conexión a internet).");
    const h = new window.Hands({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`
    });
    h.setOptions({
      maxNumHands: 2,
      modelComplexity: cfg.modelComplexity,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.4,
      selfieMode: false
    });
    h.onResults(onResults);
    return h;
  }

  async function start(video, miniCv, getCfg) {
    cfgGetter = getCfg;
    camVideo = video;
    miniCanvas = miniCv;
    miniCtx = miniCv.getContext("2d");
    const cfg = getCfg();
    const [w, h] = [cfg.width, cfg.height];

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: w }, height: { ideal: h }, facingMode: "user", frameRate: { ideal: 30, max: 30 } }
    });
    camVideo.srcObject = stream;
    await camVideo.play();

    hands = createHands(cfg);
    running = true;
    requestAnimationFrame(loop);
    return stream;
  }

  function reconfigure(cfg) {
    if (!hands) return;
    hands.setOptions({ modelComplexity: cfg.modelComplexity });
  }

  function stop() {
    running = false;
    if (camVideo && camVideo.srcObject) camVideo.srcObject.getTracks().forEach((t) => t.stop());
  }

  window.Gestures = {
    start, stop, reconfigure,
    on(type, fn) { emitter.addEventListener(type, (e) => fn(e.detail)); },
    get lastFrame() { return lastFrame; },
    get fps() { return fps; },
    toScreen,
    analyzeHand
  };
})();
