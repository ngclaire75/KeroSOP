"use client";

import type { RefObject } from "react";
import type * as THREE_NS from "three";
import { useThreeScene, type Three } from "@/lib/useThreeScene";

// Shared dot look: round, soft edge, white fading to KeroSOP red with heat.
const FRAG = /* glsl */ `
uniform float uFade;
varying float vHeat;
varying float vAlpha;

void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float edge = smoothstep(0.5, 0.32, r);
  vec3 col = mix(vec3(0.92), vec3(0.89, 0.024, 0.075), clamp(vHeat, 0.0, 1.0));
  gl_FragColor = vec4(col, edge * vAlpha * uFade);
}
`;

const HEAD = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uDpr;
varying float vHeat;
varying float vAlpha;
`;

const SIZE = /* glsl */ `
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uDpr * (1.0 + vHeat * 0.9) * (6.0 / -mv.z);
`;

/** Support and BPO: a sphere of dots; escalation bands climb from tier to tier. */
const SPHERE = /* glsl */ `
${HEAD}
void main() {
  vec3 p = position;
  float lat = p.y / 1.5;
  float band = 0.0;
  for (int i = 0; i < 3; i++) {
    float ph = fract(uTime * 0.16 + float(i) / 3.0) * 2.4 - 1.2;
    band = max(band, exp(-pow((lat - ph) * 7.0, 2.0)));
  }
  p *= 1.0 + band * 0.07;
  vHeat = band;
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  vAlpha = mix(0.18, 1.0, smoothstep(7.4, 5.0, -view.z)) * mix(0.75, 1.0, band);
  ${SIZE}
}
`;

/** Retail: a shopping bag of dots. A red check sweeps down it; the price tag swings. */
const BAG = /* glsl */ `
${HEAD}
attribute float aKind;
attribute float aT;
void main() {
  vec3 p = position;
  float tag = step(0.5, aKind);
  vec4 world = modelMatrix * vec4(p, 1.0);
  float scan = 1.5 - fract(uTime * 0.2) * 3.2;
  float band = exp(-pow((world.y - scan) * 5.0, 2.0)) * (1.0 - tag);
  p += normalize(vec3(p.x, 0.0, p.z) + 1e-4) * band * 0.05;
  vHeat = max(tag, band);
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  vAlpha = mix(mix(0.3, 1.0, smoothstep(6.6, 4.6, -view.z)), 1.0, max(tag, band));
  ${SIZE}
}
`;

/** Logistics: a parcel of dots. Goods drop in, the flaps fold shut, red tape seals it. */
const BOX = /* glsl */ `
${HEAD}
attribute float aKind;
attribute float aT;
uniform float uTape;
uniform float uItem;
void main() {
  vec3 p = position;
  float tape = step(0.5, aKind) * (1.0 - step(1.5, aKind));
  float item = step(1.5, aKind);
  vHeat = tape + item;
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  float body = mix(0.3, 1.0, smoothstep(7.2, 5.0, -view.z));
  vAlpha = mix(mix(body, step(aT, uTape), tape), uItem, item);
  ${SIZE}
}
`;

/** Bilingual: an English sheet and a Chinese copy. The copy slips out of step, then re-syncs. */
const SHEETS = /* glsl */ `
${HEAD}
attribute float aSheet;
uniform float uLag;
void main() {
  vec3 p = position;
  float ph = uTime * 1.2 + aSheet * uLag;
  p.y += sin(p.x * 1.5 + ph) * 0.2 + sin(p.z * 2.0 + ph * 0.7) * 0.06;
  vHeat = aSheet * smoothstep(0.2, 2.6, uLag);
  vAlpha = mix(0.95, 0.85, aSheet);
  ${SIZE}
}
`;

type Panel = {
  scene: THREE_NS.Scene;
  camera: THREE_NS.PerspectiveCamera;
  group: THREE_NS.Group;
  uniforms: Record<string, { value: number }>;
  tilt: { x: number; y: number };
  update?(t: number): void;
};

function makePanel(THREE: Three, vert: string, geo: THREE_NS.BufferGeometry, dpr: number, size: number) {
  const uniforms: Panel["uniforms"] = {
    uTime: { value: 0 },
    uSize: { value: size },
    uDpr: { value: dpr },
    uFade: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.add(new THREE.Points(geo, mat));
  scene.add(group);
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 50);
  return { scene, camera, group, uniforms, tilt: { x: 0, y: 0 } } as Panel;
}

function buildPanels(THREE: Three, dpr: number): Panel[] {

  // 01 sphere
  const N = 1100;
  const sp = new Float32Array(N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    sp.set([Math.cos(th) * r * 1.5, y * 1.5, Math.sin(th) * r * 1.5], i * 3);
  }
  const g1 = new THREE.BufferGeometry();
  g1.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const sphere = makePanel(THREE, SPHERE, g1, dpr, 3.8);
  sphere.camera.position.set(0, 0.4, 6.4);
  sphere.camera.lookAt(0, 0, 0);
  sphere.group.rotation.z = 0.22;
  sphere.update = (t) => (sphere.group.children[0].rotation.y = t * 0.25);

  const STEP = 0.125;
  const span = (from: number, to: number) => {
    const n = Math.max(1, Math.round(Math.abs(to - from) / STEP));
    return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  };
  const cloud = (pts: number[][], kind = 0, ts?: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
    g.setAttribute("aKind", new THREE.Float32BufferAttribute(pts.map(() => kind), 1));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(ts ?? pts.map(() => -1), 1));
    return g;
  };
  // 02 shopping bag
  const BW = 0.68;
  const BD = 0.24;
  const BH = 0.8;
  const bagPts: number[][] = [];
  for (const y of span(-BH, BH)) {
    for (const x of span(-BW, BW)) bagPts.push([x, y, -BD], [x, y, BD]);
    for (const z of span(-BD + STEP, BD - STEP)) bagPts.push([-BW, y, z], [BW, y, z]);
  }
  for (const x of span(-BW + STEP, BW - STEP)) for (const z of span(-BD + STEP, BD - STEP)) bagPts.push([x, -BH, z]);
  const shop = makePanel(THREE, BAG, cloud(bagPts), dpr, 3.6);
  const bagBody = shop.group.children[0] as THREE_NS.Points;
  const bagMat = bagBody.material as THREE_NS.ShaderMaterial;
  const sway = new THREE.Group();
  shop.group.remove(bagBody);
  sway.add(bagBody);
  shop.group.add(sway);
  // Rope handles: a half-ellipse on the front and back panels.
  const handle = (z: number) => {
    const pts: number[][] = [];
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * Math.PI;
      pts.push([Math.cos(a) * 0.32, BH + Math.sin(a) * 0.5, z]);
    }
    const g = new THREE.Group();
    g.position.y = 0;
    g.add(new THREE.Points(cloud(pts), bagMat));
    sway.add(g);
    return g;
  };
  handle(BD);
  const backHandle = handle(-BD);
  // Price tag on a string from the front handle's root.
  const tagPts: number[][] = [];
  const tagT: number[] = [];
  for (const y of span(0, -0.3)) tagPts.push([0, y, 0]);
  for (const x of span(-0.14, 0.14)) for (const y of span(-0.36, -0.72)) tagPts.push([x, y, 0]);
  tagPts.forEach(() => tagT.push(-1));
  const tag = new THREE.Group();
  tag.position.set(0.32, BH, BD + 0.06);
  tag.add(new THREE.Points(cloud(tagPts, 1, tagT), bagMat));
  sway.add(tag);
  shop.camera.position.set(0, 1.0, 4.75);
  shop.camera.lookAt(0, 0.38, 0);
  shop.update = (t) => {
    sway.rotation.y = -0.5 + Math.sin(t * 0.4) * 0.6;
    sway.rotation.z = Math.sin(t * 1.3) * 0.04;
    sway.position.y = Math.sin(t * 1.3) * 0.04;
    backHandle.rotation.x = -0.25 + Math.sin(t * 1.3) * 0.05;
    tag.rotation.z = Math.sin(t * 2.1) * 0.35;
    tag.rotation.x = Math.sin(t * 1.6 + 1) * 0.25;
  };

  // 03 parcel
  const W = 1.0;
  const D = 0.75;
  const H = 0.7;
  const body: number[][] = [];
  for (const x of span(-W, W)) for (const z of span(-D, D)) body.push([x, -H, z]);
  for (const y of span(-H + STEP, H)) {
    for (const x of span(-W, W)) body.push([x, y, -D], [x, y, D]);
    for (const z of span(-D + STEP, D - STEP)) body.push([-W, y, z], [W, y, z]);
  }
  const parcel = makePanel(THREE, BOX, cloud(body), dpr, 3.6);
  parcel.uniforms.uTape = { value: 0 };
  parcel.uniforms.uItem = { value: 0 };
  const bodyPts = parcel.group.children[0] as THREE_NS.Points;
  const mat = bodyPts.material as THREE_NS.ShaderMaterial;
  const spin = new THREE.Group();
  parcel.group.remove(bodyPts);
  spin.add(bodyPts);
  parcel.group.add(spin);

  // Flaps hinge on the rim. Closed, they lie flat over the opening.
  const flap = (pts: number[][], pivot: [number, number, number]) => {
    const hinge = new THREE.Group();
    hinge.position.set(...pivot);
    hinge.add(new THREE.Points(cloud(pts), mat));
    spin.add(hinge);
    return hinge;
  };
  const longIn = span(STEP * 0.5, D);
  const shortIn = span(STEP * 0.5, 0.6);
  const front = flap(span(-W, W).flatMap((x) => longIn.map((s) => [x, 0.03, -s])), [0, H, D]);
  const back = flap(span(-W, W).flatMap((x) => longIn.map((s) => [x, 0.03, s])), [0, H, -D]);
  const right = flap(span(-D, D).flatMap((z) => shortIn.map((s) => [-s, 0, z])), [W, H, 0]);
  const left = flap(span(-D, D).flatMap((z) => shortIn.map((s) => [s, 0, z])), [-W, H, 0]);

  // Tape: across the seam, then down both ends. aT orders the dots along the roll.
  const tape: number[][] = [];
  const tapeT: number[] = [];
  const run = [
    ...span(H, 0.2).map((y) => [-W - 0.02, y, 0]),
    ...span(-W, W).map((x) => [x, H + 0.06, 0]),
    ...span(H, 0.2).map((y) => [W + 0.02, y, 0]),
  ];
  run.forEach((pt, i) => {
    for (const dz of [-0.07, 0.07]) {
      tape.push([pt[0], pt[1], pt[2] + dz]);
      tapeT.push(i / (run.length - 1));
    }
  });
  spin.add(new THREE.Points(cloud(tape, 1, tapeT), mat));

  const goods: number[][] = [];
  for (const x of span(-0.3, 0.3)) for (const y of span(-0.3, 0.3)) for (const z of span(-0.3, 0.3))
    if ([x, y, z].some((v) => Math.abs(Math.abs(v) - 0.3) < 1e-6)) goods.push([x, y, z]);
  const item = new THREE.Points(cloud(goods, 2), mat);
  spin.add(item);

  parcel.camera.position.set(0, 3.0, 5.9);
  parcel.camera.lookAt(0, 0.3, 0);
  const OPEN = 1.97;
  const seg = (p: number, a: number, b: number) => {
    const x = Math.min(1, Math.max(0, (p - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  parcel.update = (t) => {
    const p = t % 7.5;
    spin.rotation.y = -0.6 + Math.sin(t * 0.35) * 0.55;
    const reopen = seg(p, 6.3, 7.2);
    const shortClosed = seg(p, 1.7, 2.3) - reopen;
    const longClosed = seg(p, 2.3, 2.9) - reopen;
    right.rotation.z = -OPEN * (1 - shortClosed);
    left.rotation.z = OPEN * (1 - shortClosed);
    front.rotation.x = OPEN * (1 - longClosed);
    back.rotation.x = -OPEN * (1 - longClosed);
    const drop = seg(p, 0.3, 1.3);
    item.position.y = 2.4 - drop * drop * 2.75;
    parcel.uniforms.uItem.value = seg(p, 0.2, 0.5) * (1 - seg(p, 2.1, 2.7));
    parcel.uniforms.uTape.value = seg(p, 3.0, 3.9) * (1 - seg(p, 6.0, 6.4));
  };

  // 04 sheets
  const SX = 20;
  const SZ = 9;
  const sh: number[] = [];
  const sa: number[] = [];
  for (let s = 0; s < 2; s++)
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        sh.push((x - (SX - 1) / 2) * 0.2, s === 0 ? 0.42 : -0.42, (z - (SZ - 1) / 2) * 0.2);
        sa.push(s);
      }
  const g4 = new THREE.BufferGeometry();
  g4.setAttribute("position", new THREE.Float32BufferAttribute(sh, 3));
  g4.setAttribute("aSheet", new THREE.Float32BufferAttribute(sa, 1));
  const sheets = makePanel(THREE, SHEETS, g4, dpr, 3.9);
  sheets.uniforms.uLag = { value: 0 };
  sheets.camera.position.set(0, 2.2, 5.9);
  sheets.camera.lookAt(0, -0.1, 0);
  sheets.update = (t) => {
    sheets.uniforms.uLag.value = Math.PI * Math.pow(0.5 - 0.5 * Math.cos(t * 0.55), 1.5);
  };

  return [sphere, shop, parcel, sheets];
}

/**
 * One canvas over the audience cards. Each card's `[data-vis]` slot gets its
 * own dot scene, drawn with a scissor so four scenes cost a single context.
 * The pointer tilts whichever scene it is over.
 */
export function AudienceScenes({ list }: { list: RefObject<HTMLUListElement | null> }) {
  const ref = useThreeScene(({ THREE, renderer, host, pointer, reduced }) => {
    renderer.autoClear = false;
    const panels = buildPanels(THREE, renderer.getPixelRatio());
    const hr = { left: 0, top: 0, width: 1, height: 1 };

    return {
      frame(t) {
        renderer.setScissorTest(false);
        renderer.clear();
        const ul = list.current;
        if (!ul) return;
        const h = host.getBoundingClientRect();
        Object.assign(hr, { left: h.left, top: h.top, width: h.width, height: h.height });
        const px = ((pointer.x + 1) / 2) * hr.width;
        const py = ((1 - pointer.y) / 2) * hr.height;
        const slots = ul.querySelectorAll<HTMLElement>("[data-vis]");

        renderer.setScissorTest(true);
        panels.forEach((p, i) => {
          const el = slots[i];
          if (!el) return;
          const r = el.getBoundingClientRect();
          const x = r.left - hr.left;
          const y = r.top - hr.top;
          if (r.width < 2 || r.height < 2) return;

          const card = el.closest("li") as HTMLElement | null;
          const fade = card && !reduced ? parseFloat(card.style.opacity || "1") : 1;

          const over = pointer.inside && px >= x && px <= x + r.width && py >= y && py <= y + r.height;
          const tx = over ? ((px - x) / r.width) * 2 - 1 : 0;
          const ty = over ? ((py - y) / r.height) * 2 - 1 : 0;
          p.tilt.y += (tx * 0.45 - p.tilt.y) * 0.06;
          p.tilt.x += (ty * 0.25 - p.tilt.x) * 0.06;
          p.group.rotation.y = p.tilt.y;
          p.group.rotation.x = p.tilt.x;

          p.uniforms.uTime.value = t;
          p.uniforms.uFade.value = fade;
          p.update?.(t);
          p.camera.aspect = r.width / r.height;
          p.camera.updateProjectionMatrix();

          const by = hr.height - (y + r.height);
          renderer.setViewport(x, by, r.width, r.height);
          renderer.setScissor(x, by, r.width, r.height);
          renderer.render(p.scene, p.camera);
        });
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, hr.width, hr.height);
      },
      dispose() {
        panels.forEach((p) =>
          p.scene.traverse((o) => {
            const m = o as THREE_NS.Points;
            m.geometry?.dispose();
            (m.material as THREE_NS.Material | undefined)?.dispose();
          }),
        );
      },
    };
  });

  return <div ref={ref} className="pointer-events-none absolute inset-0 z-10" />;
}
