import * as THREE from "three";
import { cakeIntroFrame, cakeRibbonPoint } from "./cakeIntroMotion";

const TIERS = [
  { radius: 2.3, height: 1.2, bottom: 0.48, color: 0x9dc4d6 },
  { radius: 1.88, height: 1.04, bottom: 1.68, color: 0xadcbdc },
  { radius: 1.44, height: 0.96, bottom: 2.72, color: 0xbdd5e0 },
  { radius: 1.02, height: 0.86, bottom: 3.68, color: 0xcbdde5 },
  { radius: 0.65, height: 0.76, bottom: 4.54, color: 0xd8e6ea },
];

function glowTexture(star = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.08, "rgba(231,253,255,.95)");
  gradient.addColorStop(0.24, "rgba(126,211,255,.45)");
  gradient.addColorStop(0.55, "rgba(46,125,255,.1)");
  gradient.addColorStop(1, "rgba(20,65,170,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  if (star) {
    ctx.translate(128, 128);
    ctx.fillStyle = "#f6ffff";
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const radius = i % 2 ? 7 : i % 4 ? 65 : 116;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundedTierGeometry(radius, height, bottomColor) {
  const bevel = Math.min(0.14, height * 0.12);
  const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(radius - bevel, 0)];
  for (let i = 1; i <= 10; i++) {
    const angle = i / 10 * Math.PI / 2;
    profile.push(new THREE.Vector2(radius - bevel + Math.sin(angle) * bevel, bevel - Math.cos(angle) * bevel));
  }
  profile.push(new THREE.Vector2(radius, height - bevel));
  for (let i = 1; i <= 10; i++) {
    const angle = i / 10 * Math.PI / 2;
    profile.push(new THREE.Vector2(radius - bevel + Math.cos(angle) * bevel, height - bevel + Math.sin(angle) * bevel));
  }
  profile.push(new THREE.Vector2(0, height));
  const geometry = new THREE.LatheGeometry(profile, 112);
  const positions = geometry.attributes.position;
  const colors = [];
  const low = new THREE.Color(bottomColor);
  const high = new THREE.Color(0xf3f3ed);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const t = THREE.MathUtils.smoothstep(positions.getY(i) / height, 0.04, 0.93);
    color.lerpColors(low, high, t);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function starCandyGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? 0.43 : 1;
    if (i === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.025, bevelSegments: 2, steps: 1 });
}

