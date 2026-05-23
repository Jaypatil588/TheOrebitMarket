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
    const earthSpeed = 0.008; // Slower, more majestic rotation
    const cloudsSpeed = 0.014;
    
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * earthSpeed;
    }
    
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * cloudsSpeed;
      cloudsRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.008) * 0.03;
    }
  });

  // Positioning the Earth center off-screen in the top-left quadrant to match the reference screenshot
  const earthCenter: [number, number, number] = [-3.8, 3.8, -2.0];

  return (
    <group position={earthCenter}>
      {/* LAYER A: Surface Core Globe (Radius scaled up to 5.0 for high impact visual curving) */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[5.0, 128, 128]} />
        <meshStandardMaterial
          map={colorMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.9, 0.9)}
          roughnessMap={specularMap}
          roughness={0.7}
          metalness={0.08}
          envMapIntensity={0.3}
        />
      </mesh>

      {/* LAYER B: Translucent Clouds Concentric Shell */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[5.04, 128, 128]} />
        <meshStandardMaterial
          alphaMap={cloudsMap}
          transparent={true}
          color="#ffffff"
          opacity={0.68}
          blending={THREE.NormalBlending}
          depthWrite={false}
          roughness={0.85}
        />
      </mesh>

      {/* LAYER C: Volumetric Atmospheric Limb (Fresnel Shader with adjusted bloom corona) */}
      <mesh>
        <sphereGeometry args={[5.1, 128, 128]} />
        <shaderMaterial
          vertexShader={AtmosphereShader.vertexShader}
          fragmentShader={AtmosphereShader.fragmentShader}
          uniforms={{
            color: { value: new THREE.Color(0.24, 0.62, 0.95) }, // Atmospheric cyan-blue
            coefficient: { value: 0.68 },
            power: { value: 3.8 } // High edge-sharpness
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
