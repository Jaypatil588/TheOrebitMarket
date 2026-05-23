import { useMemo } from "react";
import * as THREE from "three";

interface OrbitPathsProps {
  radii: number[];
  hoveredRingIndex: number | null;
  selectedRingIndex: number | null;
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

        let opacity = 0.35;
        let color = "#ffffff";

        if (isSelected) {
          opacity = 0.9;
          color = "#3b82f6"; // Earth blue accent
        } else if (isHovered) {
          opacity = 0.65;
          color = "#ffffff";
        }

        return (
          <lineLoop key={index} geometry={geometry}>
            <lineBasicMaterial
              color={color}
              opacity={opacity}
              transparent={true}
              linewidth={1}
              depthWrite={false}
            />
          </lineLoop>
        );
      })}
    </group>
  );
}
