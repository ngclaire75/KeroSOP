"use client";

import { useEffect, useRef, useState } from "react";
import { useThreeScene } from "@/lib/useThreeScene";
import { setConsent, SETTINGS_HREF, useConsent } from "@/lib/consent";

const FUR_VERT = /* glsl */ `
attribute float aTone;
uniform float uSize;
uniform float uDpr;
varying float vTone;
varying float vAlpha;
void main() {
  vTone = aTone;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uDpr * mix(1.0, 0.85, aTone) * (5.0 / -mv.z);
  vAlpha = mix(mix(0.2, 0.95, smoothstep(4.7, 3.5, -mv.z)), 0.9, aTone);
}
`;

// Fur is grey; the nose is white.
const FUR_FRAG = /* glsl */ `
varying float vTone;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float edge = smoothstep(0.5, 0.32, r);
  gl_FragColor = vec4(vec3(mix(0.5, 0.97, vTone)), edge * vAlpha);
}
`;

// Blush: brand red (#e30613).
const BLUSH_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  gl_FragColor = vec4(0.89, 0.024, 0.075, smoothstep(0.5, 0.32, r) * vAlpha);
}
`;

// Eyes: each dot sits on a sleepy line and springs to its spot in a wide-open eye as uAwake goes 0 to 1.
const EYE_VERT = /* glsl */ `
attribute vec3 aOpen;
uniform float uAwake;
uniform float uSize;
uniform float uDpr;
void main() {
  vec3 p = mix(position, aOpen, uAwake);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uDpr * (5.0 / -mv.z);
}
`;

const EYE_FRAG = /* glsl */ `
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  gl_FragColor = vec4(vec3(0.97), smoothstep(0.5, 0.32, r));
}
`;

/**
 * A sleepy cat head of dots. Each hover twitches the ears; pat it a few times
 * and the "- -" eyes pop open in surprise, then it drifts back to sleep.
 */
function CatHead() {
  const hint = useRef<HTMLSpanElement>(null);
  const ref = useThreeScene(({ THREE, scene, camera, renderer, pointer }) => {
    const dpr = renderer.getPixelRatio();
    const RX = 1.15;
    const RY = 0.95;
    const RZ = 0.75;
    const faceZ = (x: number, y: number) => RZ * Math.sqrt(Math.max(0, 1 - (x * x) / (RX * RX) - (y * y) / (RY * RY)));

    const furMat = new THREE.ShaderMaterial({
      vertexShader: FUR_VERT,
      fragmentShader: FUR_FRAG,
      uniforms: { uSize: { value: 2.5 }, uDpr: { value: dpr } },
      transparent: true,
      depthWrite: false,
    });
    const points = (pts: number[][], tone = 0) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
      g.setAttribute("aTone", new THREE.Float32BufferAttribute(pts.map(() => tone), 1));
      return new THREE.Points(g, furMat);
    };

    const head = new THREE.Group();
    scene.add(head);

    // Skull: an ellipsoid shell.
    const N = 620;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const skull: number[][] = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      skull.push([Math.cos(th) * r * RX, y * RY, Math.sin(th) * r * RZ]);
    }
    head.add(points(skull));

    // Ears: filled triangles hinged at their base so they can twitch.
    const ear = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.62, 0.62, 0.05);
      pivot.rotation.z = -side * 0.32;
      // Sides bow outward so the tip is a soft dome, not a point.
      const H = 0.6;
      const S = 0.1;
      const pts: number[][] = [];
      for (let v = 0; v <= H + 1e-6; v += S * 0.8) {
        const half = 0.38 * Math.pow(Math.max(0, 1 - v / H), 0.55);
        for (let u = -half + S / 2; u < half - S / 2; u += S) pts.push([u, v, 0]);
        pts.push([-half, v, 0], [half, v, 0]);
      }
      pivot.add(points(pts));
      head.add(pivot);
      return pivot;
    };
    const ears = [ear(-1), ear(1)];

    // Face details, lifted just off the surface.
    const onFace = (x: number, y: number, lift = 0.04): number[] => [x, y, faceZ(x, y) + lift];
    const details: number[][] = [];
    // Nose: a triangle pointing down, its two top corners rounded off.
    const NT = -0.13;
    const NW = 0.135;
    const NH = 0.135;
    const RC = 0.04;
    const inNose = (x: number, y: number) => {
      if (y > NT || y < NT - NH || Math.abs(x) > (NW * (y - (NT - NH))) / NH) return false;
      const cx = NW - RC * 1.6;
      const cy = NT - RC;
      return !(Math.abs(x) > cx && y > cy) || Math.hypot(Math.abs(x) - cx, y - cy) <= RC;
    };
    for (let y = NT; y >= NT - NH; y -= 0.018)
      for (let x = -NW; x <= NW; x += 0.018) if (inNose(x, y)) details.push(onFace(x, y, 0.05));
    const face = points(details, 1);
    face.renderOrder = 1;
    head.add(face);

    // Blush: a red oval on each cheek, drawn as concentric oval rings for a swirled texture; dots are
    // spaced evenly along each ring's length, so the outer edge reads as one clean curve.
    const BX = 0.58;
    const BY = -0.1;
    const BRX = 0.15;
    const BRY = 0.075;
    const ovalRing = (rx: number, ry: number, gap: number): number[][] => {
      const steps = 360;
      const lens = [0];
      for (let i = 1; i <= steps; i++) {
        const a0 = ((i - 1) / steps) * Math.PI * 2;
        const a1 = (i / steps) * Math.PI * 2;
        lens.push(lens[i - 1] + Math.hypot(rx * (Math.cos(a1) - Math.cos(a0)), ry * (Math.sin(a1) - Math.sin(a0))));
      }
      const total = lens[steps];
      const n = Math.max(3, Math.round(total / gap));
      const out: number[][] = [];
      for (let k = 0, j = 0; k < n; k++) {
        const target = (k / n) * total;
        while (lens[j + 1] < target) j++;
        const a = ((j + (target - lens[j]) / (lens[j + 1] - lens[j])) / steps) * Math.PI * 2;
        out.push([Math.cos(a) * rx, Math.sin(a) * ry]);
      }
      return out;
    };
    const blushShape: number[][] = [[0, 0]];
    for (const s of [1, 0.75, 0.5, 0.25]) blushShape.push(...ovalRing(BRX * s, BRY * s, 0.02));
    const blushPts: number[][] = [];
    for (const side of [-1, 1]) for (const [x, y] of blushShape) blushPts.push(onFace(side * BX + x, BY + y, 0.05));
    const blushGeo = new THREE.BufferGeometry();
    blushGeo.setAttribute("position", new THREE.Float32BufferAttribute(blushPts.flat(), 3));
    blushGeo.setAttribute("aTone", new THREE.Float32BufferAttribute(blushPts.map(() => 1), 1));
    const blush = new THREE.Points(
      blushGeo,
      new THREE.ShaderMaterial({
        vertexShader: FUR_VERT,
        fragmentShader: BLUSH_FRAG,
        uniforms: { uSize: { value: 2.6 }, uDpr: { value: dpr } },
        transparent: true,
        depthWrite: false,
      }),
    );
    blush.renderOrder = 1;
    head.add(blush);

    // Eyes. Open: a round disc of dots in rings, with one dark spot left empty top right.
    const ER = 0.14;
    const disc: number[][] = [[0, 0]];
    for (const r of [1, 0.86, 0.72, 0.58, 0.44, 0.3, 0.16]) {
      const n = Math.round((Math.PI * 2 * r) / 0.13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r;
        disc.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
    // The spot: clear a clean margin, then trace its edge with its own ring so it reads as a smooth oval.
    const SX = 0.12;
    const SY = 0.16;
    const SR = 0.56;
    const eye = disc.filter(([x, y]) => Math.hypot(x - SX, y - SY) > SR + 0.1);
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      eye.push([SX + Math.cos(a) * (SR + 0.04), SY + Math.sin(a) * (SR + 0.04)]);
    }

    const linePos: number[] = [];
    const openPos: number[] = [];
    for (const side of [-1, 1]) {
      const cx = side * 0.36;
      const cy = 0.12;
      const z = faceZ(cx, cy) + 0.07;
      for (const [ex, ey] of eye) {
        // Sleepy: every dot flattened onto one short line.
        linePos.push(cx + ex * 0.122, cy, z);
        // Open: an upright oval, narrower than it is tall.
        openPos.push(cx + ex * ER * 0.78, cy + ey * ER, z + 0.03);
      }
    }
    const eyeGeo = new THREE.BufferGeometry();
    eyeGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    eyeGeo.setAttribute("aOpen", new THREE.Float32BufferAttribute(openPos, 3));
    const eyeUniforms = { uAwake: { value: 0 }, uSize: { value: 2.3 }, uDpr: { value: dpr } };
    const eyes = new THREE.Points(
      eyeGeo,
      new THREE.ShaderMaterial({ vertexShader: EYE_VERT, fragmentShader: EYE_FRAG, uniforms: eyeUniforms, transparent: true, depthWrite: false }),
    );
    // Drawn last: the eyes always sit above the fur.
    eyes.renderOrder = 1;
    head.add(eyes);

    camera.position.set(0, 0.24, 4.3);
    camera.lookAt(0, 0.24, 0);

    const tilt = { x: 0, y: 0 };
    let wasInside = false;
    const last = { x: 0, y: 0 };
    let pats = 0;
    let twitch = 0;
    let awake = 0;

    return {
      frame(t, dt) {
        // Petting: entering counts, and so does any stroke across the head, whichever way it goes.
        if (pointer.inside && !wasInside) {
          pats = Math.min(pats + 1, 4.5);
          twitch = 1;
        } else if (pointer.inside) {
          const moved = Math.hypot(pointer.x - last.x, pointer.y - last.y);
          pats = Math.min(pats + moved * 0.9, 4.5);
          if (moved > 0.02) twitch = Math.max(twitch, 0.6);
        }
        wasInside = pointer.inside;
        last.x = pointer.x;
        last.y = pointer.y;
        if (!pointer.inside) pats = Math.max(0, pats - dt * 0.45);
        const target = pats >= 3 ? 1 : 0;
        // Eyes pop open fast, close slowly.
        awake += (target - awake) * Math.min(1, dt * (target ? 9 : 3));
        twitch = Math.max(0, twitch - dt * 2.2);
        eyeUniforms.uAwake.value = awake;
        // The hint steps aside once it wakes.
        if (hint.current) hint.current.style.opacity = String(1 - awake);

        const tx = pointer.inside ? pointer.x : 0;
        const ty = pointer.inside ? pointer.y : 0;
        tilt.y += (tx * 0.45 - tilt.y) * 0.06;
        tilt.x += (-ty * 0.3 - tilt.x) * 0.06;
        // Asleep it nods slowly; awake it holds still.
        const nod = Math.sin(t * 0.9) * 0.05 * (1 - awake);
        head.rotation.set(tilt.x + nod + 0.08, tilt.y + Math.sin(t * 0.4) * 0.25, Math.sin(t * 0.6) * 0.04);
        ears.forEach((e, i) => {
          const side = i ? 1 : -1;
          // Ears perk up when it wakes.
          e.rotation.z = -side * (0.32 - awake * 0.16) + Math.sin(t * 38) * 0.18 * twitch * (i ? 1 : -1);
        });
      },
    };
  });
  return (
    <div className="relative">
      <div ref={ref} aria-hidden="true" className="h-[160px] w-full sm:h-[200px]" />
      <span ref={hint} aria-hidden="true" className="cat-hint">
        Pat Me
      </span>
    </div>
  );
}

/**
 * Asks before any analytics load. Shown until the visitor picks; any link to
 * `#cookie-settings` (the footer has one) brings it back.
 */
