export const WARP_DURATION_MS = 5000;

// A small 2D star flight. It runs only while the overlay is visible and
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
      speed: 0.5 + Math.random() * 0.75,
      warm: Math.random() > 0.78,
      trail: 0.025 + Math.random() * 0.035,
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
    const cy = height * 0.43;
    const scale = Math.min(width, height) * 0.38;
    const progress = Math.min(elapsed / WARP_DURATION_MS, 1);
    const rush = 0.65 + Math.sin(progress * Math.PI) * 2;

    const night = ctx.createLinearGradient(0, 0, width, height);
    night.addColorStop(0, "#050b1e");
    night.addColorStop(0.48, "#10172d");
    night.addColorStop(1, "#070d20");
    ctx.fillStyle = night;
    ctx.fillRect(0, 0, width, height);

    // Broad, faint ribbons drift behind the stars without a hard portal edge.
    ctx.save();
    ctx.lineCap = "round";
    ctx.shadowBlur = Math.min(width, height) * 0.06;
    for (let i = 0; i < 3; i++) {
      const drift = Math.sin(elapsed * 0.00035 + i * 1.7) * height * 0.025;
      const y = cy + (i - 1) * height * 0.17 + drift;
      const light = ctx.createLinearGradient(0, y, width, y);
      light.addColorStop(0, "rgba(145,167,220,0)");
      light.addColorStop(0.45, i === 1 ? "rgba(230,206,165,.045)" : "rgba(145,167,220,.055)");
      light.addColorStop(1, "rgba(145,167,220,0)");
      ctx.beginPath();
      ctx.moveTo(-width * 0.1, y + height * 0.12);
      ctx.bezierCurveTo(width * 0.25, y - height * 0.12, width * 0.7, y + height * 0.04, width * 1.1, y - height * 0.18);
      ctx.strokeStyle = light;
      ctx.shadowColor = i === 1 ? "#d6bd8c" : "#748fbd";
      ctx.lineWidth = height * (0.025 + i * 0.012);
      ctx.stroke();
    }
    ctx.restore();
    ctx.lineCap = "round";

    for (const star of stars) {
      star.z -= delta * 0.00014 * star.speed * rush;
      if (star.z < 0.12) Object.assign(star, newStar(1.12));
      const headX = cx + (star.x / star.z) * scale;
      const headY = cy + (star.y / star.z) * scale;
      const tailZ = star.z + star.trail * rush;
      const tailX = cx + (star.x / tailZ) * scale;
      const tailY = cy + (star.y / tailZ) * scale;
      if (headX < -50 || headX > width + 50 || headY < -50 || headY > height + 50) {
        Object.assign(star, newStar(1.12));
        continue;
      }
      const near = Math.max(0, 1 - star.z / 1.2);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.strokeStyle = star.warm
        ? `rgba(255,224,183,${0.18 + near * 0.58})`
        : `rgba(205,220,247,${0.15 + near * 0.55})`;
      ctx.lineWidth = 0.45 + near * 1.15;
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
