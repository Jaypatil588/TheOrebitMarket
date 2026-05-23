import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { AtmosphereShader } from "@/lib/shaders";

export function EarthSystem() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // Load high-resolution textures
  const [colorMap, normalMap, specularMap, cloudsMap] = useLoader(THREE.TextureLoader, [
    "/textures/earth_color_8k.jpg",
    "/textures/earth_normal_8k.jpg",
    "/textures/earth_specular_8k.jpg",
    "/textures/earth_clouds_8k.jpg",
  ]);

  // Configure texture parameters for premium quality shading
  if (colorMap) colorMap.colorSpace = THREE.SRGBColorSpace;
  
  // Rotate Earth surface and cloud layer independently
  useFrame((state, delta) => {
    // Slow rotational velocity (seconds per rotation: ~24000s)
    const earthSpeed = 0.015;
    const cloudsSpeed = 0.024;
    
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * earthSpeed;
    }
    
    if (cloudsRef.current) {
      // Clouds drift slightly faster to produce realistic wind layering
      cloudsRef.current.rotation.y += delta * cloudsSpeed;
      // Minor secondary wobble for atmospheric depth
      cloudsRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.01) * 0.05;
    }
  });

  return (
    <group position={[0, 2.5, -2.5]}>
      {/* Planetary ambient shadow casting glow container */}
      
      {/* LAYER A: Surface Core Globe */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[2.0, 64, 64]} />
        <meshStandardMaterial
          map={colorMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.85, 0.85)}
          roughnessMap={specularMap}
          roughness={0.7} // Earth landmass is coarse matte
          metalness={0.1}
          envMapIntensity={0.4}
        />
      </mesh>

      {/* LAYER B: Translucent Clouds Concentric Shell */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.016, 64, 64]} />
        <meshStandardMaterial
          alphaMap={cloudsMap}
          transparent={true}
          color="#ffffff"
          opacity={0.72}
          blending={THREE.NormalBlending}
          depthWrite={false}
          roughness={0.9}
        />
      </mesh>

      {/* LAYER C: Custom Volumetric Atmospheric Limb (Fresnel Shader) */}
      <mesh>
        <sphereGeometry args={[2.05, 64, 64]} />
        <shaderMaterial
          vertexShader={AtmosphereShader.vertexShader}
          fragmentShader={AtmosphereShader.fragmentShader}
          uniforms={{
            color: { value: new THREE.Color(0.28, 0.68, 1.0) }, // Glowing Soft Cyan
            coefficient: { value: 0.65 },
            power: { value: 3.5 }
          }}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent={true}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
