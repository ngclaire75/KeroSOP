"use client";

import { useEffect, useRef } from "react";
import { useThreeScene } from "@/lib/useThreeScene";
import { mulberry32 } from "@/lib/random";
import { onAuth } from "@/lib/authEvents";
import { CAT_BRIDGE, CAT_HEAD } from "@/components/ui";

export type AuthMode = "login" | "signup";

/* Point roles. A: 0 outline, 1 lens glass. B: 0 page, 1 red (the conflict). */
type Pt = [x: number, y: number, z: number, kind: number];

const LOGO_W = 5;
/** Logo viewBox: "56 148 1178 964"; the head's visual centre. */
const LOGO_CX = 645;
const LOGO_CY = 630;

function shuffle<T>(list: T[], rand: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** The cat in reading glasses: stroke pixels of the logo, plus a disc of "glass" in each lens. */
function logoShape(n: number, rand: () => number): Pt[] {
  const s = 0.5;
  const W = Math.round(1178 * s);
  const H = Math.round(964 * s);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.scale(s, s);
  ctx.translate(-56, -148);
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 58;
  ctx.stroke(new Path2D(CAT_HEAD));
  ctx.lineWidth = 50;
  for (const cx of [414, 866]) {
    ctx.beginPath();
    ctx.arc(cx, 707, 150, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 44;
  ctx.stroke(new Path2D(CAT_BRIDGE));
  const data = ctx.getImageData(0, 0, W, H).data;
  const ink: [number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 140) ink.push([x / s + 56, y / s + 148]);

  const k = LOGO_W / 1178;
  const toWorld = (vx: number, vy: number): [number, number] => [(vx - LOGO_CX) * k, -(vy - LOGO_CY) * k];

  const nLens = Math.round(n * 0.26);
  const nLine = n - nLens;
  const pts: Pt[] = [];
  for (let i = 0; i < nLine; i++) {
    const [vx, vy] = ink[Math.floor(rand() * ink.length)];
    const [x, y] = toWorld(vx, vy);
    pts.push([x, y, (rand() - 0.5) * 0.22, 0]);
  }
  for (let i = 0; i < nLens; i++) {
    const cx = i % 2 ? 414 : 866;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 122;
    const [x, y] = toWorld(cx + Math.cos(a) * r, 707 + Math.sin(a) * r);
    pts.push([x, y, (rand() - 0.5) * 0.1, 1]);
  }
  return pts;
}

/** Two SOP pages side by side. One line on each is red, joined by a red arc: the clash KeroSOP finds. */
function pagesShape(n: number, rand: () => number): Pt[] {
  const PW = 2.35;
  const PH = 3.15;
  const step = 0.05;
  type Page = { cx: number; tilt: number; red: number };
  const pages: Page[] = [
    { cx: -1.3, tilt: 0.32, red: 6 },
    { cx: 1.3, tilt: -0.32, red: 9 },
  ];
  const candidates: Pt[] = [];
  const ends: [number, number, number][] = [];
  const place = (p: Page, u: number, v: number, kind: number): Pt => {
    // u, v in page space (centre origin); tilt the page about its vertical axis.
    const x = p.cx + u * Math.cos(p.tilt);
    const z = -u * Math.sin(p.tilt);
    return [x, v - 0.35, z, kind];
  };
  pages.forEach((p, pi) => {
    // Page edge, with a folded corner.
    const fold = 0.38;
    for (let t = 0; t <= 1; t += step / PW) {
      const u = -PW / 2 + t * PW;
      candidates.push(place(p, u, -PH / 2, 0));
      if (u < PW / 2 - fold) candidates.push(place(p, u, PH / 2, 0));
    }
    for (let t = 0; t <= 1; t += step / PH) {
      const v = -PH / 2 + t * PH;
      candidates.push(place(p, -PW / 2, v, 0));
      if (v < PH / 2 - fold) candidates.push(place(p, PW / 2, v, 0));
    }
    for (let t = 0; t <= 1; t += step / (fold * 1.414)) {
      candidates.push(place(p, PW / 2 - fold + t * fold, PH / 2 - t * fold, 0));
    }
    // Lines of text: a heading, then body lines of varied length.
    const left = -PW / 2 + 0.26;
    const top = PH / 2 - 0.42;
    for (let row = 0; row < 12; row++) {
      const v = top - row * 0.215 - (row > 0 ? 0.12 : 0);
      if (v < -PH / 2 + 0.25) break;
      const len = row === 0 ? 0.55 : row === 11 ? 0.4 : 0.62 + rand() * 0.3;
      const width = (PW - 0.52) * len;
      const red = row === p.red ? 1 : 0;
      const rows = row === 0 ? 3 : 1;
      for (let r = 0; r < rows; r++)
        for (let u = 0; u <= width; u += step * 0.9) {
          // Red lines are drawn denser so they read first.
          candidates.push(place(p, left + u, v - r * 0.045, red));
          if (red) candidates.push(place(p, left + u, v - 0.04, red));
        }
      if (red) ends.push(place(p, pi === 0 ? left + width : left, v, 1).slice(0, 3) as [number, number, number]);
    }
  });
  // The arc between the two red lines, lifted toward the viewer.
  const [a, b] = ends;
  for (let t = 0; t <= 1; t += 0.006) {
    const mx = (a[0] + b[0]) / 2;
    const my = Math.max(a[1], b[1]) + 1.15;
    const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0];
    const y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * my + t * t * b[1];
    const z = Math.sin(t * Math.PI) * 0.9 + (a[2] * (1 - t) + b[2] * t);
    candidates.push([x, y, z, 1]);
  }

  const nShape = n;
  // Every candidate at least once, then fill the rest with jittered repeats.
  const pts: Pt[] = shuffle(candidates.slice(), rand).slice(0, nShape);
  while (pts.length < nShape) {
    const c = candidates[Math.floor(rand() * candidates.length)];
    pts.push([c[0] + (rand() - 0.5) * 0.02, c[1] + (rand() - 0.5) * 0.02, c[2], c[3]]);
  }
  return pts;
}

const VERT = /* glsl */ `
attribute vec3 aB;
attribute vec4 aInfo; // rand, kind in A, kind in B, size
uniform float uTime;
uniform float uMorph;
uniform float uPrivacy;
uniform float uPulse;
uniform float uSize;
uniform float uPR;
uniform vec2 uMouse;
uniform float uMouseK;
varying vec3 vColor;
varying float vAlpha;

float is(float kind, float k) { return 1.0 - step(0.5, abs(kind - k)); }

void main() {
  float r = aInfo.x;
  // Each dot leaves on its own beat, so the shape unravels instead of crossfading.
  float p = clamp(uMorph * 1.6 - r * 0.6, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  vec3 pos = mix(position, aB, p);

  // In transit, dots swing round the vertical axis and scatter a little.
  float tr = sin(p * 3.14159);
  float ang = tr * (1.2 + r * 1.8);
  float c = cos(ang), s = sin(ang);
  pos.xz = mat2(c, -s, s, c) * pos.xz;
  pos.y += tr * (r - 0.5) * 1.4;

  pos += 0.035 * vec3(sin(uTime * 0.8 + r * 40.0), cos(uTime * 0.7 + r * 31.0), sin(uTime * 0.6 + r * 17.0));

  // The pointer parts the dots like a hand through sand.
  vec2 d = pos.xy - uMouse;
  float dist2 = dot(d, d);
  float f = uMouseK * exp(-dist2 / 0.32);
  pos.xy += normalize(d + 1e-4) * f * 0.42;
  pos.z += f * 0.5;

  float lensA = is(aInfo.y, 1.0) * (1.0 - p);
  float redB = is(aInfo.z, 1.0) * p;
  float shades = lensA * uPrivacy;

  // Success: a ring of light runs out from the centre.
  float ring = 0.0;
  if (uPulse > 0.0) ring = exp(-pow(length(pos.xy) - uPulse * 7.0, 2.0) * 2.5) * (1.0 - uPulse);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = aInfo.w * (1.0 + shades * 0.5 + redB * 0.25 + ring * 1.4 + f * 0.9);
  gl_PointSize = size * uSize * uPR / -mv.z;

  vColor = mix(vec3(1.0), vec3(0.89, 0.024, 0.075), clamp(max(max(shades, redB), ring), 0.0, 1.0));
  float glass = mix(1.0, 0.2, lensA * (1.0 - uPrivacy));
  vAlpha = glass * (1.0 - smoothstep(9.0, 17.0, -mv.z));
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.36, 0.5, r)));
}
`;

type Controls = { setMode(mode: AuthMode): void };

/**
 * A three.js cloud of dots. On "Log in" it draws the KeroSOP cat in its
 * reading glasses; on "Sign up" it unravels and re-forms as two SOP pages
 * with one red clause on each, joined by a red arc. While a password field
 * has focus the lenses fill in red, like shades. The pointer parts the dots,
 * and a successful submit sends a ring of light through them.
 */
export function CatCloud({ mode, className = "" }: { mode: AuthMode; className?: string }) {
  const controls = useRef<Controls | null>(null);
  const modeRef = useRef(mode);

  const ref = useThreeScene(
    ({ THREE, scene, camera, renderer, host, pointer, reduced }) => {
      const narrow = host.clientWidth < 700;
      const N = narrow ? 5200 : 9000;
      const rand = mulberry32(7);
      const A = shuffle(logoShape(N, rand), rand);
      const B = shuffle(pagesShape(N, rand), rand);

      const pos = new Float32Array(N * 3);
      const posB = new Float32Array(N * 3);
      const info = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) {
        pos.set(A[i].slice(0, 3), i * 3);
        posB.set(B[i].slice(0, 3), i * 3);
        info.set([rand(), A[i][3], B[i][3], 0.75 + rand() * 0.6], i * 4);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aB", new THREE.BufferAttribute(posB, 3));
      geo.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));

      const u = {
        uTime: { value: 0 },
        uMorph: { value: modeRef.current === "signup" ? 1 : 0 },
        uPrivacy: { value: 0 },
        uPulse: { value: 0 },
        uSize: { value: 30 },
        uPR: { value: renderer.getPixelRatio() },
        uMouse: { value: new THREE.Vector2(99, 99) },
        uMouseK: { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: u,
        transparent: true,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      const group = new THREE.Group();
      group.add(points);
      scene.add(group);

      const redraw = () => reduced && renderer.render(scene, camera);
      const anime = import("animejs");
      type Run = { cancel(): unknown };
      const runs: Record<string, Run | null> = {};
      const tween = (key: "uMorph" | "uPrivacy" | "uPulse", from: number | null, to: number, duration: number, ease: string) => {
        runs[key]?.cancel();
        if (reduced) {
          u[key].value = key === "uPulse" ? 0 : to;
          return redraw();
        }
        anime.then(({ animate }) => {
          if (from !== null) u[key].value = from;
          runs[key] = animate(u[key], { value: to, duration, ease });
        });
      };

      controls.current = {
        setMode: (m) => tween("uMorph", null, m === "signup" ? 1 : 0, 2100, "inOutQuart"),
      };
      const off = onAuth((s) => {
        if (s.type === "privacy") tween("uPrivacy", null, s.on ? 1 : 0, s.on ? 420 : 650, "outQuart");
        if (s.type === "success") tween("uPulse", 0, 1, 1600, "outCubic");
      });

      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();
      const ndc = new THREE.Vector2();
      let lift = 0;
      // Phone band only: the pages sit lower than the cat, so raise them as the morph runs.
      let raiseB = 0;
      // ...and draw them a little larger there.
      let growB = 0;

      return {
        resize(w, h) {
          u.uPR.value = renderer.getPixelRatio();
          const aspect = w / h;
          // Tall desktop panel: the headline sits in the lower third, so the art lives above it.
          // Short phone band: keep clear of the logo and back link along the top.
          const tall = window.matchMedia("(min-width: 1024px)").matches;
          const fitH = tall ? 0.6 : 0.7;
          const fitW = tall ? 0.86 : 0.7;
          const tan = Math.tan(((camera.fov / 2) * Math.PI) / 180);
          const dist = Math.max(4.6 / fitH, 5.4 / (aspect * fitW)) / (2 * tan);
          camera.position.set(0, 0, dist);
          camera.lookAt(0, 0, 0);
          const visH = 2 * dist * tan;
          lift = tall ? visH * 0.15 : -visH * 0.07;
          raiseB = tall ? 0 : visH * 0.05;
          growB = tall ? 0 : 0.12;
          group.position.y = lift + u.uMorph.value * raiseB;
          u.uSize.value = 30 * (11 / dist) * Math.min(1.25, Math.max(0.8, h / 760));
        },
        frame(t) {
          u.uTime.value = t;
          group.position.y = lift + u.uMorph.value * raiseB;
          group.scale.setScalar(1 + u.uMorph.value * growB);
          ndc.set(pointer.x, pointer.y);
          ray.setFromCamera(ndc, camera);
          if (pointer.inside && ray.ray.intersectPlane(plane, hit)) u.uMouse.value.set(hit.x / group.scale.x, (hit.y - group.position.y) / group.scale.x);
          u.uMouseK.value += ((pointer.inside ? 1 : 0) - u.uMouseK.value) * 0.06;
          const tx = pointer.inside ? pointer.x * 0.38 : Math.sin(t * 0.25) * 0.12;
          const ty = pointer.inside ? -pointer.y * 0.2 : Math.sin(t * 0.19) * 0.05;
          group.rotation.y += (tx - group.rotation.y) * 0.04;
          group.rotation.x += (ty - group.rotation.x) * 0.04;
        },
        dispose() {
          off();
          Object.values(runs).forEach((r) => r?.cancel());
          controls.current = null;
        },
      };
    },
    { fov: 35 },
  );

  useEffect(() => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    controls.current?.setMode(mode);
  }, [mode]);

  return <div ref={ref} aria-hidden="true" className={className} />;
}
