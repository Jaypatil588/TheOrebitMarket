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

  // Generate standard 800-particle starry vector field
  const starsGeometry = useMemo(() => {
    const coords: number[] = [];
    const count = 1200;
    for (let i = 0; i < count; i++) {
      const radius = 30 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      coords.push(x, y, z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3));
    return geo;
  }, []);

  const orbitRadii = [5.6, 6.1, 6.6, 7.1, 7.6];
  const selectedRingIndex = selectedAsteroid !== null ? selectedAsteroid.ringIndex : null;

  return (
    <>
      {/* Cinematic ambient space shading */}
      <ambientLight intensity={0.06} />

      {/* Bobby's exact sunlight: position=sunDirection, intensity=4.0 */}
      <directionalLight
        position={[-2, 0.5, 1.5]}
        intensity={4.0}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Dim space starfield */}
      <points geometry={starsGeometry}>
        <pointsMaterial
          color="#ffffff"
          size={0.03}
          sizeAttenuation={true}
          transparent={true}
          opacity={0.18}
          depthWrite={false}
        />
      </points>

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
          position: [0, 6, 14],
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
