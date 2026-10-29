"use client";

import { useThreeScene } from "@/lib/useThreeScene";

const VERT = /* glsl */ `
uniform float uTime;
uniform vec2 uMouse;
uniform float uStrength;
uniform float uSize;
uniform float uPixelRatio;
varying float vDepth;
varying float vHeight;

void main() {
  vec3 p = position;
  float h = sin(p.x * 0.32 + uTime * 0.7) * 0.38
          + sin(p.z * 0.46 - uTime * 0.55) * 0.32
          + sin((p.x + p.z) * 0.17 + uTime * 0.35) * 0.55;
  float d = distance(p.xz, uMouse);
  h += uStrength * 1.5 * exp(-d * d / 7.0) * cos(d * 1.6 - uTime * 4.0);
  p.y = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (1.0 + max(h, 0.0) * 0.35) * (9.0 / -mv.z);
  vDepth = -mv.z;
  vHeight = h;
}
`;

const FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uAxis;
varying float vDepth;
varying float vHeight;

void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float edge = smoothstep(0.5, 0.4, r);
  float far = 1.0 - smoothstep(9.0, 26.0, vDepth);
  vec2 uv = gl_FragCoord.xy / uRes;
  // Keep the copy side calm: right side on wide screens, bottom on narrow ones.
  float mask = mix(smoothstep(0.18, 0.7, uv.x), smoothstep(0.5, 0.08, uv.y), uAxis);
  gl_FragColor = vec4(vec3(0.0), edge * far * mask);
}
`;

/** A 3D field of dots rolling like a slow sea. The pointer sends ripples through it. */
export function DotTerrain() {
  const ref = useThreeScene(
    ({ THREE, scene, camera, renderer, pointer }) => {
      const NX = 150;
      const NZ = 70;
      const S = 0.32;
      const positions = new Float32Array(NX * NZ * 3);
      for (let z = 0; z < NZ; z++)
        for (let x = 0; x < NX; x++) {
          const i = (z * NX + x) * 3;
          positions[i] = (x - NX / 2) * S;
          positions[i + 1] = 0;
          positions[i + 2] = 3 - z * S;
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(999, 999) },
        uStrength: { value: 0 },
        uSize: { value: 5.2 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uRes: { value: new THREE.Vector2(1, 1) },
        uAxis: { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        transparent: true,
        depthWrite: false,
      });
      scene.add(new THREE.Points(geo, mat));

      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      const ndc = new THREE.Vector2();
      const size = new THREE.Vector2();

      return {
        resize(w) {
          renderer.getDrawingBufferSize(size);
          uniforms.uRes.value.copy(size);
          const narrow = w < 768;
          uniforms.uAxis.value = narrow ? 1 : 0;
          // Phones look further down so the field runs all the way to the bottom edge,
          // under the buttons where a thumb lands.
          if (narrow) {
            camera.position.set(0, 4.2, 5.5);
            camera.lookAt(0, -0.4, -5);
          } else {
            camera.position.set(-1, 3.4, 8);
            camera.lookAt(2.5, -0.4, -4);
          }
        },
        frame(t) {
          uniforms.uTime.value = t;
          ndc.set(pointer.x, pointer.y);
          ray.setFromCamera(ndc, camera);
          if (pointer.inside && ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.set(hit.x, hit.z);
          uniforms.uStrength.value += ((pointer.inside ? 1 : 0) - uniforms.uStrength.value) * 0.05;
        },
      };
    },
    { fov: 42 },
  );

  return <div ref={ref} className="absolute inset-0" />;
}
