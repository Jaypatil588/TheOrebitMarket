"use client";

import { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { EarthSystem } from "./EarthSystem";
import { OrbitPaths } from "./OrbitPaths";
import { AsteroidBelt, AsteroidData } from "./AsteroidBelt";
import { RouteLines } from "./RouteLines";
import { useCameraControls } from "@/hooks/useCameraControls";
import { MissionRoute } from "@/hooks/useWebSockets";

// ─── Toggle to true to render the shadow camera frustum wireframe in the browser ───
const DEBUG_SHADOW_CAMERA = false;

// ─── Constants matching EarthSystem.tsx ────────────────────────────────────────────
// Earth center in world space — must stay in sync with EarthSystem.tsx earthCenter
const EARTH_CENTER = new THREE.Vector3(-6, 4, 5);

// Raw sun direction from EarthShader uniform (direction FROM surface TO sun).
// We position the Three.js DirectionalLight along this exact vector so the shadow
// terminator on Earth's mesh aligns with the visual day/night boundary in the shader.
const RAW_SUN_DIR = new THREE.Vector3(-2, 0.5, 1.5);
const SUN_UNIT = RAW_SUN_DIR.clone().normalize();

// Place the sun 55 units along the sun direction from Earth center
const SUN_POSITION = new THREE.Vector3(
  EARTH_CENTER.x + SUN_UNIT.x * 55,
  EARTH_CENTER.y + SUN_UNIT.y * 55,
  EARTH_CENTER.z + SUN_UNIT.z * 55
);
// SUN_POSITION ≈ [-45, 15, 37] — far left/above/front of Earth

// ─── Shadow frustum sizing ─────────────────────────────────────────────────────────
// Asteroid belt: 50 rings, radius 6.0 → 18.25 from Earth center.
// Shadow camera frustum must cover at least ±20 from Earth in all directions,
// with enough depth (near→far) to reach across the full belt.
const SHADOW_FRUSTUM = 28; // half-size in light space (±28 covers the belt with margin)

interface OrbitSceneProps {
  selectedAsteroid: AsteroidData | null;
  onSelectAsteroid: (asteroid: AsteroidData | null) => void;
  hoveredRingIndex: number | null;
  onHoverRing: (ringIndex: number | null) => void;
  routes?: MissionRoute[];
}

function SceneContent({
  selectedAsteroid,
  onSelectAsteroid,
  hoveredRingIndex,
  onHoverRing,
  routes,
}: OrbitSceneProps) {
  useCameraControls(selectedAsteroid);

  // DirectionalLight ref — used for shadow camera debug helper
  const sunRef = useRef<THREE.DirectionalLight>(null);

  // The DirectionalLight.target MUST be a real Object3D in the scene graph.
  // We mount it via <primitive> at Earth center so the shadow frustum is centered there.
  const sunTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  // ─── DEBUG: attach a CameraHelper to visualise the shadow frustum ───────────────
  // Set DEBUG_SHADOW_CAMERA = true at the top of this file to use this.
  useEffect(() => {
    if (!DEBUG_SHADOW_CAMERA) return;
    const light = sunRef.current;
    if (!light) return;

    // CameraHelper visualises the shadow camera's orthographic frustum as a wireframe
    const helper = new THREE.CameraHelper(light.shadow.camera);
    light.parent?.add(helper);

    return () => {
      helper.parent?.remove(helper);
      helper.dispose();
    };
  }, []);

  const orbitRadii = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 50; i++) arr.push(6.0 + i * 0.25);
    return arr;
  }, []);

  const selectedRingIndex =
    selectedAsteroid !== null ? selectedAsteroid.ringIndex : null;

  return (
    <>
      {/* ── Ambient fill ──────────────────────────────────────────────────────────
          Low enough that the shadow regions feel dark and dramatic,
          but not so low that they become pure black silhouettes.              */}
      <ambientLight intensity={0.15} />

      {/* ── Hemisphere fill ───────────────────────────────────────────────────────
          Simulates soft Earth-bounce (blue sky above, dark space below).
          Keeps the underside of rocks subtly visible.                         */}
      <hemisphereLight color="#1e3a5f" groundColor="#0a0a0a" intensity={0.4} />

      {/* ── Close-range Earth Point Light ───────────────────────────────────────
          Adds extra light intensity specifically to the asteroids closest to Earth.
          Using a physical decay with a range of 22 units so it naturally fades out
          towards the outer ring (radius 18.25), keeping the outer belt darker. */}
      <pointLight
        position={[-6, 4, 5]}
        intensity={150.0}
        distance={22}
        decay={2.0}
      />

      {/* ── DirectionalLight target ───────────────────────────────────────────────
          A Three.js DirectionalLight casts shadows toward its .target Object3D.
          The default target is at world origin [0,0,0]; because Earth is at
          [-6, 4, 5] the shadow frustum would be centered in the wrong place.
          We fix this by mounting a dummy Object3D at Earth center and passing
          it as the light's target — this re-centers the orthographic frustum.  */}
      <primitive object={sunTargetRef.current} position={[-6, 4, 5]} />

      {/* ── Primary Sun ───────────────────────────────────────────────────────────
          Position matches EarthShader's sunDirection uniform so the Three.js
          shadow terminator on the geometry aligns with the visual terminator.

          shadow-camera-*: orthographic frustum sized to ±SHADOW_FRUSTUM around
            Earth center, covering all 50 asteroid rings (max radius 18.25).
          shadow-bias: negative bias prevents shadow acne (false self-shadowing).
          shadow-normalBias: helps eliminate acne on curved rock surfaces.
          shadow-mapSize: 2048 px gives smooth PCFSoft penumbra edges.          */}
      <directionalLight
        ref={sunRef}
        position={[SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z]}
        target={sunTargetRef.current}
        intensity={6.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_FRUSTUM}
        shadow-camera-right={SHADOW_FRUSTUM}
        shadow-camera-top={SHADOW_FRUSTUM}
        shadow-camera-bottom={-SHADOW_FRUSTUM}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
      />

      {/* ── Earth ─────────────────────────────────────────────────────────────────
          castShadow: Earth geometry is used to render depth into the shadow map.
            Even though Earth uses a custom shaderMaterial, Three.js still renders
            its geometry depth pass with the built-in depth material — so it
            correctly projects a shadow onto the asteroid belt geometry.
          receiveShadow: Earth can receive shadows from asteroids (has no visual
            effect since the Earth shader manages its own lighting internally,
            but keeps the flag consistent for future material changes).           */}
      <Suspense fallback={
        <mesh position={[-6, 4, 5]}>
          <icosahedronGeometry args={[5.0, 16]} />
          <meshBasicMaterial color="#0d52ab" wireframe transparent opacity={0.4} />
        </mesh>
      }>
        <EarthSystem />
      </Suspense>

      <OrbitPaths
        radii={orbitRadii}
        hoveredRingIndex={hoveredRingIndex}
        selectedRingIndex={selectedRingIndex}
      />

      {/* ── Asteroid Belt ─────────────────────────────────────────────────────────
          Each asteroid mesh already has castShadow + receiveShadow and uses
          meshStandardMaterial, which is fully shadow-map aware.
          When an asteroid orbits into Earth's shadow cone, the shadow map
          lookup in meshStandardMaterial will darken it automatically.           */}
      <AsteroidBelt
        radii={orbitRadii}
        selectedAsteroid={selectedAsteroid}
        onSelectAsteroid={onSelectAsteroid}
        onHoverRing={onHoverRing}
      />

      <RouteLines selectedAsteroid={selectedAsteroid} routes={routes} />
    </>
  );
}

export default function OrbitScene({
  selectedAsteroid,
  onSelectAsteroid,
  hoveredRingIndex,
  onHoverRing,
  routes,
}: OrbitSceneProps) {
  return (
    <div className="w-full h-full bg-black">
      <Canvas
        // PCFSoftShadowMap: uses percentage-closer filtering with a large kernel
        // for smooth, penumbra-style shadow edges (better than hard PCF or basic).
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{
          position: [3, 10, 16],
          fov: 45,
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
            routes={routes}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
export type UseOrbitSceneReturn = ReturnType<typeof OrbitScene>;
