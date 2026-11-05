"use client";

import { useRef } from "react";
import { useThreeScene } from "@/lib/useThreeScene";
import { mulberry32 } from "@/lib/random";
import MAP from "@/app/app/audit/asia-dots.json";

/** ISO codes in the order the dot file numbers its countries. */
export const MAP_CODES = MAP.codes as string[];

/** Where a region sits: lon/lat in degrees. */
export type Pin = { lon: number; lat: number };

const MAX_PINS = 6;
/** Map centre (degrees) and scale (world units per degree). */
const LON0 = 104.5;
const LAT0 = 26.5;
const K = 0.105;

const DOT_VERT = /* glsl */ `
attribute float aState;
attribute float aSeed;
uniform float uTime;
uniform float uReveal;
uniform float uPixelRatio;
uniform vec2 uPins[${MAX_PINS}];
uniform int uPinCount;
varying float vState;
varying float vGlow;
varying float vShow;
void main() {
  // sweep in west to east, with a little scatter so it reads as dots landing
  vShow = clamp((uReveal * 9.0 - (position.x + 3.6)) * 1.4 + aSeed * 0.6, 0.0, 1.0);
  // rings spreading out from every region pin
  float glow = 0.0;
  for (int i = 0; i < ${MAX_PINS}; i++) {
    if (i >= uPinCount) break;
    float phase = fract(uTime * 0.28 + float(i) * 0.37);
    float d = distance(position.xy, uPins[i]);
    glow = max(glow, (1.0 - smoothstep(0.0, 0.16, abs(d - phase * 2.2))) * (1.0 - phase));
  }
  vec3 p = position;
  p.z += glow * 0.08;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float base = aState > 1.5 ? 4.6 : 3.8;
  gl_PointSize = (base + glow * 2.6) * vShow * uPixelRatio * (9.0 / -mv.z);
  vState = aState;
  vGlow = glow;
}
`;
const DOT_FRAG = /* glsl */ `
varying float vState;
varying float vGlow;
varying float vShow;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  vec3 red = vec3(0.89, 0.024, 0.075);
  vec3 c = vState > 1.5 ? red : mix(vec3(1.0), red, vGlow * 0.85);
  gl_FragColor = vec4(c, vShow * smoothstep(0.5, 0.25, r));
}
`;

/**
 * China and mainland/maritime Southeast Asia as a dot matrix (Natural Earth
 * outlines, 0.85° grid). The countries the workspace's regions are in are
 * red, the rest white. Each region sends rings through the dots around it.
 * The map tilts toward the pointer.
 */
export function AsiaMap({ active, pins }: { active: string[]; pins: Pin[] }) {
  const data = useRef({ active, pins });
  const ref = useThreeScene(
    ({ THREE, scene, camera, renderer, pointer }) => {
      const { active, pins } = data.current;
      const on = new Set(active.map((c) => MAP_CODES.indexOf(c)).filter((i) => i >= 0));
      const xy = (lon: number, lat: number) => [(lon - LON0) * K, (lat - LAT0) * K] as const;
      const group = new THREE.Group();
      scene.add(group);
      const pr = renderer.getPixelRatio();
      const rnd = mulberry32(5);

      const dots = MAP.dots as [number, number, number][];
      const pos = new Float32Array(dots.length * 3);
      const state = new Float32Array(dots.length);
      const seed = new Float32Array(dots.length);
      dots.forEach(([lon, lat, c], i) => {
        const [x, y] = xy(lon / 10, lat / 10);
        pos.set([x, y, 0], i * 3);
        state[i] = on.has(c) ? 2 : 1;
        seed[i] = rnd();
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aState", new THREE.BufferAttribute(state, 1));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

      const shown = pins.slice(0, MAX_PINS);
      const pinVecs = Array.from({ length: MAX_PINS }, (_, i) => {
        const p = shown[i];
        return p ? new THREE.Vector2(...xy(p.lon, p.lat)) : new THREE.Vector2(99, 99);
      });
      const uniforms = {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uPixelRatio: { value: pr },
        uPins: { value: pinVecs },
        uPinCount: { value: shown.length },
      };
      group.add(new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms, transparent: true, depthWrite: false })));

      const REVEAL = 1.8;
      let tiltX = 0;
      let tiltY = 0;
      let narrowCard = false;
      return {
        resize(w, h) {
          // phones: the map sits under the figures; wide cards: to the right of them
          narrowCard = h > w * 0.8;
          camera.position.set(0, 0, narrowCard ? 11 : 9);
          camera.lookAt(0, 0, 0);
          group.position.set(narrowCard ? 0.35 : 2.6, narrowCard ? -1.95 : 0.2, 0);
          group.scale.setScalar(narrowCard ? 0.72 : 1.02);
        },
        frame(t) {
          uniforms.uTime.value = t;
          const k = Math.min(1, t / REVEAL);
          uniforms.uReveal.value = k;
          tiltX += ((pointer.inside ? -pointer.y * 0.12 : 0) - tiltX) * 0.05;
          tiltY += ((pointer.inside ? pointer.x * 0.16 : 0) - tiltY) * 0.05;
          // phones tilt it further back, so a wide map fits the short space under the figures
          group.rotation.set((narrowCard ? -0.8 : -0.5) + tiltX, tiltY, 0);
        },
      };
    },
    { fov: 38 },
  );
  return <div ref={ref} aria-hidden="true" className="absolute inset-0" />;
}
