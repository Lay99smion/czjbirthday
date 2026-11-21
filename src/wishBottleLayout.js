// Stable positions keep existing lights in place when the collection changes.
export function wishPosition(id) {
  let seed = 2166136261;
  for (const char of String(id)) seed = Math.imul(seed ^ char.codePointAt(0), 16777619) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random()) * .76;
  return { x: Math.cos(angle) * radius, y: -1.22 + random() * 1.78, z: Math.sin(angle) * radius, phase: random() * Math.PI * 2 };
}
