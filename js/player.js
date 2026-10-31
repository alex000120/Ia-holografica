/* ===== player.js — reproductor de 5 videos a pantalla completa ===== */
(function () {
  "use strict";

  /* Edita aquí los nombres que se muestran. Los archivos van en /videos */
  const PLAYLIST = [
    { src: "videos/video1.mp4", title: "Video 1 · IA Holográfica" },
    { src: "videos/video2.mp4", title: "Video 2 · IA Holográfica" },
    { src: "videos/video3.mp4", title: "Video 3 · IA Holográfica" },
    { src: "videos/video4.mp4", title: "Video 4 · IA Holográfica" },
    { src: "videos/video5.mp4", title: "Video 5 · IA Holográfica" }
  ];

  let video, titleEl, emptyEl, stageEl, overlayEl;
  let index = 0;
  let titleTimer = 0;
  let lastVolumeBeforeMute = 1;
  let loading = false;

  function showTitle() {
    titleEl.textContent = PLAYLIST[index].title;
    titleEl.classList.add("show");
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => titleEl.classList.remove("show"), 2600);
  }

  function load(i, { animate = true } = {}) {
    index = (i + PLAYLIST.length) % PLAYLIST.length;
    loading = true;
    emptyEl.classList.add("hidden");
    video.src = PLAYLIST[index].src;
    video.load();
    showTitle();
    if (animate && window.Effects) {
      video.style.opacity = "0";
      window.Effects.transition();
      setTimeout(() => { video.style.opacity = "1"; }, 380);
    }
    video.play().catch(() => { /* el navegador puede requerir un gesto previo */ });
  }

  function next() { load(index + 1); }
  function prev() { load(index - 1); }

  function togglePlay() {
    if (video.paused) video.play().catch(() => {}); else video.pause();
    flashIcon(video.paused ? "⏸" : "▶");
  }

  function seek(delta) {
    if (!isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + delta));
    flashIcon(delta > 0 ? "⏩ +10s" : "⏪ −10s");
  }

  function changeVolume(delta) {
    video.muted = false;
    video.volume = Math.min(1, Math.max(0, video.volume + delta));
    flashIcon(`🔊 ${Math.round(video.volume * 100)}%`);
  }

  function toggleMute() {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      video.volume = lastVolumeBeforeMute || 1;
      flashIcon(`🔊 ${Math.round(video.volume * 100)}%`);
    } else {
      lastVolumeBeforeMute = video.volume;
      video.muted = true;
      flashIcon("🔇 Silencio");
    }
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
      flashIcon("⛶ Pantalla completa");
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
      flashIcon("⤢ Ventana");
    }
  }

  /* Pequeño icono de confirmación en pantalla */
  let iconTimer = 0;
  function flashIcon(text) {
    let el = document.getElementById("actionIcon");
    if (!el) {
      el = document.createElement("div");
      el.id = "actionIcon";
      el.className = "video-title";
      el.style.cssText = "top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.4rem;padding:12px 26px;z-index:12;";
      stageEl.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(iconTimer);
    iconTimer = setTimeout(() => el.classList.remove("show"), 900);
  }

  function init(opts) {
    video = opts.video; titleEl = opts.title; emptyEl = opts.empty; stageEl = opts.stage;
    overlayEl = opts.overlay;

    video.addEventListener("ended", () => next());
    video.addEventListener("playing", () => { loading = false; });
    video.addEventListener("error", () => {
      if (!video.getAttribute("src")) return;
      emptyEl.querySelector("p").textContent = `No se encontró "${PLAYLIST[index].src.split("/").pop()}"`;
      emptyEl.classList.remove("hidden");
      loading = false;
    });
    video.volume = 0.9;
  }

  window.Player = {
    init, load, next, prev, togglePlay, seek, changeVolume, toggleMute, toggleFullscreen,
    get index() { return index; },
    get count() { return PLAYLIST.length; },
    get playing() { return !video.paused; },
    get titles() { return PLAYLIST.map((p) => p.title); },
    get loading() { return loading; },
    get video() { return video; },
    flashIcon
  };
})();
