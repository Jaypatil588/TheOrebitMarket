import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface OrbitPathsProps {
  radii: number[];
  hoveredRingIndex: number | null;
  selectedRingIndex: number | null;
}

const OrbitLineShader = {
  vertexShader: `
    varying float vDistance;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vDistance = length(mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uBaseOpacity;
    uniform float uNear;
    uniform float uFar;
    varying float vDistance;
    void main() {
      // Linear attenuation: 1.0 at uNear, 0.0 at uFar
      float factor = 1.0 - smoothstep(uNear, uFar, vDistance);
      gl_FragColor = vec4(uColor, uBaseOpacity * factor);
    }
  `
};

interface SingleOrbitPathProps {
  geometry: THREE.BufferGeometry;
  isSelected: boolean;
  isHovered: boolean;
}

function SingleOrbitPath({ geometry, isSelected, isHovered }: SingleOrbitPathProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  let opacity = 0.35;
  let color = "#ffffff";

  if (isSelected) {
    opacity = 0.9;
    color = "#3b82f6"; // Earth blue accent
  } else if (isHovered) {
    opacity = 0.65;
    color = "#ffffff";
  }

  // Pre-calculate initial uniforms with static values to avoid hook dependency warnings.
  // The actual state values are applied on mount and updates via the useEffect below.
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color("#ffffff") },
    uBaseOpacity: { value: 0.35 },
    uNear: { value: 10.0 },
    uFar: { value: 30.0 },
  }), []);

  // Update uniforms when selection/hover states alter color/opacity properties
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.set(color);
      materialRef.current.uniforms.uBaseOpacity.value = opacity;
    }
  }, [color, opacity]);

  // Adjust fading bounds dynamically on every frame depending on camera proximity to Earth
  useFrame(({ camera }) => {
    if (!materialRef.current) return;
    const camPos = camera.position;
    const earthPos = new THREE.Vector3(-6, 4, 5);
    const d = camPos.distanceTo(earthPos);

    // Fade starts 6 units closer than Earth center, fades completely 12 units beyond Earth center
    const near = Math.max(2, d - 6);
    const far = d + 12;

    materialRef.current.uniforms.uNear.value = near;
    materialRef.current.uniforms.uFar.value = far;
  });

  return (
    <lineLoop geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={OrbitLineShader.vertexShader}
        fragmentShader={OrbitLineShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
      />
    </lineLoop>
  );
}

export function OrbitPaths({
  radii = [],
  hoveredRingIndex,
  selectedRingIndex,
}: OrbitPathsProps) {
  // Center of orbits — aligned with centered Earth
  const centerX = -6;
  const centerY = 4;
  const centerZ = 5;

  // Pre-calculate line loops for each radius
  const orbits = useMemo(() => {
    const segments = 128;
    return radii.map((radius) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(
          new THREE.Vector3(
            centerX + Math.cos(theta) * radius,
            centerY,
            centerZ + Math.sin(theta) * radius
          )
        );
      }
      return new THREE.BufferGeometry().setFromPoints(points);
    });
  }, [radii, centerX, centerY, centerZ]);

  return (
    <group>
      {orbits.map((geometry, index) => {
        const isSelected = selectedRingIndex === index;
        const isHovered = hoveredRingIndex === index;

        return (
          <SingleOrbitPath
            key={index}
            geometry={geometry}
            isSelected={isSelected}
            isHovered={isHovered}
          />
        );
      })}
    </group>
  );
}
