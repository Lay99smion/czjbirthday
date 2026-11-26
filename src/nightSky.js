// Shared sky keeps the stars in place between the countdown and cake opening.
export function createNightSkyLayers() {
  let seed = 10110;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return [800, 450, 180].map((count, layer) => {
    const shadows = Array.from({ length: count }, () => {
      const x = (random() * 100).toFixed(3);
      const y = (random() * 100).toFixed(3);
      const alpha = (0.35 + random() * 0.6).toFixed(2);
      const color = layer === 1 ? `rgba(182,212,255,${alpha})` : `rgba(232,243,255,${alpha})`;
      return `${x}vw ${y}dvh ${layer === 2 ? "1px" : "0px"} 0 ${color}`;
    }).join(",");
    return { "--star-shadows": shadows, "--star-size": `${[0.7, 0.9, 1.25][layer]}px`, "--star-duration": `${7 + layer * 2}s`, "--star-delay": `${layer * -3.1}s` };
  });
}
