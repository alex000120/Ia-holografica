/* ===== photo.js — foto recuerdo al hacer el gesto de corazón ===== */
(function () {
  "use strict";

  const TEXT = {
    thanks1: "¡Gracias por visitar",
    thanks2: "nuestro stand!",
    school1: "CEJA LIDORO QUINTEROS",
    school2: "SUBSEDE N°1 · LOS RALOS"
  };

  const card = () => document.getElementById("photoCard");
  const canvasEl = () => document.getElementById("photoCanvas");
  let lastBlob = null;

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* Arma la imagen final (1080×1350) con la foto de la cámara y el texto. */
  function compose(videoEl, mirror) {
    const W = 1080, H = 1350;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");

    // Fondo holográfico
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0b0620"); bg.addColorStop(0.5, "#1a0b3d"); bg.addColorStop(1, "#021a22");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    [[180, 260, "94,242,255", 520], [920, 1120, "255,79,216", 560]].forEach(([x, y, rgb, r]) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${rgb},0.35)`); rg.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    });

    // Área de la foto
    const px = 80, py = 80, pw = W - 160, ph = 860;
    g.save();
    roundRect(g, px, py, pw, ph, 36);
    g.clip();
    g.fillStyle = "#000"; g.fillRect(px, py, pw, ph);
    const vw = videoEl && videoEl.videoWidth, vh = videoEl && videoEl.videoHeight;
    if (vw && vh) {
      const s = Math.max(pw / vw, ph / vh);
      const dw = vw * s, dh = vh * s;
      const dx = px + (pw - dw) / 2, dy = py + (ph - dh) / 2;
      g.save();
      if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
      g.drawImage(videoEl, mirror ? (W - dx - dw) : dx, dy, dw, dh);
      g.restore();
    }
    g.restore();

    // Marco neón
    g.save();
    roundRect(g, px, py, pw, ph, 36);
    g.lineWidth = 6; g.strokeStyle = "#5ef2ff"; g.shadowColor = "#5ef2ff"; g.shadowBlur = 30; g.stroke();
    g.restore();

    // Corazón decorativo
    drawHeart(g, W - 170, py + 90, 46, "#ff4fd8");

    // Textos
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    const grad = g.createLinearGradient(120, 0, W - 120, 0);
    grad.addColorStop(0, "#5ef2ff"); grad.addColorStop(0.5, "#8b5cff"); grad.addColorStop(1, "#ff4fd8");
    g.font = "700 74px 'Segoe UI', system-ui, Arial, sans-serif";
    g.fillStyle = "#ffffff";
    g.fillText(TEXT.thanks1, W / 2, 1010);
    g.fillStyle = grad;
    g.fillText(TEXT.thanks2, W / 2, 1094);

    g.font = "800 46px 'Segoe UI', system-ui, Arial, sans-serif";
    g.fillStyle = "#5ef2ff";
    g.fillText(TEXT.school1, W / 2, 1168);
    g.font = "600 36px 'Segoe UI', system-ui, Arial, sans-serif";
    g.fillStyle = "rgba(234,246,255,0.85)";
    g.fillText(TEXT.school2, W / 2, 1222);

    g.font = "500 26px 'Segoe UI', system-ui, Arial, sans-serif";
    g.fillStyle = "rgba(142,163,191,0.9)";
    const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    g.fillText(`IA Holográfica · Control por Gestos · ${fecha}`, W / 2, 1290);

    return c;
  }

  function drawHeart(g, cx, cy, s, color) {
    g.save();
    g.beginPath();
    g.moveTo(cx, cy + s * 0.35);
    g.bezierCurveTo(cx - s, cy - s * 0.4, cx - s * 0.5, cy - s * 1.1, cx, cy - s * 0.45);
    g.bezierCurveTo(cx + s * 0.5, cy - s * 1.1, cx + s, cy - s * 0.4, cx, cy + s * 0.35);
    g.closePath();
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 24; g.fill();
    g.restore();
  }

  /* Toma la foto, muestra la tarjeta y deja la imagen lista para guardar. */
  function capture(videoEl, mirror, { flash = true } = {}) {
    const c = compose(videoEl, mirror);
    const out = canvasEl();
    out.width = c.width; out.height = c.height;
    out.getContext("2d").drawImage(c, 0, 0);
    c.toBlob((b) => { lastBlob = b; }, "image/png");
    card().classList.remove("hidden");
    if (flash) {
      const f = document.getElementById("photoFlash");
      f.classList.remove("run"); void f.offsetWidth; f.classList.add("run");
    }
    return out;
  }

  function close() {
    card().classList.add("hidden");
  }

  /* Guarda en galería: primero intenta compartir (Android/iOS), si no, descarga. */
  async function save() {
    const out = canvasEl();
    const blob = lastBlob || await new Promise((r) => out.toBlob(r, "image/png"));
    const name = `recuerdo-ia-holografica-${Date.now()}.png`;
    const file = new File([blob], name, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Recuerdo · Stand IA Holográfica" });
        return "compartido";
      } catch (e) {
        if (e && e.name === "AbortError") return "cancelado";
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "descargado";
  }

  window.Photo = { capture, close, save, compose };
})();
