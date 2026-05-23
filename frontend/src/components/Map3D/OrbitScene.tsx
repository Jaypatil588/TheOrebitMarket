"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { EarthSystem } from "./EarthSystem";

import { OrbitPaths } from "./OrbitPaths";
import { AsteroidBelt, AsteroidData } from "./AsteroidBelt";
import { RouteLines } from "./RouteLines";
import { useCameraControls } from "@/hooks/useCameraControls";

interface OrbitSceneProps {
  selectedAsteroid: AsteroidData | null;
  onSelectAsteroid: (asteroid: AsteroidData | null) => void;
  hoveredRingIndex: number | null;
  onHoverRing: (ringIndex: number | null) => void;
}

// Inner scene wrapper to access Canvas context hooks (like useThree)
function SceneContent({
  selectedAsteroid,
  onSelectAsteroid,
  hoveredRingIndex,
  onHoverRing,
}: OrbitSceneProps) {
  // Execute smooth camera transitions & drift updates
  useCameraControls(selectedAsteroid);

  // SpotLight needs a real Object3D target — target-position prop doesn't work in R3F.
  // We create a dummy object3D placed at the center of the right-hand asteroid region and
  // pass it as the SpotLight's target so the cone genuinely aims there.
  const spotTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  const orbitRadii = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 50; i++) {
      arr.push(6.0 + i * 0.25);
    }
    return arr;
  }, []);
  const selectedRingIndex = selectedAsteroid !== null ? selectedAsteroid.ringIndex : null;

  return (
    <>
      {/* Base ambient fill — just enough so nothing is ever 100% black */}
      <ambientLight intensity={0.25} />

      {/* Hemisphere bounce light — simulates soft reflected light from Earth (blue sky) and deep space (dark ground) */}
      <hemisphereLight
        color="#1e3a5f"
        groundColor="#0a0a0a"
        intensity={0.6}
      />

      {/* Primary strong sunlight pointing from the general camera direction (top-left-front) */}
      <directionalLight
        position={[-8, 16, 24]}
        intensity={6.0}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Invisible target object that the SpotLight cone aims at.
          Positioned at the center of the right-hand asteroid belt region. */}
      <primitive object={spotTargetRef.current} position={[8, 4, 10]} />

      {/* Targeted SpotLight for the right-hand asteroid belt region only.
          Uses a real Object3D target ref so the cone genuinely points there. */}
      <spotLight
        position={[18, 25, 20]}
        target={spotTargetRef.current}
        angle={Math.PI / 5}
        penumbra={0.4}
        intensity={200}
        distance={80}
        decay={2}
      />

      {/* Realistic Concentric Earth Globe System */}
      <EarthSystem />

      {/* Concentric Orbit Paths */}
      <OrbitPaths
        radii={orbitRadii}
        hoveredRingIndex={hoveredRingIndex}
        selectedRingIndex={selectedRingIndex}
      />

      {/* Deformed Low-poly Asteroid Mesh Belt */}
      <AsteroidBelt
        radii={orbitRadii}
        selectedAsteroid={selectedAsteroid}
        onSelectAsteroid={onSelectAsteroid}
        onHoverRing={onHoverRing}
      />

      {/* Trajectory Route Line */}
      <RouteLines selectedAsteroid={selectedAsteroid} />
    </>
  );
}

export default function OrbitScene({
  selectedAsteroid,
  onSelectAsteroid,
  hoveredRingIndex,
  onHoverRing,
}: OrbitSceneProps) {
  return (
    <div className="w-full h-screen sticky top-0 z-0 bg-black">
      <Canvas
        shadows
        camera={{
          position: [-6, 10, 19],
          fov: 55,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <SceneContent
            selectedAsteroid={selectedAsteroid}
            onSelectAsteroid={onSelectAsteroid}
            hoveredRingIndex={hoveredRingIndex}
            onHoverRing={onHoverRing}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
export type UseOrbitSceneReturn = ReturnType<typeof OrbitScene>;