export function CookieBanner() {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);
  const open = consent === null || reopened;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.(`a[href="${SETTINGS_HREF}"]`);
      if (!a) return;
      e.preventDefault();
      setReopened(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!open) return null;

  const choose = (analytics: boolean) => {
    setReopened(false);
    setConsent(analytics);
  };

  return (
    <section
      role="region"
      aria-label="Cookie preferences"
      className="cookie-banner fixed right-4 bottom-4 z-[70] w-[min(300px,calc(100vw-32px))] overflow-hidden rounded-[17px] text-white sm:right-6 sm:bottom-6 sm:w-[330px] sm:border sm:border-white/10"
    >
      <CatHead />
      <div className="px-5 pt-2 pb-6 sm:px-6 sm:pt-2 sm:pb-7">
        <h2 className="text-base font-bold sm:text-lg">Cookies, only if you say yes.</h2>
        <p className="mt-1.5 text-[13px] leading-[1.5] text-white/65 sm:mt-2 sm:text-[15px] sm:leading-[1.55]">
          We’d like to use analytics to see which pages help people. Nothing loads until you accept. Storage that keeps
          you logged in is always on.{" "}
          <a href="/privacy#cookies" className="text-white underline underline-offset-4">
            Privacy
          </a>
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3">
          <button type="button" onClick={() => choose(false)} className="cookie-btn cookie-btn-ghost">
            Necessary only
          </button>
          <button type="button" onClick={() => choose(true)} className="cookie-btn cookie-btn-solid">
            Accept
          </button>
        </div>
      </div>
    </section>
  );
}
