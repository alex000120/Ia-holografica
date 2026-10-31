/* ===== settings.js — configuración por dispositivo ===== */
(function () {
  "use strict";

  const PRESETS = {
    high:     { resolution: "1280x720", model: "full", effects: true,  processFps: 30, perfLow: false },
    balanced: { resolution: "960x540",  model: "lite", effects: true,  processFps: 24, perfLow: false },
    low:      { resolution: "640x480",  model: "lite", effects: false, processFps: 15, perfLow: true  }
  };

  const DEFAULTS = {
    profile: "auto",
    resolution: "960x540",
    model: "lite",
    pinchThreshold: 0.06,
    smoothing: 0.35,
    holdMs: 450,
    mirror: true,
    showCam: true,
    showSkeleton: true,
    effects: true
  };

  /** Detecta el tipo de dispositivo y recomienda un perfil. */
  function detectDevice() {
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    const isTablet = /iPad|Tablet/i.test(ua) || (isMobile && Math.min(window.innerWidth, window.innerHeight) >= 600);
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    let recommended = "high";
    if (isMobile && !isTablet) recommended = (mem <= 3 || cores <= 4) ? "low" : "balanced";
    else if (isTablet) recommended = (mem <= 3 || cores <= 4) ? "balanced" : "high";
    else if (cores <= 4 || mem <= 4) recommended = "balanced";
    const kind = isTablet ? "tablet" : isMobile ? "movil" : "escritorio";
    return { kind, recommended, cores, mem };
  }

  const device = detectDevice();
  const STORAGE_KEY = "iaholo-cfg-v1-" + device.kind;

  let state = Object.assign({}, DEFAULTS);
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (_) { /* almacenamiento no disponible */ }
    if (state.profile === "auto") state.profile = device.recommended;
    if (!PRESETS[state.profile] && state.profile !== "custom") state.profile = device.recommended;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function emit() {
    listeners.forEach((fn) => { try { fn(get()); } catch (e) { console.error(e); } });
    document.body.classList.toggle("perf-low", !!(PRESETS[state.profile] && PRESETS[state.profile].perfLow));
  }

  function get() {
    const preset = PRESETS[state.profile] || {};
    const [w, h] = state.resolution.split("x").map(Number);
    return Object.assign({}, state, {
      width: w, height: h,
      modelComplexity: state.model === "full" ? 1 : 0,
      processFps: preset.processFps || 24,
      perfLow: !!preset.perfLow,
      deviceKind: device.kind
    });
  }

  function set(patch, { silent = false } = {}) {
    state = Object.assign({}, state, patch);
    save();
    if (!silent) emit();
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    set({ profile: name, resolution: p.resolution, model: p.model, effects: p.effects }, { silent: true });
    syncUI();
    emit();
  }

  /* ----- Enlace con la interfaz ----- */
  const $ = (id) => document.getElementById(id);

  function syncUI() {
    const s = state;
    $("cfgProfile").value = s.profile;
    $("cfgResolution").value = s.resolution;
    $("cfgModel").value = s.model;
    $("cfgPinch").value = s.pinchThreshold;
    $("cfgSmooth").value = s.smoothing;
    $("cfgHold").value = s.holdMs;
    $("cfgMirror").checked = s.mirror;
    $("cfgShowCam").checked = s.showCam;
    $("cfgShowSkeleton").checked = s.showSkeleton;
    $("cfgEffects").checked = s.effects;
    $("outPinch").textContent = Number(s.pinchThreshold).toFixed(3);
    $("outSmooth").textContent = Number(s.smoothing).toFixed(2);
    $("outHold").textContent = s.holdMs;
  }

  function bindUI() {
    const sel = (id, key, transform = (v) => v) => $(id).addEventListener("change", (e) => {
      set({ [key]: transform(e.target.value) });
      syncUI();
    });

    $("cfgProfile").addEventListener("change", (e) => {
      if (e.target.value === "auto") { applyPreset(device.recommended); return; }
      applyPreset(e.target.value);
    });
    sel("cfgResolution", "resolution");
    sel("cfgModel", "model");

    const range = (id, key, transform) => $(id).addEventListener("input", (e) => {
      const v = transform(e.target.value);
      set({ [key]: v }, { silent: false });
      syncUI();
    });
    range("cfgPinch", "pinchThreshold", parseFloat);
    range("cfgSmooth", "smoothing", parseFloat);
    range("cfgHold", "holdMs", (v) => parseInt(v, 10));

    const check = (id, key) => $(id).addEventListener("change", (e) => set({ [key]: e.target.checked }));
    check("cfgMirror", "mirror");
    check("cfgShowCam", "showCam");
    check("cfgShowSkeleton", "showSkeleton");
    check("cfgEffects", "effects");

    $("resetCfgBtn").addEventListener("click", () => {
      state = Object.assign({}, DEFAULTS, { profile: device.recommended });
      applyPreset(device.recommended);
      set(Object.assign({}, state), { silent: true });
      syncUI();
      emit();
    });
  }

  /* ----- API pública ----- */
  window.AppSettings = {
    device,
    presets: PRESETS,
    load,
    get,
    set,
    applyPreset,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    init() {
      load();
      syncUI();
      bindUI();
      emit();
    },
    syncUI
  };
})();