function sparkles(positions, heights, size, ratio) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aHeight", new THREE.Float32BufferAttribute(heights, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uSize: { value: size * ratio } },
    vertexShader: `
      attribute float aHeight;
      uniform float uProgress;
      uniform float uTime;
      uniform float uSize;
      varying float vLight;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vLight = smoothstep(aHeight - .025, aHeight + .025, uProgress);
        vLight *= .76 + .24 * sin(uTime * 1.3 + position.x * 13.0 + position.y * 8.0);
        gl_PointSize = clamp(uSize / max(1.0, -view.z), 1.0, 24.0);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying float vLight;
      void main() {
        float d = length(gl_PointCoord - .5) * 2.0;
        if (d > 1.0 || vLight < .001) discard;
        float glow = pow(1.0 - d, 2.2);
        vec3 color = mix(vec3(.32,.64,1.0),vec3(.9,.99,1.0),pow(1.0-d,3.0));
        gl_FragColor = vec4(color, glow * vLight);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

export function createCakeIntroScene(canvas, options = {}) {
  const { reducedMotion = false, onReveal = () => {}, onFrame = () => {}, onComplete = () => {}, onError = () => {} } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x050c1c, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030914, 0.017);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 100);
  const cake = new THREE.Group();
  scene.add(cake);
  const textures = new Set();
  let seed = 110;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const creamMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0, clearcoat: 0.04 });
  const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xd9bd85, roughness: 0.3, metalness: 0.65 });
  const tierLights = [];
  const glints = [];
  const glintHeights = [];
  const macaronShells = [];
  const macaronFillings = [];
  const piping = [];
  const goldLeaf = [];
  const sugarPearls = [];
  const sugarStars = [];
  const coloredSugarBeads = [];
  const up = new THREE.Vector3(0, 1, 0);
  const outward = new THREE.Vector3(0, 0, 1);

  for (const [index, tier] of TIERS.entries()) {
    const top = tier.bottom + tier.height;
    const body = new THREE.Mesh(
      roundedTierGeometry(tier.radius, tier.height, tier.color),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 0, roughness: 0.54, clearcoat: 0.035 }),
    );
    body.name = `cake-fondant-tier-${index + 1}`;
    body.position.y = tier.bottom;
    cake.add(body);

    // Soft shell piping follows the base; the rounded upper edge stays clean.
    const shellCount = Math.round(tier.radius * 38);
    for (let i = 0; i < shellCount; i++) {
      const angle = i / shellCount * Math.PI * 2;
      const r = tier.radius - 0.05;
      piping.push({
        position: new THREE.Vector3(Math.cos(angle) * r, tier.bottom + 0.065, Math.sin(angle) * r),
        scale: new THREE.Vector3(0.062, 0.045, 0.043),
        rotation: new THREE.Quaternion().setFromAxisAngle(up, -angle),
      });
    }
    const trim = new THREE.Mesh(new THREE.TorusGeometry(tier.radius - 0.008, 0.012, 6, 112), goldMaterial);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = tier.bottom + 0.16;
    cake.add(trim);

    const clusterAngle = 2.35 - index * 0.3;

    // Three macarons across the entire cake, leaving room for the icing details.
    for (let i = 0; i < (index % 2 === 0 ? 1 : 0); i++) {
      const angle = clusterAngle - 0.68 - i * 0.28;
      const r = tier.radius - 0.18;
      const center = new THREE.Vector3(Math.cos(angle) * r, top + 0.1, Math.sin(angle) * r);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), i === 0 ? 0.2 : -0.25);
      const size = index < 2 ? 0.155 : index < 4 ? 0.13 : 0.105;
      for (const sign of [-1, 1]) {
        const offset = new THREE.Vector3(0, sign * 0.043, 0).applyQuaternion(tilt);
        macaronShells.push({ position: center.clone().add(offset), scale: new THREE.Vector3(size, 0.055, size), rotation: tilt, color: i === 0 ? 0xa6cfdf : 0xe4d8c6 });
      }
      macaronFillings.push({ position: center, scale: new THREE.Vector3(size * 0.92, 0.025, size * 0.92), rotation: tilt });
    }

    const beadCount = Math.max(5, Math.round(tier.radius * 7));
    const beadColors = [0x94cedf, 0xdcb9ce, 0xbeb5dc, 0xe8c78f, 0xe5eef2];
    for (let i = 0; i < beadCount; i++) {
      const angle = i / beadCount * Math.PI * 2 + index * 0.37;
      const size = 0.065 + random() * 0.035;
      const r = tier.radius + 0.032;
      coloredSugarBeads.push({
        position: new THREE.Vector3(Math.cos(angle) * r, tier.bottom + 0.25 + random() * 0.19, Math.sin(angle) * r),
        scale: new THREE.Vector3(size, size, size),
        color: beadColors[(i + index) % beadColors.length],
      });
    }

    for (let i = 0; i < 9; i++) {
      const angle = clusterAngle - 1.5 + i * (index < 3 ? 0.15 : 0.22);
      const r = tier.radius - 0.12 - (i % 3) * 0.035;
      const size = i % 3 === 0 ? 0.057 : 0.035;
      sugarPearls.push({ position: new THREE.Vector3(Math.cos(angle) * r, top + size, Math.sin(angle) * r), scale: new THREE.Vector3(size, size, size), color: i % 4 === 0 ? 0xe9d4a7 : 0xf3f8f8 });
    }
    for (let i = 0; i < 3; i++) {
      const angle = clusterAngle - 0.35 + i * 0.28;
      const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const turn = new THREE.Quaternion().setFromUnitVectors(outward, normal);
      turn.multiply(new THREE.Quaternion().setFromAxisAngle(outward, (i - 1) * 0.32));
      const size = i === 1 ? 0.1 : 0.065;
      sugarStars.push({ position: normal.clone().multiplyScalar(tier.radius + 0.008).setY(top - 0.34 - (i % 2) * 0.2), scale: new THREE.Vector3(size, size, size), rotation: turn });
    }

    // Small irregular gold-leaf flecks sit near the flowers, rather than in rows.
    for (let i = 0; i < 11; i++) {
      const angle = clusterAngle + (random() - 0.5) * 0.46;
      const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const turn = new THREE.Quaternion().setFromUnitVectors(outward, normal);
      turn.multiply(new THREE.Quaternion().setFromAxisAngle(outward, random() * Math.PI));
      const size = 0.035 + random() * 0.06;
      goldLeaf.push({ position: normal.clone().multiplyScalar(tier.radius + 0.004).setY(top - 0.28 - random() * 0.5), scale: new THREE.Vector3(size, size * (0.5 + random()), 1), rotation: turn });
    }

    for (let i = 0; i < 70; i++) {
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * (tier.radius - 0.14);
      const y = top + 0.01;
      glints.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
      glintHeights.push((y - 0.48) / 5.1);
    }
    const light = new THREE.PointLight(0xd9efff, 0, 6, 2);
    light.position.set(0.3, tier.bottom + tier.height * 0.65, tier.radius + 1.1);
    tierLights.push(light);
    cake.add(light);
  }

  function addDecorations(name, geometry, material, items) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    mesh.name = name;
    for (const [i, item] of items.entries()) {
      matrix.compose(item.position, item.rotation || rotation, item.scale);
      mesh.setMatrixAt(i, matrix);
      if (item.color !== undefined) mesh.setColorAt(i, new THREE.Color(item.color));
    }
    cake.add(mesh);
  }
  addDecorations("cake-macaron-shells", sphere, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0 }), macaronShells);
  addDecorations("cake-macaron-fillings", sphere, creamMaterial, macaronFillings);
  addDecorations("cake-shell-piping", new THREE.SphereGeometry(1, 12, 8), creamMaterial, piping);
  const flake = new THREE.BufferGeometry();
  flake.setAttribute("position", new THREE.Float32BufferAttribute([-0.6,-0.35,0, 0.7,-0.2,0, -0.1,0.8,0], 3));
  flake.computeVertexNormals();
  addDecorations("cake-gold-leaf", flake, new THREE.MeshStandardMaterial({ color: 0xe4c78b, roughness: 0.35, metalness: 0.65, side: THREE.DoubleSide }), goldLeaf);
  addDecorations("cake-sugar-pearls", sphere, new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.08, roughness: 0.28, clearcoat: 0.2 }), sugarPearls);
  addDecorations("cake-sugar-stars", starCandyGeometry(), goldMaterial, sugarStars);
  addDecorations("cake-colored-sugar-beads", sphere, new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.035, roughness: 0.3, clearcoat: 0.28 }), coloredSugarBeads);

  const plateMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe0e8e9, metalness: 0, roughness: 0.3, clearcoat: 0.35 });
  const plate = new THREE.Mesh(roundedTierGeometry(2.65, 0.12, 0xc5d9e2), plateMaterial);
  plate.position.y = 0.33;
  cake.add(plate);
  const rimTrim = new THREE.Mesh(new THREE.TorusGeometry(2.59, 0.018, 8, 112), goldMaterial);
  rimTrim.rotation.x = Math.PI / 2;
  rimTrim.position.y = 0.4;
  cake.add(rimTrim);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.3, 0.18, 80), plateMaterial);
  foot.position.y = 0.21;
  cake.add(foot);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.54, 20), goldMaterial);
  candle.position.y = 5.57;
  cake.add(candle);

  const ribbonPoints = Array.from({ length: 601 }, (_, i) => {
    const point = cakeRibbonPoint(i / 600);
    return new THREE.Vector3(point.x, point.y, point.z);
  });
  const curve = new THREE.CatmullRomCurve3(ribbonPoints);
  const ribbonMeshes = [];
  for (const [radius, color, opacity] of [[0.015, 0xe7fcff, 0.95], [0.048, 0x83d2ff, 0.14], [0.105, 0x3c98ff, 0.035]]) {
    const geometry = new THREE.TubeGeometry(curve, 960, radius, 6, false);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.geometry.setDrawRange(0, 0);
    ribbonMeshes.push(mesh);
    cake.add(mesh);
  }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 480, 0.009, 4, false), new THREE.MeshBasicMaterial({ color: 0x5c98bc, transparent: true, opacity: 0.08 }));
  cake.add(wire);
  const beadPositions = [];
  const beadHeights = [];
  for (let i = 0; i < 175; i++) {
    const p = cakeRibbonPoint(i / 174);
    beadPositions.push(p.x, p.y, p.z);
    beadHeights.push(i / 174);
  }
  const beads = sparkles(beadPositions, beadHeights, 145, pixelRatio);
  const sugar = sparkles(glints, glintHeights, 42, pixelRatio);
  cake.add(beads, sugar);

  const softTexture = glowTexture();
  const starTexture = glowTexture(true);
  textures.add(softTexture);
  textures.add(starTexture);
  const topper = new THREE.Group();
  topper.position.y = 6.04;
  cake.add(topper);
  const starLayers = [];
  for (const [texture, width, height, opacity] of [[softTexture, 2.6, 2.6, 0.65], [starTexture, 1.05, 1.05, 1], [softTexture, 6.8, 0.09, 0.4]]) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: 0xd5edff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.set(width, height, 1);
    starLayers.push({ sprite, opacity });
    topper.add(sprite);
  }
  const starLight = new THREE.PointLight(0xc6e9ff, 0, 9, 2);
  starLight.position.y = 5.86;
  cake.add(starLight);

  const ambient = new THREE.HemisphereLight(0xd5e9f5, 0x273347, 0.55);
  const key = new THREE.DirectionalLight(0xfff5e7, 0.4);
  key.position.set(-4, 8, 7);
  const rim = new THREE.DirectionalLight(0x7eb7df, 0.9);
  rim.position.set(3, 5, -4);
  scene.add(ambient, key, rim);

  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: softTexture, color: 0x256ac1, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.025;
  scene.add(floorGlow);

  let frame = 0;
  let previous = null;
  let elapsed = 0;
  let stopped = false;
  let destroyed = false;
  let complete = false;
  let revealed = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }

  function render() {
    const state = cakeIntroFrame(elapsed, camera.aspect, reducedMotion);
    camera.position.set(state.cameraX, state.cameraY, state.cameraZ);
    camera.lookAt(0, state.targetY, 0);
    cake.rotation.y = -0.1 + state.pullback * 0.16;
    for (const mesh of ribbonMeshes) {
      const count = mesh.geometry.index.count;
      mesh.geometry.setDrawRange(0, Math.floor(count * state.lights / 36) * 36);
    }
    for (const points of [beads, sugar]) {
      points.material.uniforms.uProgress.value = state.lights;
      points.material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
    }
    tierLights.forEach((light, index) => {
      const t = Math.max(0, Math.min(1, (state.lights - index * 0.18) / 0.17));
      light.intensity = t * 2.9;
    });
    key.intensity = 0.4 + state.lights * 2.15;
    ambient.intensity = 0.55 + state.lights * 0.35;
    floorGlow.material.opacity = 0.08 + state.lights * 0.2;
    for (const { sprite, opacity } of starLayers) sprite.material.opacity = state.star * opacity;
    starLight.intensity = state.star * 5;
    renderer.render(scene, camera);
    onFrame(state);
    if (state.reveal && !revealed) {
      revealed = true;
      onReveal();
    }
    if (state.complete && !complete) {
      complete = true;
      onComplete();
    }
  }

  function tick(now) {
    if (destroyed || stopped || document.hidden || complete) return;
    if (previous !== null) elapsed += Math.min((now - previous) / 1000, 0.08);
    previous = now;
    render();
    if (!complete) frame = requestAnimationFrame(tick);
  }
  function pause() {
    stopped = true;
    previous = null;
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function resume() {
    if (destroyed || complete || document.hidden || frame) return;
    stopped = false;
    previous = null;
    frame = requestAnimationFrame(tick);
  }
  function contextLost(event) {
    event.preventDefault();
    pause();
    onError();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener("webglcontextlost", contextLost);
  resize();
  resume();

  return {
    pause,
    resume,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      pause();
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", contextLost);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) for (const material of [object.material].flat()) materials.add(material);
        if (object.isInstancedMesh) object.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
    },
  };
}
