"use client";

import { useThreeScene } from "@/lib/useThreeScene";
import { mulberry32 } from "@/lib/random";

export type Glyph = "privacy" | "terms" | "help";

/** Fired on window the moment the glyph's intro starts; the hero text waits for it. */
export const HERO_START = "kero:hero-start";

const SIZE = 420;

/** Draw the glyph's ink on a square canvas: a padlock, a section mark, or a question mark. */
function drawGlyph(ctx: CanvasRenderingContext2D, glyph: Glyph, family: string) {
  ctx.fillStyle = ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (glyph === "privacy") {
    // Shackle, body, and a keyhole cut out of the body.
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.arc(210, 170, 78, Math.PI, 0);
    ctx.lineTo(288, 205);
    ctx.moveTo(132, 170);
    ctx.lineTo(132, 205);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(88, 200, 244, 190, 36);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(210, 278, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(198, 280, 24, 62);
    ctx.globalCompositeOperation = "source-over";
    return;
  }
  const ch = glyph === "terms" ? "§" : "?";
  ctx.font = `800 ${SIZE * 0.92}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(ch);
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.fillText(ch, SIZE / 2, (SIZE - h) / 2 + m.actualBoundingBoxAscent);
}

/** Sample n points from the glyph's ink, in world units centred on the origin. */
function sample(glyph: Glyph, family: string, n: number, rand: () => number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  drawGlyph(ctx, glyph, family);
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const ink: [number, number][] = [];
  for (let y = 0; y < SIZE; y += 2)
    for (let x = 0; x < SIZE; x += 2) if (data[(y * SIZE + x) * 4 + 3] > 128) ink.push([x, y]);
  // Centre on the ink's own bounds, not the canvas: the padlock's body is heavier than its shackle.
  let x0 = SIZE,
    x1 = 0,
    y0 = SIZE,
    y1 = 0;
  for (const [x, y] of ink) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const k = 4.2 / SIZE;
  return Array.from({ length: n }, () => {
    const [x, y] = ink[Math.floor(rand() * ink.length)];
    return [(x - cx + rand() * 2) * k, -(y - cy + rand() * 2) * k, (rand() - 0.5) * 0.35];
  });
}

const VERT = /* glsl */ `
attribute vec3 aFrom;
attribute vec2 aInfo; // rand, red
uniform float uTime;
uniform float uIntro;
uniform float uSize;
uniform float uPR;
uniform vec2 uMouse;
uniform float uMouseK;
varying float vRed;
varying float vAlpha;

void main() {
  float r = aInfo.x;
  // Each dot flies in from the scattered cloud on its own beat.
  float p = clamp(uIntro * 1.5 - r * 0.5, 0.0, 1.0);
  p = 1.0 - pow(1.0 - p, 3.0);
  vec3 pos = mix(aFrom, position, p);
  pos += 0.03 * vec3(sin(uTime * 0.8 + r * 40.0), cos(uTime * 0.7 + r * 31.0), sin(uTime * 0.6 + r * 17.0));
  vec2 d = pos.xy - uMouse;
  float f = uMouseK * exp(-dot(d, d) / 0.3);
  pos.xy += normalize(d + 1e-4) * f * 0.4;
  pos.z += f * 0.5;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (0.8 + r * 0.6) * (1.0 + f * 0.8) * uSize * uPR / -mv.z;
  vRed = aInfo.y;
  vAlpha = mix(0.0, 1.0, p);
}
`;

const FRAG = /* glsl */ `
varying float vRed;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  vec3 col = mix(vec3(1.0), vec3(0.89, 0.024, 0.075), vRed);
  gl_FragColor = vec4(col, vAlpha * (1.0 - smoothstep(0.36, 0.5, r)));
}
`;

/**
 * The page's symbol drawn in dots (three.js): a padlock for Privacy, a section
 * mark for Terms, a question mark for Help. The dots gather from a loose
 * cloud on load (anime.js drives it), breathe gently, part under the pointer,
 * and the whole shape turns toward it. A few dots are red.
 */
export function GlyphCloud({ glyph, className = "" }: { glyph: Glyph; className?: string }) {
  const ref = useThreeScene(
    ({ THREE, scene, camera, renderer, host, pointer, reduced }) => {
      const N = host.clientWidth < 500 ? 2600 : 4200;
      const rand = mulberry32(glyph.length * 97);
      const family = getComputedStyle(host).fontFamily || "sans-serif";

      const geo = new THREE.BufferGeometry();
      const from = new Float32Array(N * 3);
      const info = new Float32Array(N * 2);
      for (let i = 0; i < N; i++) {
        const a = rand() * Math.PI * 2;
        const b = Math.acos(rand() * 2 - 1);
        const r = 3 + rand() * 3;
        from.set([Math.sin(b) * Math.cos(a) * r, Math.sin(b) * Math.sin(a) * r, Math.cos(b) * r], i * 3);
        info.set([rand(), rand() < 0.07 ? 1 : 0], i * 2);
      }
      const build = () => {
        const pts = sample(glyph, family, N, mulberry32(11));
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
      };
      build();
      geo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
      geo.setAttribute("aInfo", new THREE.BufferAttribute(info, 2));
      // The section and question marks are drawn in the page font: resample once it has loaded.
      document.fonts?.ready.then(build);

      const u = {
        uTime: { value: 0 },
        uIntro: { value: reduced ? 1 : 0 },
        uSize: { value: 26 },
        uPR: { value: renderer.getPixelRatio() },
        uMouse: { value: new THREE.Vector2(99, 99) },
        uMouseK: { value: 0 },
      };
      const points = new THREE.Points(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms: u,
          transparent: true,
          depthWrite: false,
        }),
      );
      points.frustumCulled = false;
      const group = new THREE.Group();
      group.add(points);
      scene.add(group);

      let intro: { cancel(): unknown } | undefined;
      if (!reduced)
        import("animejs").then(({ animate }) => {
          // Tell the hero text to start now, so the dots and the words arrive together.
          window.dispatchEvent(new Event(HERO_START));
          intro = animate(u.uIntro, { value: 1, duration: 2200, ease: "inOutQuart" });
        });

      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();
      const ndc = new THREE.Vector2();

      return {
        resize(w, h) {
          u.uPR.value = renderer.getPixelRatio();
          const tan = Math.tan(((camera.fov / 2) * Math.PI) / 180);
          // Phones: let the glyph fill more of its band, and sit it a little high in it.
          const phone = window.matchMedia("(max-width: 639px)").matches;
          const fit = phone ? 0.95 : 0.8;
          group.position.y = phone ? { privacy: 0.05, terms: 0.02, help: 0.15 }[glyph] : 0;
          // The question mark is tall and narrow, so it reads small next to the others: scale it up.
          group.scale.setScalar(glyph === "help" ? 1.15 : 1);
          const dist = Math.max(4.6 / fit, 4.6 / ((w / h) * fit)) / (2 * tan);
          camera.position.set(0, 0, dist);
          camera.lookAt(0, 0, 0);
          u.uSize.value = 26 * (9 / dist) * Math.min(1.3, Math.max(0.75, h / 420));
        },
        frame(t) {
          u.uTime.value = t;
          ndc.set(pointer.x, pointer.y);
          ray.setFromCamera(ndc, camera);
          if (pointer.inside && ray.ray.intersectPlane(plane, hit)) u.uMouse.value.set(hit.x, hit.y);
          u.uMouseK.value += ((pointer.inside ? 1 : 0) - u.uMouseK.value) * 0.06;
          const tx = pointer.inside ? pointer.x * 0.45 : Math.sin(t * 0.3) * 0.18;
          const ty = pointer.inside ? -pointer.y * 0.25 : Math.sin(t * 0.21) * 0.06;
          group.rotation.y += (tx - group.rotation.y) * 0.05;
          group.rotation.x += (ty - group.rotation.x) * 0.05;
        },
        dispose() {
          intro?.cancel();
        },
      };
    },
    { fov: 35 },
  );

  return <div ref={ref} aria-hidden="true" className={className} />;
}
