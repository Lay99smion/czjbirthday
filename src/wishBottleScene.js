import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { wishPosition } from "./wishBottleLayout";

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "#fffce8");
  glow.addColorStop(.08, "#fff3c7");
  glow.addColorStop(.22, "rgba(255,213,127,.85)");
  glow.addColorStop(.5, "rgba(242,177,82,.2)");
  glow.addColorStop(1, "rgba(242,177,82,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createWishBottleScene(host, { onSelect, onUnavailable }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  camera.position.set(0, .45, 7.2);
  camera.lookAt(0, .12, 0);
  const bottle = new THREE.Group();
  scene.add(bottle);
  const resources = new Set();
  const keep = (resource) => { resources.add(resource); return resource; };
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false;
  let frame = 0;
  let lastTime = null;
  let elapsed = 0;
  let inView = true;
  let pointerX = 0;
  let selectedId = null;
  let revealedId = null;
  let flight = null;
  let flash = 0;
  const stars = new Map();

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = keep(pmrem.fromScene(environment, .04));
  scene.environment = environmentTarget.texture;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe1eaff, 0x61513c, 2));
  const light = new THREE.DirectionalLight(0xffe4af, 3.5);
  light.position.set(-3, 4, 5);
  scene.add(light);
  const rimLight = new THREE.DirectionalLight(0xa5c8ff, 3);
  rimLight.position.set(3, 1, -3);
  scene.add(rimLight);

  const profile = [
    [0, -1.53], [.73, -1.53], [.91, -1.48], [1.01, -1.34], [1.04, -1.12],
    [1.04, .35], [1.02, .56], [.94, .75], [.76, .91], [.5, 1.06],
    [.4, 1.17], [.4, 1.45], [.43, 1.49],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glassGeometry = keep(new THREE.LatheGeometry(profile, 64));
  const glass = keep(new THREE.MeshPhysicalMaterial({
    color: 0xc2dce5, metalness: .08, roughness: .14, transmission: .25,
    thickness: .12, transparent: true, opacity: .24, clearcoat: 1,
    clearcoatRoughness: .12, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false,
  }));
  const shell = new THREE.Mesh(glassGeometry, glass);
  shell.renderOrder = 1;
  bottle.add(shell);

  const rimMaterial = keep(new THREE.MeshPhysicalMaterial({
    color: 0xc4dfeb, metalness: .2, roughness: .18, transparent: true,
    opacity: .65, clearcoat: 1, envMapIntensity: 1.8, depthWrite: false,
  }));
  function ring(radius, thickness, y, material = rimMaterial) {
    const mesh = new THREE.Mesh(keep(new THREE.TorusGeometry(radius, thickness, 10, 64)), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    bottle.add(mesh);
    return mesh;
  }
  ring(.425, .045, 1.48);
  ring(.402, .018, 1.29);
  ring(.91, .035, -1.46);
  ring(.87, .012, -1.4);
  const gold = keep(new THREE.MeshStandardMaterial({ color: 0xd4b47b, metalness: .6, roughness: .38 }));
  ring(.411, .013, 1.22, gold);
  ring(.412, .012, 1.18, gold);

  // Fine edge reflections give the glass a silhouette even on a dark screen.
  const reflection = keep(new THREE.LineBasicMaterial({ color: 0xc5e6f4, transparent: true, opacity: .32 }));
  for (const angle of [-1.02, 1.02]) {
    const points = profile.slice(3, 12).map((p) => new THREE.Vector3(Math.sin(angle) * p.x, p.y, Math.cos(angle) * p.x));
    const curve = new THREE.CatmullRomCurve3(points);
    bottle.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48))), reflection));
  }
  const cord = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.3, 1.22, .3), new THREE.Vector3(.65, 1, .55), new THREE.Vector3(.72, .68, .72),
  ]);
  bottle.add(new THREE.Mesh(keep(new THREE.TubeGeometry(cord, 24, .009, 5, false)), gold));
  const tagCanvas = document.createElement("canvas");
  tagCanvas.width = 192;
  tagCanvas.height = 240;
  const tagCtx = tagCanvas.getContext("2d");
  tagCtx.fillStyle = "#e6d9bb";
  tagCtx.fillRect(0, 0, 192, 240);
  tagCtx.strokeStyle = "#ad956a";
  tagCtx.lineWidth = 2;
  tagCtx.strokeRect(12, 12, 168, 216);
  tagCtx.textAlign = "center";
  tagCtx.fillStyle = "#806b48";
  tagCtx.font = "42px Georgia";
  tagCtx.fillText("✦", 96, 102);
  tagCtx.font = "18px Georgia";
  tagCtx.fillText("FOR YOU", 96, 151);
  tagCtx.font = "13px Georgia";
  tagCtx.fillText("WITH LOVE", 96, 181);
  const tagTexture = keep(new THREE.CanvasTexture(tagCanvas));
  tagTexture.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Mesh(keep(new THREE.PlaneGeometry(.37, .46)), keep(new THREE.MeshStandardMaterial({ map: tagTexture, side: THREE.DoubleSide, roughness: .9 })));
  tag.position.set(.73, .47, .77);
  tag.rotation.z = -.14;
  tag.rotation.y = -.12;
  bottle.add(tag);

  const texture = keep(glowTexture());
  function makeGlow(color, size, opacity = 1) {
    const material = new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(size);
    sprite.renderOrder = 2;
    return sprite;
  }
  const colors = [0xffe4a1, 0xffce9b, 0xddd2ff, 0xc7e1ff];
  const travelling = makeGlow(0xffe5af, .5);
  travelling.visible = false;
  bottle.add(travelling);
  const trail = Array.from({ length: 14 }, (_, i) => {
    const sprite = makeGlow(0xffdaa0, .12 - i * .005, .5 * (1 - i / 14));
    sprite.visible = false;
    bottle.add(sprite);
    return sprite;
  });
  const aura = makeGlow(0xffcf83, 3, .12);
  aura.position.set(0, -.8, -.2);
  bottle.add(aura);

  const dustPositions = new Float32Array(60 * 3);
  for (let i = 0; i < 60; i++) {
    const angle = i * 2.39996;
    const radius = 1.4 + (i % 9) / 8 * .8;
    dustPositions[i * 3] = Math.cos(angle) * radius;
    dustPositions[i * 3 + 1] = Math.sin(angle) * 1.85;
    dustPositions[i * 3 + 2] = -.8 - (i % 5) * .1;
  }
  const dustGeometry = keep(new THREE.BufferGeometry());
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, keep(new THREE.PointsMaterial({ color: 0xe7cf9c, size: .018, transparent: true, opacity: .45, depthWrite: false })));
  scene.add(dust);

  function render() {
    if (!disposed) renderer.render(scene, camera);
  }
  function canRun() {
    return !disposed && !document.hidden && (inView || flight) && (!motion.matches || flight);
  }
  function schedule() {
    if (!frame && canRun()) frame = requestAnimationFrame(tick);
  }
  function finishFlight() {
    if (!flight) return;
    const completed = flight;
    flight = null;
    travelling.visible = false;
    trail.forEach((sprite) => { sprite.visible = false; });
    const star = stars.get(completed.id);
    if (star) star.sprite.visible = completed.kind !== "reveal";
    if (completed.kind === "reveal") revealedId = completed.id;
    flash = motion.matches ? 0 : 1;
    completed.resolve();
  }
  function tick(now) {
    frame = 0;
    if (!canRun()) { lastTime = null; return; }
    const delta = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, .05);
    lastTime = now;
    elapsed += delta;
    bottle.rotation.y += ((motion.matches ? 0 : pointerX * .1 + Math.sin(elapsed * .3) * .035) - bottle.rotation.y) * .05;
    for (const [id, star] of stars) {
      const wave = motion.matches ? 0 : Math.sin(elapsed * .9 + star.phase);
      star.sprite.position.y = star.y + wave * .028;
      const emphasis = id === selectedId ? 1.7 : 1;
      star.sprite.scale.setScalar(star.size * emphasis * (1 + wave * .13));
      star.sprite.material.opacity = .8 + wave * .18;
    }
    if (flight) {
      flight.age += delta;
      const progress = Math.min(flight.age / flight.duration, 1);
      if (!motion.matches) {
        const eased = progress * progress * (3 - 2 * progress);
        travelling.position.copy(flight.path.getPoint(eased));
        travelling.scale.setScalar(flight.kind === "reveal" ? .24 + progress * .45 : .46 - progress * .23);
        trail.forEach((sprite, i) => {
          const t = Math.max(0, eased - (i + 1) * .016);
          sprite.visible = t > 0 && progress < .96;
          sprite.position.copy(flight.path.getPoint(t));
        });
      }
      if (progress >= 1) finishFlight();
    }
    flash = Math.max(0, flash - delta * 1.4);
    aura.material.opacity = (stars.size ? .12 : .035) + flash * .24;
    aura.scale.setScalar(3 + flash * .9);
    if (!motion.matches) dust.rotation.z = Math.sin(elapsed * .05) * .08;
    render();
    schedule();
  }
  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    // A narrow mobile viewport needs slightly more room around the bottle.
    camera.position.z = camera.aspect < .85 ? 7.8 : 7.2;
    camera.updateProjectionMatrix();
    render();
  }
  function setWishes(wishes) {
    const ids = new Set(wishes.map((wish) => wish.id));
    for (const [id, star] of stars) {
      if (ids.has(id)) continue;
      bottle.remove(star.sprite);
      star.sprite.material.dispose();
      stars.delete(id);
    }
    for (const wish of wishes) {
      if (stars.has(wish.id)) continue;
      const position = wishPosition(wish.id);
      const size = .15 + (position.phase / (Math.PI * 2)) * .13;
      const sprite = makeGlow(colors[Math.floor(position.phase) % colors.length], size);
      sprite.position.set(position.x, position.y, position.z);
      bottle.add(sprite);
      stars.set(wish.id, { ...position, size, sprite });
    }
    aura.material.opacity = stars.size ? .12 : .035;
    render();
    schedule();
  }
  function collect(id) {
    finishFlight();
    if (disposed) return Promise.resolve();
    const star = stars.get(id);
    if (!star) return Promise.resolve();
    star.sprite.visible = motion.matches;
    travelling.visible = !motion.matches;
    const destination = star.sprite.position.clone();
    return new Promise((resolve) => {
      flight = {
        id, resolve, kind: "collect", age: 0, duration: motion.matches ? .2 : 2.4,
        path: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.65, .2, .8), new THREE.Vector3(-1.25, 1.7, .5),
          new THREE.Vector3(0, 1.9, 0), new THREE.Vector3(0, 1.2, 0), destination,
        ]),
      };
      lastTime = null;
      schedule();
    });
  }
  function reveal(id) {
    finishFlight();
    if (disposed) return Promise.resolve();
    if (revealedId && stars.has(revealedId)) stars.get(revealedId).sprite.visible = true;
    revealedId = null;
    const star = stars.get(id);
    if (!star) return Promise.resolve();
    star.sprite.visible = false;
    travelling.visible = !motion.matches;
    return new Promise((resolve) => {
      flight = {
        id, resolve, kind: "reveal", age: 0, duration: motion.matches ? .15 : 1.7,
        path: new THREE.CatmullRomCurve3([
          star.sprite.position.clone(), new THREE.Vector3(0, .85, 0),
          new THREE.Vector3(0, 1.65, 0), new THREE.Vector3(-.7, 1.9, .5),
          new THREE.Vector3(0, .25, 2),
        ]),
      };
      lastTime = null;
      schedule();
    });
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPosition = null;
  function pointerDown(event) { downPosition = { x: event.clientX, y: event.clientY }; }
  function pointerUp(event) {
    if (!downPosition || Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y) > 10 || flight) return;
    downPosition = null;
    const rect = host.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const candidates = [...stars.entries()];
    // Slightly larger targets make small lights practical to tap on a phone.
    let nearest = null;
    let distance = Infinity;
    for (const [id, star] of candidates) {
      if (!star.sprite.visible) continue;
      const position = star.sprite.getWorldPosition(new THREE.Vector3());
      const toRay = raycaster.ray.distanceToPoint(position);
      if (toRay < .15 && toRay < distance) { nearest = id; distance = toRay; }
    }
    if (nearest !== null) onSelect(nearest);
  }
  function pointerMove(event) {
    if (event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  }
  function pointerLeave() { pointerX = 0; downPosition = null; }
  function visibility() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    if (motion.matches) { bottle.rotation.set(0, 0, 0); render(); }
    schedule();
  }
  function contextLost(event) { event.preventDefault(); onUnavailable(); }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibility(); }, { rootMargin: "80px" });
  observer.observe(host);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  host.addEventListener("pointerdown", pointerDown);
  host.addEventListener("pointerup", pointerUp);
  host.addEventListener("pointermove", pointerMove);
  host.addEventListener("pointerleave", pointerLeave);
  document.addEventListener("visibilitychange", visibility);
  motion.addEventListener("change", visibility);
  resize();
  schedule();

  return {
    setWishes,
    collect,
    reveal,
    setSelected(id) {
      if (revealedId && revealedId !== id) {
        const previous = stars.get(revealedId);
        if (previous) previous.sprite.visible = true;
        revealedId = null;
      }
      selectedId = id;
      for (const [starId, star] of stars) star.sprite.scale.setScalar(star.size * (starId === id ? 1.7 : 1));
      render();
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      finishFlight();
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", visibility);
      host.removeEventListener("pointerdown", pointerDown);
      host.removeEventListener("pointerup", pointerUp);
      host.removeEventListener("pointermove", pointerMove);
      host.removeEventListener("pointerleave", pointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      for (const star of stars.values()) star.sprite.material.dispose();
      for (const sprite of [travelling, aura, ...trail]) sprite.material.dispose();
      for (const resource of resources) resource.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
