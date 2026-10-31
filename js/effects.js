/* ===== effects.js — manos dibujadas en pantalla, partículas y transiciones ===== */
(function () {
  "use strict";

  const CONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
  const TIPS = [4, 8, 12, 16, 20];
  const COLORS = { L: "#5ef2ff", R: "#ff4fd8" };

  let canvas, ctx, W = 0, H = 0, dpr = 1;
  let particles = [];
  let rafId = 0;
  let lowPerf = false;
  let transitionStyles = ["iris", "wipe", "glitch", "flash"];
  let lastTransition = -1;

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function configure(cfg) {
    lowPerf = !!cfg.perfLow;
    dpr = Math.min(window.devicePixelRatio || 1, lowPerf ? 1 : 2);
    if (canvas) resize();
  }

  function init(layer) {
    canvas = document.createElement("canvas");
    layer.appendChild(canvas);
    ctx = canvas.getContext("2d");
    window.addEventListener("resize", resize);
    resize();
  }

  /* Dibuja manos con el mismo margen que el cursor, y las desplaza para que el índice coincida con él. */
  function drawHands(hands, cfg, toScreen) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (cfg.showSkeleton && hands.length) {
      hands.forEach((h) => {
        const tipRaw = toScreen(h.lm[8], cfg.mirror);
        const offX = h.cursor.x - tipRaw.x;
        const offY = h.cursor.y - tipRaw.y;
        const pt = (p) => {
          const s = toScreen(p, cfg.mirror);
          return { x: (s.x + offX) * W, y: (s.y + offY) * H };
        };
        const pts = h.lm.map(pt);
        const color = COLORS[h.id];

        ctx.lineCap = "round";
        ctx.strokeStyle = color;
        ctx.lineWidth = lowPerf ? 2 : 3;
        if (!lowPerf) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
        ctx.globalAlpha = 0.85;
        CONN.forEach(([a, b]) => {
          ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
        });

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        pts.forEach((p, i) => {
          const tip = TIPS.includes(i);
          ctx.beginPath();
          ctx.arc(p.x, p.y, tip ? 6 : 3.2, 0, Math.PI * 2);
          ctx.fillStyle = tip ? "#ffffff" : color;
          ctx.fill();
        });

        // Halo en la palma
        const c = pts[9];
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(18, Math.hypot(pts[0].x - pts[9].x, pts[0].y - pts[9].y) * 0.7), 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.globalAlpha = 0.25; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = 1;

        // Pellizco: anillo que se cierra
        if (h.pinching) {
          const t = pts[8], th = pts[4];
          ctx.beginPath(); ctx.arc((t.x + th.x) / 2, (t.y + th.y) / 2, 22, 0, Math.PI * 2);
          ctx.strokeStyle = "#ff4fd8"; ctx.lineWidth = 3; ctx.stroke();
        }
      });
    }
    drawParticles();
  }

  /* ---------- Partículas ---------- */
  function burst(x, y, color = "#5ef2ff", count = 22) {
    const n = lowPerf ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 2 + Math.random() * (lowPerf ? 3 : 6);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color, r: 1.5 + Math.random() * 2.5 });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
    if (!rafId) rafId = requestAnimationFrame(animateParticles);
  }

  function drawParticles() {
    if (!particles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function animateParticles() {
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life -= 0.035;
    });
    particles = particles.filter((p) => p.life > 0);
    if (particles.length) rafId = requestAnimationFrame(animateParticles);
    else rafId = 0;
  }

  /* ---------- Transiciones entre videos ---------- */
  function transition(style) {
    const el = document.getElementById("transitionOverlay");
    const styles = style ? [style] : transitionStyles;
    let pick = styles[Math.floor(Math.random() * styles.length)];
    if (styles.length > 1 && pick === transitionStyles[lastTransition]) pick = styles[(styles.indexOf(pick) + 1) % styles.length];
    lastTransition = transitionStyles.indexOf(pick);
    el.className = "transition-overlay " + (pick === "flash" ? "" : pick);
    void el.offsetWidth;
    el.classList.add("run");
    setTimeout(() => el.classList.remove("run"), 1000);
    return pick;
  }

  function setTransitionStyles(list) {
    transitionStyles = list && list.length ? list : ["iris", "wipe", "glitch", "flash"];
  }

  window.Effects = { init, configure, drawHands, burst, transition, setTransitionStyles, resize };
})();
