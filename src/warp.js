export const WARP_DURATION_MS = 5000;

// A small 2D star tunnel. It runs only while the overlay is visible and
// advances its five-second clock using requestAnimationFrame timestamps.
export function createWarpField(canvas, onComplete) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const stars = Array.from({ length: 150 }, () => newStar());
  let width = 0;
  let height = 0;
  let dpr = 1;
  let elapsed = 0;
  let lastFrame = null;
  let frame = 0;
  let running = false;

  function newStar(depth = 0.15 + Math.random()) {
    const angle = Math.random() * Math.PI * 2;
    const spread = 0.12 + Math.sqrt(Math.random()) * 1.15;
    return {
      x: Math.cos(angle) * spread,
      y: Math.sin(angle) * spread,
      z: depth,
      speed: 0.65 + Math.random() * 0.8,
      warm: Math.random() > 0.78,
    };
  }

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(delta) {
    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.38;
    const progress = Math.min(elapsed / WARP_DURATION_MS, 1);
    const rush = 1 + Math.sin(progress * Math.PI) * 2.8;

    ctx.fillStyle = "#050b1e";
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.63);
    glow.addColorStop(0, "rgba(255,231,184,.35)");
    glow.addColorStop(0.12, "rgba(102,128,220,.27)");
    glow.addColorStop(0.46, "rgba(35,45,113,.21)");
    glow.addColorStop(1, "rgba(5,11,30,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 6; i++) {
      const phase = (elapsed * 0.00024 + i / 6) % 1;
      const radius = 10 + phase * phase * Math.max(width, height) * 0.85;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius, radius * 0.78, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(177,198,255,${(1 - phase) * 0.21})`;
      ctx.lineWidth = 1 + phase * 2;
      ctx.stroke();
    }

    for (const star of stars) {
      star.z -= delta * 0.00014 * star.speed * rush;
      if (star.z < 0.12) Object.assign(star, newStar(1.12));
      const headX = cx + (star.x / star.z) * scale;
      const headY = cy + (star.y / star.z) * scale;
      const tailZ = star.z + 0.055 * rush;
      const tailX = cx + (star.x / tailZ) * scale;
      const tailY = cy + (star.y / tailZ) * scale;
      if (headX < -50 || headX > width + 50 || headY < -50 || headY > height + 50) continue;
      const near = Math.max(0, 1 - star.z / 1.2);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.strokeStyle = star.warm
        ? `rgba(255,224,166,${0.25 + near * 0.75})`
        : `rgba(205,224,255,${0.23 + near * 0.72})`;
      ctx.lineWidth = 0.7 + near * 2.1;
      ctx.stroke();
    }
  }

  function tick(now) {
    if (!running) return;
    const rawDelta = lastFrame === null ? 0 : Math.max(0, now - lastFrame);
    lastFrame = now;
    elapsed += rawDelta;
    if (elapsed >= WARP_DURATION_MS) {
      pause();
      onComplete();
      return;
    }
    draw(Math.min(rawDelta, 80));
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
