"use client";

import type * as T from "three";
import { useThreeScene } from "@/lib/useThreeScene";

const ROWS = 24;
/** Grid width per layout. Phones get the short word on fewer columns, so each pin is bigger. */
const COLS_WIDE = 116;
const COLS_NARROW = 76;
const WIDE = "(min-width: 640px)";

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

/**
 * The wordmark as a field of 3D pins. Pins rise toward the pointer and a slow
 * swell rolls across them.
 */
export function PinWordmark({ text = "KEROSOP", short = "KERO" }: { text?: string; short?: string }) {
  const ref = useThreeScene(
    ({ THREE, scene, camera, host, pointer, reduced }) => {
      const family = getComputedStyle(host).fontFamily || "sans-serif";
      const pinGeo = new THREE.CylinderGeometry(0.34, 0.34, 1, 16, 1);
      pinGeo.rotateX(Math.PI / 2);
      pinGeo.translate(0, 0, 0.5);
      const pinMat = new THREE.MeshStandardMaterial({ color: 0xe30613, roughness: 0.42, metalness: 0.08 });

      scene.add(new THREE.HemisphereLight(0xffffff, 0x2a0000, 1.4));
      const sun = new THREE.DirectionalLight(0xffffff, 2.6);
      sun.position.set(-40, 60, 80);
      scene.add(sun);

      const group = new THREE.Group();
      scene.add(group);
      let pins: T.InstancedMesh | null = null;
      let cells: { x: number; y: number; h: number }[] = [];
      const dummy = new THREE.Object3D();
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();
      const ndc = new THREE.Vector2();
      let strength = 0;
      const wide = window.matchMedia(WIDE);
      let isWide = wide.matches;
      let cols = isWide ? COLS_WIDE : COLS_NARROW;

      const build = () => {
        isWide = wide.matches;
        cols = isWide ? COLS_WIDE : COLS_NARROW;
        const on = sampleWord(isWide ? text : short, family, cols);
        if (pins) group.remove(pins);
        const lit: { x: number; y: number; h: number }[] = [];
        on.forEach((v, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const p = { x: c - (cols - 1) / 2, y: (ROWS - 1) / 2 - r };
          if (v) lit.push({ ...p, h: 0.8 });
        });
        cells = lit;
        pins = new THREE.InstancedMesh(pinGeo, pinMat, Math.max(1, lit.length));
        group.add(pins);
      };

      build();
      document.fonts?.ready.then(build);

      return {
        resize(w, h) {
          if (wide.matches !== isWide) build();
          const vHalf = Math.tan(((camera.fov / 2) * Math.PI) / 180);
          const dist = Math.max((cols + 2) / 2 / (vHalf * (w / h)), (ROWS + 4) / 2 / vHalf);
          camera.position.set(0, -ROWS * 0.55, dist);
          camera.lookAt(0, -1, 0);
        },
        frame(t) {
          if (!pins) return;
          strength += ((pointer.inside ? 1 : 0) - strength) * 0.08;
          ndc.set(pointer.x, pointer.y);
          ray.setFromCamera(ndc, camera);
          ray.ray.intersectPlane(plane, hit);

          cells.forEach((cell, i) => {
            const dx = cell.x - hit.x;
            const dy = cell.y - hit.y;
            const bump = strength * 4.2 * Math.exp(-(dx * dx + dy * dy) / 40);
            const swell = reduced ? 0 : 0.45 * (0.5 + 0.5 * Math.sin(t * 1.5 - cell.x * 0.09 + cell.y * 0.18));
            const target = 0.8 + swell + bump;
            cell.h += (target - cell.h) * (reduced ? 1 : 0.14);
            dummy.position.set(cell.x, cell.y, 0);
            dummy.scale.set(1, 1, cell.h);
            dummy.updateMatrix();
            pins!.setMatrixAt(i, dummy.matrix);
          });
          pins.instanceMatrix.needsUpdate = true;
        },
      };
    },
    { fov: 24, clear: 0x000000 },
  );

  return <div ref={ref} className="aspect-[76/30] w-full sm:aspect-[116/30]" />;
}
