"use client";

import type * as T from "three";
import { useThreeScene } from "@/lib/useThreeScene";
import { canvasDpr } from "@/lib/random";
import { SCAN_EVENT } from "@/lib/scan";

const ROWS = 24;
/** Grid width per layout. Phones get the short word on fewer columns, so each pin is bigger. */
const COLS_WIDE = 116;
const COLS_NARROW = 76;
const WIDE = "(min-width: 640px)";

const SCAN_TIME = 1.3;
/** Scan on our own if the dot field hasn't handed one over in this long (it may be off screen). */
const SCAN_FALLBACK = 10;

/** Rasterise the word and sample it on a cols×ROWS grid. */
function sampleWord(text: string, family: string, cols: number) {
  const cell = 10;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = ROWS * cell;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const fit = (size: number) => {
    ctx.font = `900 ${size}px ${family}`;
    return ctx.measureText(text);
  };
  let size = 200;
  let m = fit(size);
  size = Math.min((size * canvas.width * 0.97) / m.width, canvas.height * 1.18);
  m = fit(size);
  const capH = m.actualBoundingBoxAscent;
  ctx.fillStyle = "#000";
  ctx.fillText(text, (canvas.width - m.width) / 2, (canvas.height + capH) / 2);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const on: boolean[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < cols; c++) {
      const x = Math.floor((c + 0.5) * cell);
      const y = Math.floor((r + 0.5) * cell);
      on.push(data[(y * canvas.width + x) * 4 + 3] > 120);
    }
  return on;
}

type Cell = { x: number; y: number; h: number; heat: number; intro: number };

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * The wordmark as a field of 3D pins. On first view anime.js raises the pins
 * from the centre out. A scan bar then sweeps down the word whenever the dot
 * field above hands one down: pins under it spike and run white-hot, each
 * with a soft additive halo at its tip. Pins also rise toward the pointer, and
 * the whole word tilts after it.
 */
