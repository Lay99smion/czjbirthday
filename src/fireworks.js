export const FIREWORK_DURATION_MS = 3600;

// Separate finale after the cake confetti: five small bursts, under 250 sparks.
export function createFireworks(canvas, onComplete) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const colors = ["#ffd77d", "#f4a5be", "#b7c9ff", "#fff1d1", "#e8a0a0"];
  const bursts = [
    { at: 150, x: 0.23, y: 0.34 },
    { at: 700, x: 0.77, y: 0.25 },
    { at: 1300, x: 0.5, y: 0.4 },
    { at: 1950, x: 0.28, y: 0.22 },
    { at: 2450, x: 0.72, y: 0.43 },
  ];
  const sparks = [];
  let width = 0;
  let height = 0;
  let elapsed = 0;
  let lastFrame = null;
  let nextBurst = 0;
  let frame = 0;
  let running = false;

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#050a1c";
    ctx.fillRect(0, 0, width, height);
  }

  function explode(burst) {
    const startX = burst.x * width;
    const startY = burst.y * height;
    for (let i = 0; i < 44; i++) {
      const angle = (i / 44) * Math.PI * 2 + Math.random() * 0.15;
      const speed = (0.0035 + Math.random() * 0.003) * Math.min(width, height);
      sparks.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 700 + Math.random() * 500,
        color: colors[nextBurst % colors.length],
        size: 1.5 + Math.random() * 1.7,
        gravity: .015 + Math.random() * .025,
        drag: .978 + Math.random() * .014,
      });
    }
  }

  function draw(delta) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(5,10,28,.22)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    const step = Math.min(delta, 60) / 16.67;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.age += delta;
      if (spark.age >= spark.life) { sparks.splice(i, 1); continue; }
      spark.x += spark.vx * step;
      spark.y += spark.vy * step;
      const drag = spark.drag ** step;
      spark.vx *= drag;
      spark.vy = spark.vy * drag + spark.gravity * step;
      ctx.globalAlpha = 1 - spark.age / spark.life;
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function tick(now) {
    if (!running) return;
    const delta = lastFrame === null ? 0 : Math.max(0, now - lastFrame);
    lastFrame = now;
    elapsed += delta;
    while (nextBurst < bursts.length && elapsed >= bursts[nextBurst].at) {
      explode(bursts[nextBurst]);
      nextBurst++;
    }
    draw(delta);
    if (elapsed >= FIREWORK_DURATION_MS) { pause(); onComplete(); return; }
    frame = requestAnimationFrame(tick);
  }

  function resume() {
    if (running) return;
    running = true;
    lastFrame = null;
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = null;
  }

  function destroy() {
    pause();
    window.removeEventListener("resize", resize);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  return { start: resume, resume, pause, destroy };
}
