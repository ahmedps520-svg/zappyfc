/* ZAPPY FC — animated neon pitch-grid background */
(function () {
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GREEN = "57,255,122";
  let w = 0, h = 0, dpr = 1, particles = [], streaks = [], last = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(70, (w * h) / 22000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.6 + 0.4, vy: -(Math.random() * 0.25 + 0.05),
      vx: (Math.random() - 0.5) * 0.1, a: Math.random() * 0.6 + 0.2,
    }));
    if (reduce) draw(0);
  }

  function spawnStreak() {
    streaks.push({ y: Math.random() * h * 0.5, x: -200, len: 120 + Math.random() * 260, v: 6 + Math.random() * 8, a: 0.5 + Math.random() * 0.4 });
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    const horizon = h * 0.58;
    const cx = w / 2;

    // horizon glow
    const g = ctx.createLinearGradient(0, horizon - 140, 0, horizon + 40);
    g.addColorStop(0, `rgba(${GREEN},0)`);
    g.addColorStop(1, `rgba(${GREEN},0.10)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon - 140, w, 180);

    // converging grid lines
    ctx.lineWidth = 1;
    const cols = 22;
    for (let i = -cols; i <= cols; i++) {
      const xb = cx + i * (w / cols) * 1.6;
      const xt = cx + i * 18;
      const alpha = 0.22 - Math.abs(i) / cols * 0.16;
      ctx.strokeStyle = `rgba(${GREEN},${alpha.toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(xt, horizon); ctx.lineTo(xb, h); ctx.stroke();
    }

    // horizontal lines rushing towards the viewer
    const rows = 16;
    const shift = reduce ? 0 : (t / 2600) % 1;
    for (let k = 0; k < rows; k++) {
      const z = (k + shift) / rows;
      const y = horizon + (h - horizon) * Math.pow(z, 2.4);
      ctx.strokeStyle = `rgba(${GREEN},${(0.05 + z * 0.3).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // horizon line
    ctx.strokeStyle = `rgba(${GREEN},0.55)`;
    ctx.shadowColor = `rgba(${GREEN},0.9)`; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(w, horizon); ctx.stroke();
    ctx.shadowBlur = 0;

    // floating particles
    for (const p of particles) {
      if (!reduce) {
        p.y += p.vy; p.x += p.vx;
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      }
      ctx.fillStyle = `rgba(${GREEN},${p.a})`;
      ctx.fillRect(p.x, p.y, p.r, p.r);
    }

    // light streaks
    if (!reduce) {
      if (Math.random() < 0.012) spawnStreak();
      streaks = streaks.filter((s) => s.x - s.len < w);
      for (const s of streaks) {
        s.x += s.v;
        const sg = ctx.createLinearGradient(s.x - s.len, 0, s.x, 0);
        sg.addColorStop(0, `rgba(${GREEN},0)`);
        sg.addColorStop(1, `rgba(${GREEN},${s.a})`);
        ctx.strokeStyle = sg; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.x - s.len, s.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
    }
  }

  function loop(t) {
    if (document.hidden) { requestAnimationFrame(loop); return; }
    if (t - last > 1000 / 50) { draw(t); last = t; }
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  if (!reduce) requestAnimationFrame(loop);
})();
