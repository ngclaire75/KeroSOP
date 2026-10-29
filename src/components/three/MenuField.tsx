"use client";

import type { RefObject } from "react";
import { useThreeScene } from "@/lib/useThreeScene";

const VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec2 uRes;
uniform vec2 uOrigin;
uniform vec2 uPointer;
uniform float uStrength;
uniform float uReveal;
uniform float uTime;
uniform float uDpr;

void main() {
  float cell = 15.0 * uDpr;
  vec2 c = (floor(gl_FragCoord.xy / cell) + 0.5) * cell;
  vec2 f = gl_FragCoord.xy - c;
  vec2 uv = c / uRes.y;

  // Slow interference current across the grid.
  float n = sin(uv.x * 3.1 + uTime * 0.45) * sin(uv.y * 4.3 - uTime * 0.32)
          + 0.5 * sin((uv.x + uv.y) * 7.0 + uTime * 0.7);

  // The finger sends rings through the dots.
  float d = distance(c, uPointer) / uDpr;
  float ripple = uStrength * exp(-d * d / 26000.0) * (0.55 + 0.45 * cos(d / 16.0 - uTime * 6.0));

  // Reveal: a front of dots sweeps out from the menu button.
  float rev = distance(c, uOrigin) / length(uRes);
  float inside = smoothstep(uReveal, uReveal - 0.1, rev);
  float front = exp(-pow((rev - uReveal) * 12.0, 2.0)) * step(0.001, uReveal);

  float r = cell * (0.07 + 0.09 * (n * 0.25 + 0.5)) + cell * 0.3 * ripple + cell * 0.32 * front;
  r *= max(inside, front);
  float a = smoothstep(r, r - 1.2 * uDpr, length(f));

  float heat = clamp(ripple * 1.5 + front + smoothstep(0.85, 1.4, n) * 0.7, 0.0, 1.0);
  vec3 col = mix(vec3(0.2), vec3(0.89, 0.024, 0.075), heat);
  gl_FragColor = vec4(col, a);
}
`;

/**
 * Backdrop for the mobile menu: a full-screen dot matrix (three.js shader).
 * It sweeps in from the menu button, drifts on a slow current, and ripples
 * red wherever a finger moves. `closing` reverses the sweep.
 */
export function MenuField({ closing, className = "" }: { closing: RefObject<boolean>; className?: string }) {
  const ref = useThreeScene(({ THREE, scene, renderer, host, pointer, reduced }) => {
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uOrigin: { value: new THREE.Vector2(0, 0) },
      uPointer: { value: new THREE.Vector2(-1e4, -1e4) },
      uStrength: { value: 0 },
      uReveal: { value: reduced ? 1.3 : 0 },
      uTime: { value: 0 },
      uDpr: { value: renderer.getPixelRatio() },
    };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        transparent: true,
      }),
    );
    mesh.frustumCulled = false;
    scene.add(mesh);

    let w = host.clientWidth;
    let h = host.clientHeight;
    const target = { x: -1e4, y: -1e4 };
    const smooth = { x: -1e4, y: -1e4 };
    // Rings fade once the finger lifts.
    const lift = () => (pointer.inside = false);
    window.addEventListener("touchend", lift, { passive: true });

    return {
      resize(nw, nh) {
        w = nw;
        h = nh;
        const dpr = renderer.getPixelRatio();
        uniforms.uDpr.value = dpr;
        uniforms.uRes.value.set(w * dpr, h * dpr);
        // The menu button sits 26px from the right edge, 34px from the top.
        uniforms.uOrigin.value.set((w - 26) * dpr, (h - 34) * dpr);
      },
      frame(t, dt) {
        const dpr = renderer.getPixelRatio();
        uniforms.uTime.value = t;
        if (!reduced) {
          const goal = closing.current ? 0 : 1.3;
          uniforms.uReveal.value += (goal - uniforms.uReveal.value) * Math.min(1, dt * (closing.current ? 7 : 3.2));
        }
        if (pointer.inside) {
          target.x = (pointer.x * 0.5 + 0.5) * w * dpr;
          target.y = (pointer.y * 0.5 + 0.5) * h * dpr;
          if (smooth.x < -1e3) Object.assign(smooth, target);
        }
        smooth.x += (target.x - smooth.x) * Math.min(1, dt * 10);
        smooth.y += (target.y - smooth.y) * Math.min(1, dt * 10);
        uniforms.uPointer.value.set(smooth.x, smooth.y);
        const want = pointer.inside ? 1 : 0;
        uniforms.uStrength.value += (want - uniforms.uStrength.value) * Math.min(1, dt * 4);
      },
      dispose() {
        window.removeEventListener("touchend", lift);
      },
    };
  });

  return <div ref={ref} className={className} />;
}