export function PinWordmark({ text = "KEROSOP", short = "KERO" }: { text?: string; short?: string }) {
  const ref = useThreeScene(
    ({ THREE, scene, camera, host, pointer, reduced }) => {
      const family = getComputedStyle(host).fontFamily || "sans-serif";
      const pinGeo = new THREE.CylinderGeometry(0.34, 0.34, 1, 16, 1);
      pinGeo.rotateX(Math.PI / 2);
      pinGeo.translate(0, 0, 0.5);

      // Per-pin heat drives an emissive term on top of the lit colour.
      const pinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.1 });
      pinMat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute float aHeat;\nvarying float vHeat;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHeat = aHeat;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vHeat;")
          .replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\ntotalEmissiveRadiance += mix(vec3(0.89, 0.02, 0.07), vec3(1.0), vHeat) * vHeat * vHeat * 1.3;",
          );
      };

      scene.add(new THREE.HemisphereLight(0xffffff, 0x2a0000, 1.4));
      const sun = new THREE.DirectionalLight(0xffffff, 2.6);
      sun.position.set(-40, 60, 80);
      scene.add(sun);

      // Halos: one point sprite per pin at its tip, sized and faded by heat, added on top.
      // (A full-frame bloom pass hazed the whole canvas and showed its edges on the black footer.)
      const glowMat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1 } },
        vertexShader: `
          attribute float aHeat;
          uniform float uScale;
          varying float vHeat;
          void main() {
            vHeat = aHeat;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aHeat * 3.4 * uScale / -mv.z;
          }`,
        fragmentShader: `
          varying float vHeat;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = pow(max(0.0, 1.0 - d), 2.4) * vHeat;
            gl_FragColor = vec4(mix(vec3(0.89, 0.02, 0.07), vec3(1.0), vHeat * 0.7) * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const group = new THREE.Group();
      scene.add(group);
      let pins: T.InstancedMesh | null = null;
      let heatAttr: T.InstancedBufferAttribute | null = null;
      let glow: T.Points | null = null;
      let glowHeat: T.BufferAttribute | null = null;
      let cells: Cell[] = [];
      const dummy = new THREE.Object3D();
      const red = new THREE.Color(0xe30613);
      const white = new THREE.Color(0xffffff);
      const tint = new THREE.Color();
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();
      const ndc = new THREE.Vector2();
      let strength = 0;
      const wide = window.matchMedia(WIDE);
      let isWide = wide.matches;
      let cols = isWide ? COLS_WIDE : COLS_NARROW;

      // Pins lie flat until the intro plays, and again once the word leaves the screen; with reduced motion they stay up.
      let introPlayed = reduced;
      let introDone = reduced;

      const build = () => {
        isWide = wide.matches;
        cols = isWide ? COLS_WIDE : COLS_NARROW;
        const on = sampleWord(isWide ? text : short, family, cols);
        if (pins) {
          group.remove(pins);
          pins.dispose();
        }
        if (glow) {
          group.remove(glow);
          glow.geometry.dispose();
        }
        const lit: Cell[] = [];
        on.forEach((v, i) => {
          if (!v) return;
          const c = i % cols;
          const r = Math.floor(i / cols);
          lit.push({ x: c - (cols - 1) / 2, y: (ROWS - 1) / 2 - r, h: 0.8, heat: 0, intro: introPlayed ? 1 : 0 });
        });
        cells = lit;
        const n = Math.max(1, lit.length);
        heatAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
        heatAttr.setUsage(THREE.DynamicDrawUsage);
        pinGeo.setAttribute("aHeat", heatAttr);
        pins = new THREE.InstancedMesh(pinGeo, pinMat, n);
        for (let i = 0; i < n; i++) pins.setColorAt(i, red);
        group.add(pins);
        const glowGeo = new THREE.BufferGeometry();
        glowGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
        // Same heat values, but as a plain per-vertex attribute: an instanced one gives
        // every point instance 0's heat, so all halos flashed when the first pin lit.
        glowHeat = new THREE.BufferAttribute(heatAttr.array, 1).setUsage(THREE.DynamicDrawUsage);
        glowGeo.setAttribute("aHeat", glowHeat);
        glow = new THREE.Points(glowGeo, glowMat);
        glow.frustumCulled = false;
        group.add(glow);
      };

      build();
      document.fonts?.ready.then(build);

      // anime.js raises the pins from the centre out each time the word scrolls into view.
      // Once it is fully off screen they drop flat again, ready to replay on the way back.
      let intro: { cancel(): unknown } | null = null;
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) {
            intro?.cancel();
            intro = null;
            introPlayed = false;
            introDone = false;
            cells.forEach((c) => (c.intro = 0));
            return;
          }
          if (introPlayed || entry.intersectionRatio < 0.35) return;
          introPlayed = true;
          import("animejs").then(({ animate }) => {
            if (!introPlayed) return; // scrolled away before anime.js loaded
            const targets = cells;
            intro = animate(targets, {
              intro: [0, 1],
              duration: 950,
              ease: "outBack(2.4)",
              delay: (_?: unknown, i = 0) => Math.hypot(targets[i].x, targets[i].y * 1.6) * 13 + Math.random() * 90,
              onComplete: () => {
                introDone = true;
                scan.start = now + 0.3;
              },
            });
          });
        },
        { threshold: [0, 0.35] },
      );
      if (!reduced) io.observe(host);

      // The scan bar: handed down by the dot field, or started here if it hasn't come in a while.
      let now = 0;
      const scan = { start: -1e3 };
      const onScan = () => {
        if (introDone && now - scan.start > SCAN_TIME) scan.start = now;
      };
      window.addEventListener(SCAN_EVENT, onScan);

      return {
        resize(w, h) {
          if (wide.matches !== isWide) build();
          const vHalf = Math.tan(((camera.fov / 2) * Math.PI) / 180);
          // World units to point-sprite pixels at unit depth, in device pixels.
          glowMat.uniforms.uScale.value = (h * canvasDpr()) / (2 * vHalf);
          const dist = Math.max((cols + 2) / 2 / (vHalf * (w / h)), (ROWS + 4) / 2 / vHalf);
          camera.position.set(0, -ROWS * 0.55, dist);
          camera.lookAt(0, -1, 0);
        },
        frame(t) {
          if (!pins || !heatAttr || !glow || !glowHeat) return;
          const tips = glow.geometry.getAttribute("position") as T.BufferAttribute;
          now = t;
          if (!reduced && introDone && t - scan.start > SCAN_FALLBACK) scan.start = t;

          strength += ((pointer.inside ? 1 : 0) - strength) * 0.08;
          ndc.set(pointer.x, pointer.y);
          ray.setFromCamera(ndc, camera);
          ray.ray.intersectPlane(plane, hit);

          // The word leans a touch toward the pointer.
          const tiltY = reduced ? 0 : pointer.x * strength * 0.05;
          const tiltX = reduced ? 0 : -pointer.y * strength * 0.08;
          group.rotation.y += (tiltY - group.rotation.y) * 0.06;
          group.rotation.x += (tiltX - group.rotation.x) * 0.06;

          const sp = (t - scan.start) / SCAN_TIME;
          const scanning = !reduced && sp >= 0 && sp <= 1;
          // Top to bottom, carrying on the dot field's line from above.
          const edge = ROWS / 2 + 4;
          const scanY = edge - smooth(Math.min(1, Math.max(0, sp))) * edge * 2;

          cells.forEach((cell, i) => {
            const dx = cell.x - hit.x;
            const dy = cell.y - hit.y;
            const bump = strength * Math.exp(-(dx * dx + dy * dy) / 40);
            const sy = cell.y - scanY;
            const sweep = scanning ? Math.exp(-(sy * sy) / 3) : 0;
            const swell = reduced ? 0 : 0.45 * (0.5 + 0.5 * Math.sin(t * 1.5 - cell.x * 0.09 + cell.y * 0.18));
            const target = 0.8 + swell + bump * 4.2 + sweep * 2.8;
            cell.h += (target - cell.h) * (reduced ? 1 : 0.16);

            // Heat flares fast and cools slowly, leaving a trail behind the scan bar.
            const hot = Math.max(sweep, bump * 0.85);
            cell.heat += (hot - cell.heat) * (hot > cell.heat ? 0.4 : 0.1);
            heatAttr!.setX(i, cell.heat);
            tint.copy(red).lerp(white, cell.heat * cell.heat);
            pins!.setColorAt(i, tint);

            const k = Math.max(0, cell.intro);
            const s = Math.max(0.001, Math.min(1, k * 1.5));
            dummy.position.set(cell.x, cell.y, (1 - Math.min(1, k)) * -6);
            dummy.scale.set(s, s, Math.max(0.001, cell.h * k));
            dummy.updateMatrix();
            pins!.setMatrixAt(i, dummy.matrix);
            tips.setXYZ(i, cell.x, cell.y, dummy.position.z + cell.h * k + 0.15);
          });
          pins.instanceMatrix.needsUpdate = true;
          if (pins.instanceColor) pins.instanceColor.needsUpdate = true;
          heatAttr.needsUpdate = true;
          glowHeat.needsUpdate = true;
          tips.needsUpdate = true;
        },
        dispose() {
          io.disconnect();
          intro?.cancel();
          window.removeEventListener(SCAN_EVENT, onScan);
        },
      };
    },
    { fov: 24, clear: 0x000000 },
  );

  return <div ref={ref} className="aspect-[76/30] w-full sm:aspect-[116/30]" />;
}
