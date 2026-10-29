"use client";

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";
import { canvasDpr, prefersReducedMotion } from "@/lib/random";

export type Three = typeof THREE_NS;

/** Pointer position relative to the host, normalised to -1..1 (y up). */
export type Pointer = { x: number; y: number; inside: boolean };

export type SceneApi = {
  THREE: Three;
  renderer: THREE_NS.WebGLRenderer;
  scene: THREE_NS.Scene;
  camera: THREE_NS.PerspectiveCamera;
  host: HTMLDivElement;
  pointer: Pointer;
  reduced: boolean;
};

export type SceneHooks = {
  /** Called every frame. `t` is seconds the scene has been on screen. */
  frame(t: number, dt: number): void;
  resize?(w: number, h: number): void;
  dispose?(): void;
};

type Options = { fov?: number; clear?: number; dpr?: number };

/**
 * Lazily loads three.js and runs a scene inside the returned host element.
 * The loop only runs while the host is on screen; with reduced motion the
 * scene renders its final frame once and stays still.
 */
export function useThreeScene(build: (api: SceneApi) => SceneHooks, options: Options = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const buildRef = useRef(build);
  const optionsRef = useRef(options);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cancelled = false;
    let teardown = () => {};

    import("three").then((THREE) => {
      if (cancelled) return;
      const opts = optionsRef.current;
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: opts.clear === undefined,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(canvasDpr(opts.dpr ?? 2));
      renderer.setClearColor(opts.clear ?? 0x000000, opts.clear === undefined ? 0 : 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const canvas = renderer.domElement;
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "display:block;width:100%;height:100%";
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.1, 200);
      const pointer: Pointer = { x: 0, y: 0, inside: false };
      const reduced = prefersReducedMotion();
      const hooks = buildRef.current({ THREE, renderer, scene, camera, host, pointer, reduced });

      const setSize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        hooks.resize?.(w, h);
      };

      const onMove = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
        pointer.inside = Math.abs(pointer.x) <= 1 && Math.abs(pointer.y) <= 1;
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      // touchHover sends this (untrusted) a beat after the finger lifts: let the scene settle.
      const onRelease = (e: PointerEvent) => {
        if (!e.isTrusted && e.pointerType === "touch") pointer.inside = false;
      };
      document.documentElement.addEventListener("pointerleave", onRelease);

      let raf = 0;
      let t = 0;
      let last = 0;
      const draw = (dt: number) => {
        hooks.frame(reduced ? 1000 : t, dt);
        renderer.render(scene, camera);
      };
      const loop = (now: number) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        t += dt;
        draw(dt);
        raf = requestAnimationFrame(loop);
      };
      const start = () => {
        if (raf || reduced) return;
        last = 0;
        raf = requestAnimationFrame(loop);
      };
      const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };

      const ro = new ResizeObserver(() => {
        setSize();
        if (!raf) draw(0);
      });
      ro.observe(host);

      const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
        rootMargin: "120px",
      });
      io.observe(host);

      setSize();
      draw(0);

      teardown = () => {
        stop();
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("pointerleave", onRelease);
        hooks.dispose?.();
        scene.traverse((obj) => {
          const mesh = obj as THREE_NS.Mesh;
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE_NS.Material | THREE_NS.Material[] | undefined;
          (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => {
            (m as THREE_NS.MeshBasicMaterial).map?.dispose();
            m.dispose();
          });
        });
        renderer.dispose();
        canvas.remove();
      };
    });

    return () => {
      cancelled = true;
      teardown();
    };
  }, []);

  return ref;
}

export const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
export const easeOutExpo = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c === 1 ? 1 : 1 - Math.pow(2, -10 * c);
};
