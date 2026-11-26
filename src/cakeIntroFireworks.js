const BURSTS = [
  { at: 0.18, x: 0.2, y: 0.25, size: 0.23, colors: ["#d8f5ff", "#89caff", "#effcff"] },
  { at: 0.5, x: 0.81, y: 0.3, size: 0.22, colors: ["#e0d5ff", "#aaaaff", "#eaf6ff"] },
  { at: 0.86, x: 0.4, y: 0.16, size: 0.17, colors: ["#f7dda9", "#c0e2ff", "#fff4d9"] },
  { at: 1.22, x: 0.15, y: 0.5, size: 0.2, colors: ["#f6d79c", "#edb967", "#fff1ce"] },
  { at: 1.55, x: 0.85, y: 0.48, size: 0.22, colors: ["#a8e9ef", "#9acbff", "#efffff"] },
  { at: 1.9, x: 0.67, y: 0.2, size: 0.18, colors: ["#ffd9e9", "#d8baf4", "#fff0f7"] },
  { at: 2.24, x: 0.22, y: 0.29, size: 0.24, colors: ["#d8f5ff", "#89caff", "#effcff"] },
  { at: 2.58, x: 0.8, y: 0.36, size: 0.23, colors: ["#e0d5ff", "#aaaaff", "#eaf6ff"] },
  { at: 2.92, x: 0.12, y: 0.6, size: 0.18, colors: ["#f6d79c", "#edb967", "#fff1ce"] },
  { at: 3.24, x: 0.88, y: 0.57, size: 0.19, colors: ["#a8e9ef", "#9acbff", "#efffff"] },
  { at: 3.9, x: 0.27, y: 0.23, size: 0.26, colors: ["#f7dda9", "#c0e2ff", "#fff4d9"] },
  { at: 3.9, x: 0.74, y: 0.25, size: 0.26, colors: ["#d8f5ff", "#b9b6ff", "#fff4d9"] },
];

// The cake's timeline drives this transparent background layer, including pauses.
export function createCakeIntroFireworks(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return { render() {}, destroy() {} };
  let seed = 10110;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const bursts = BURSTS.map((burst) => ({
    ...burst,
    sparks: Array.from({ length: burst.size >= 0.24 ? 82 : 64 }, (_, i) => ({
      angle: i / (burst.size >= 0.24 ? 82 : 64) * Math.PI * 2 + random() * 0.055,
      speed: i % 4 === 0 ? 0.35 + random() * 0.25 : 0.78 + random() * 0.22,
      life: 1.7 + random() * 0.7,
      width: 0.7 + random() * 0.7,
      color: burst.colors[i % burst.colors.length],
      phase: random() * Math.PI * 2,
    })),
  }));
  let width = 1;
  let height = 1;
  let lastTime = -1;
  let destroyed = false;

  function point(spark, age, radius) {
    const distance = radius * spark.speed * (1 - Math.exp(-age * 1.8));
    return {
      x: Math.cos(spark.angle) * distance,
      y: Math.sin(spark.angle) * distance * 0.88 + radius * 0.12 * age * age,
    };
  }

  function draw(seconds) {
    ctx.clearRect(0, 0, width, height);
    if (seconds < 0) return;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const burst of bursts) {
      const age = seconds - burst.at;
      if (age < 0 || age > 2.4) continue;
      const x = width * burst.x;
      const y = height * burst.y;
      const radius = Math.min(width, height) * burst.size;
      if (age < 0.55) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.75);
        glow.addColorStop(0, burst.colors[0]);
        glow.addColorStop(1, "transparent");
        ctx.globalAlpha = Math.sin(age / 0.55 * Math.PI) * 0.14;
        ctx.fillStyle = glow;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      for (const spark of burst.sparks) {
        if (age > spark.life) continue;
        const fadeIn = Math.min(1, age / 0.07);
        const fadeOut = Math.max(0, 1 - age / spark.life) ** 1.3;
        const shimmer = 0.82 + Math.sin(age * 6 + spark.phase) * 0.18;
        const alpha = fadeIn * fadeOut * shimmer;
        ctx.strokeStyle = spark.color;
        ctx.fillStyle = spark.color;
        ctx.lineWidth = spark.width;
        for (let tail = 3; tail >= 1; tail--) {
          const from = point(spark, Math.max(0, age - tail * 0.065), radius);
          const to = point(spark, Math.max(0, age - (tail - 1) * 0.065), radius);
          ctx.globalAlpha = alpha * (1 - tail * 0.2);
          ctx.beginPath();
          ctx.moveTo(x + from.x, y + from.y);
          ctx.lineTo(x + to.x, y + to.y);
          ctx.stroke();
        }
        const head = point(spark, age, radius);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x + head.x, y + head.y, spark.width * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(lastTime);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    render(seconds) {
      if (destroyed || seconds === lastTime) return;
      lastTime = seconds;
      draw(seconds);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      ctx.clearRect(0, 0, width, height);
    },
  };
}
