"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { pose } from "@/lib/mascot-store";

const MODEL_URL = "/mascot/paraape.glb";
const DRACO_URL = "/draco/";

function Mascot() {
  const { scene } = useGLTF(MODEL_URL, DRACO_URL);
  const group = useRef<THREE.Group>(null);
  const pointer = useThree((s) => s.pointer);
  const viewport = useThree((s) => s.viewport);

  const { model, size } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.sub(box.getCenter(new THREE.Vector3()));
    return { model: clone, size: box.getSize(new THREE.Vector3()) };
  }, [scene]);

  // Leave headroom for sway and rotation so the canopy never clips.
  const fit = Math.min((viewport.width * 0.8) / size.x, (viewport.height * 0.82) / size.y);

  useEffect(() => {
    pose.ready = true;
  }, []);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;

    const t = clock.getElapsedTime();
    const idle = pose.reduced ? 0 : 1;
    const swayAmp = (0.22 * (1 - pose.descent) + 0.05) * idle;
    const shake = Math.sin(t * 38) * 0.09 * pose.jolt;

    const targetX = pose.x * viewport.width;
    const targetY =
      (1 - pose.descent) * viewport.height * 1.2 +
      pose.y * viewport.height +
      pose.dip * viewport.height +
      Math.sin(t * 1.1) * 0.05 * idle;
    const targetRotZ = Math.sin(t * 1.3) * swayAmp + shake;
    const targetRotY = pose.rotY + pointer.x * 0.35 * idle + Math.sin(t * 0.5) * 0.07 * idle;
    const targetRotX = -pointer.y * 0.14 * idle;

    const k = 1 - Math.pow(0.0015, delta);
    g.position.x = THREE.MathUtils.lerp(g.position.x, targetX, k);
    g.position.y = THREE.MathUtils.lerp(g.position.y, targetY, k);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, targetRotZ, k);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRotY, k * 0.6);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetRotX, k * 0.6);
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, pose.scale, k));
  });

  return (
    <group ref={group} position={[0, viewport.height * 1.2, 0]}>
      <primitive object={model} scale={fit} />
    </group>
  );
}

function ProgressBridge() {
  const { progress } = useProgress();
  useEffect(() => {
    pose.progress = progress;
  }, [progress]);
  return null;
}

export default function MascotCanvas() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 4.6], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <ambientLight intensity={1.25} />
      <directionalLight position={[3, 4, 5]} intensity={2.1} color="#fff6ee" />
      <directionalLight position={[-4, 1, -3]} intensity={1.3} color="#ff641c" />
      <directionalLight position={[0, -3, 2]} intensity={0.4} />
      <ProgressBridge />
      <Suspense fallback={null}>
        <Mascot />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL, DRACO_URL);
