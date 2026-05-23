"use client";

import { Suspense, useMemo } from "react";
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
      {/* Cinematic ambient space shading for base illumination on all sides */}
      <ambientLight intensity={0.45} />

      {/* Primary strong sunlight pointing from top-left-front */}
      <directionalLight
        position={[-2, 0.5, 1.5]}
        intensity={4.0}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Secondary fill light pointing from the opposite side (bottom-right-back) */}
      <directionalLight
        position={[2, -0.5, -1.5]}
        intensity={1.5}
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
