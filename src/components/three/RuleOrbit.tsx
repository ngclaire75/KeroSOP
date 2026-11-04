"use client";

import { useRef } from "react";
import { useThreeScene } from "@/lib/useThreeScene";
import { mulberry32 } from "@/lib/random";

/** One rule on its topic's orbit; hot rules are cited by an open finding. */
export type OrbitRule = { id: string; topic: number; hot: boolean };

const RING_VERT = /* glsl */ `
attribute float aRadius;
attribute float aAngle;
attribute float aSpeed;
uniform float uTime;
uniform float uPixelRatio;
varying float vFade;
void main() {
  float a = aAngle + uTime * aSpeed;
  vec3 p = vec3(cos(a) * aRadius, sin(a * 3.0 + aRadius) * 0.035, sin(a) * aRadius);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 2.6 * uPixelRatio * (8.0 / -mv.z);
  vFade = smoothstep(15.0, 5.0, -mv.z);
}
`;
const RING_FRAG = /* glsl */ `
varying float vFade;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, 0.38 * vFade * smoothstep(0.5, 0.2, r));
}
`;
const NODE_VERT = /* glsl */ `
attribute float aHot;
uniform float uTime;
uniform float uPixelRatio;
varying float vHot;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float pulse = aHot * (0.5 + 0.5 * sin(uTime * 2.4 + position.x * 3.0));
  gl_PointSize = (6.0 + aHot * 4.0 + pulse * 5.0) * uPixelRatio * (8.0 / -mv.z);
  vHot = aHot;
}
`;
const NODE_FRAG = /* glsl */ `
varying float vHot;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float core = smoothstep(0.5, 0.18, r);
  vec3 c = mix(vec3(1.0), vec3(0.89, 0.024, 0.075), vHot);
  gl_FragColor = vec4(c, core);
}
`;

/**
 * The rule registry as orbits: one tilted ring of fine particles per topic,
 * each rule a bright node riding its ring. Rules cited by an open finding
 * glow red and are joined by red arcs to the rules they conflict with.
 */
export function RuleOrbit({ rules, links, topics }: { rules: OrbitRule[]; links: [number, number][]; topics: number }) {
  const data = useRef({ rules, links, topics });
  const ref = useThreeScene(
    ({ THREE, scene, camera, renderer, pointer }) => {
      const { rules, links, topics } = data.current;
      const T = Math.max(1, topics);
      const radius = (k: number) => 0.8 + k * (1.8 / Math.max(1, T - 1));
      const speed = (k: number) => (k % 2 ? -1 : 1) * (0.11 / (1 + k * 0.45));
      const group = new THREE.Group();
      scene.add(group);
      const pr = renderer.getPixelRatio();

      // rings of fine particles
      const PER = 360;
      const rnd = mulberry32(11);
      const rad = new Float32Array(T * PER);
      const ang = new Float32Array(T * PER);
      const spd = new Float32Array(T * PER);
      for (let k = 0; k < T; k++)
        for (let i = 0; i < PER; i++) {
          const j = k * PER + i;
          rad[j] = radius(k) + (rnd() - 0.5) * 0.06;
          ang[j] = (i / PER) * Math.PI * 2 + rnd() * 0.02;
          spd[j] = speed(k);
        }
      const ringGeo = new THREE.BufferGeometry();
      ringGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(T * PER * 3), 3));
      ringGeo.setAttribute("aRadius", new THREE.BufferAttribute(rad, 1));
      ringGeo.setAttribute("aAngle", new THREE.BufferAttribute(ang, 1));
      ringGeo.setAttribute("aSpeed", new THREE.BufferAttribute(spd, 1));
      ringGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
      const uniforms = { uTime: { value: 0 }, uPixelRatio: { value: pr } };
      group.add(
        new THREE.Points(
          ringGeo,
          new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms, transparent: true, depthWrite: false }),
        ),
      );

      // rule nodes, spread evenly round their ring
      const perTopic = new Map<number, number>();
      const start = rules.map((r) => {
        const n = perTopic.get(r.topic) ?? 0;
        perTopic.set(r.topic, n + 1);
        return n;
      });
      const count = (k: number) => perTopic.get(k) ?? 1;
      const nodePos = new Float32Array(rules.length * 3);
      const hot = new Float32Array(rules.map((r) => (r.hot ? 1 : 0)));
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
      nodeGeo.setAttribute("aHot", new THREE.BufferAttribute(hot, 1));
      nodeGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
      group.add(
        new THREE.Points(
          nodeGeo,
          new THREE.ShaderMaterial({ vertexShader: NODE_VERT, fragmentShader: NODE_FRAG, uniforms, transparent: true, depthWrite: false }),
        ),
      );

      // conflict arcs, lifted above the plane so they read as bridges
      const SEG = 24;
      const linePos = new Float32Array(links.length * SEG * 2 * 3);
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
      lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
      group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xe30613, transparent: true, opacity: 0.7 })));

      const place = (t: number) => {
        rules.forEach((r, i) => {
          const a = (start[i] / count(r.topic)) * Math.PI * 2 + r.topic * 0.9 + t * speed(r.topic);
          const R = radius(r.topic);
          nodePos[i * 3] = Math.cos(a) * R;
          nodePos[i * 3 + 1] = 0;
          nodePos[i * 3 + 2] = Math.sin(a) * R;
        });
        nodeGeo.attributes.position.needsUpdate = true;
        let o = 0;
        for (const [a, b] of links) {
          const ax = nodePos[a * 3], az = nodePos[a * 3 + 2];
          const bx = nodePos[b * 3], bz = nodePos[b * 3 + 2];
          const lift = 0.25 + Math.hypot(ax - bx, az - bz) * 0.16;
          const pt = (s: number) => [ax + (bx - ax) * s, Math.sin(Math.PI * s) * lift, az + (bz - az) * s];
          for (let s = 0; s < SEG; s++) {
            const p = pt(s / SEG);
            const q = pt((s + 1) / SEG);
            linePos.set(p, o);
            linePos.set(q, o + 3);
            o += 6;
          }
        }
        lineGeo.attributes.position.needsUpdate = true;
      };

      let tiltX = 0.62;
      let tiltY = 0;
      return {
        resize(w, h) {
          // a tall card (phones) puts the rings under the numbers; a wide one beside them
          const narrow = h > w * 0.8;
          camera.position.set(0, 0, narrow ? 10.5 : 9);
          camera.lookAt(0, 0, 0);
          group.position.set(narrow ? 0.15 : 3.45, narrow ? -2.35 : 0.35, 0);
          group.scale.setScalar(narrow ? 1.1 : 1.25);
        },
        frame(t) {
          uniforms.uTime.value = t;
          place(t);
          tiltX += ((pointer.inside ? 0.62 - pointer.y * 0.18 : 0.62) - tiltX) * 0.05;
          tiltY += ((pointer.inside ? pointer.x * 0.35 : 0) - tiltY) * 0.05;
          group.rotation.set(tiltX, tiltY, -0.12);
        },
      };
    },
    { fov: 38 },
  );
  return <div ref={ref} aria-hidden="true" className="absolute inset-0" />;
}
