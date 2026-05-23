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
    const count = 800;
    for (let i = 0; i < count; i++) {
      const radius = 20 + Math.random() * 25;
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

  const orbitRadii = [3.2, 4.4, 5.6, 6.8, 8.0];
  const selectedRingIndex = selectedAsteroid !== null ? selectedAsteroid.ringIndex : null;

  return (
    <>
      {/* Cinematic Pitch-black ambient space shading */}
      <ambientLight intensity={0.06} />
      
      {/* Strong directional sunlight source to cast rugged basalt shadows */}
      <directionalLight
        position={[6, 8, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      
      {/* Subtle blue/cyan rim accent light from behind Earth */}
      <directionalLight
        position={[-8, -4, -6]}
        color="#38bdf8"
        intensity={0.65}
      />

      {/* Dim space starfieldPoints */}
      <points geometry={starsGeometry}>
        <pointsMaterial
          color="#f8fafc" // Slate 50 white
          size={0.035}
          sizeAttenuation={true}
          transparent={true}
          opacity={0.22}
          depthWrite={false}
        />
      </points>

      {/* Realistic Concentric Earth Globe System */}
      <EarthSystem />

      {/* Concentric Golden Orbit Paths */}
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

      {/* Trajectory Intercept Laser Vector */}
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
    <div className="w-full h-full absolute inset-0 z-0 bg-black">
      <Canvas
        shadows
        camera={{
          position: [0, 3.5, 8.5],
          fov: 43,
          up: [0, 1, 0],
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
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
