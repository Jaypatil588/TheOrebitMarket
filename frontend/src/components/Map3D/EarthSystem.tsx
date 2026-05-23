import { useRef, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { AtmosphereShader, EarthShader } from "@/lib/shaders";

export function EarthSystem() {
  const earthRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Load Bobby Roe's exact textures from update-2024 branch
  const [dayMap, nightMap, cloudsMap] = useLoader(THREE.TextureLoader, [
    "/textures/earth-daymap-4k.jpg",
    "/textures/earth-nightmap-4k.jpg",
    "/textures/earth-clouds-4k.jpg",
  ]);

  // Bobby's exact sun direction — NOT normalized (his code: new THREE.Vector3(-2, 0.5, 1.5))
  const sunDirection = useMemo(() => new THREE.Vector3(-2, 0.5, 1.5), []);

  // Earth shader uniforms — exact match to getEarthMat.js
  const earthUniforms = useMemo(() => ({
    dayTexture: { value: dayMap },
    nightTexture: { value: nightMap },
    cloudsTexture: { value: cloudsMap },
    sunDirection: { value: sunDirection },
  }), [dayMap, nightMap, cloudsMap, sunDirection]);

  // Fresnel atmosphere uniforms — exact match to getFresnelMat.js
  const atmosphereUniforms = useMemo(() => ({
    color1: { value: new THREE.Color(0x0088ff) },
    color2: { value: new THREE.Color(0x000000) },
    fresnelBias: { value: 0.1 },
    fresnelScale: { value: 1.0 },
    fresnelPower: { value: 4.0 },
  }), []);

  // Rotate Earth — slow cinematic rotation
  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.0002;
    }
    if (glowRef.current) {
      glowRef.current.rotation.y += 0.0002;
    }
  });

  // Earth centered at origin for hero section
  const earthCenter: [number, number, number] = [0, 0, 0];

  return (
    <group position={earthCenter} rotation={[0, 0, -23.4 * Math.PI / 180]}>
      {/* Earth globe — Bobby uses IcosahedronGeometry detail=32 */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <icosahedronGeometry args={[5.0, 32]} />
        <shaderMaterial
          vertexShader={EarthShader.vertexShader}
          fragmentShader={EarthShader.fragmentShader}
          uniforms={earthUniforms}
        />
      </mesh>

      {/* Fresnel atmosphere glow — Bobby uses scale 1.02, transparent, additive blending */}
      <mesh ref={glowRef} scale={[1.02, 1.02, 1.02]}>
        <icosahedronGeometry args={[5.0, 32]} />
        <shaderMaterial
          vertexShader={AtmosphereShader.vertexShader}
          fragmentShader={AtmosphereShader.fragmentShader}
          uniforms={atmosphereUniforms}
          transparent={true}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
