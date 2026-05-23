import { useMemo } from "react";
import * as THREE from "three";

interface OrbitPathsProps {
  radii: number[];
  hoveredRingIndex: number | null;
  selectedRingIndex: number | null;
}

export function OrbitPaths({
  radii = [5.6, 6.1, 6.6, 7.1, 7.6],
  hoveredRingIndex,
  selectedRingIndex,
}: OrbitPathsProps) {
  // Center of orbits matching Earth's off-screen top-left position
  const centerX = -3.8;
  const centerY = 1.8; // Lowered along Y axis to wrap the southern hemisphere of Earth
  const centerZ = -2.0;

  // Pre-calculate line loops for each radius to maximize performance
  const orbits = useMemo(() => {
    const segments = 128;
    return radii.map((radius) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        // Calculate coordinate in horizontal XZ plane concentric to Earth
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
        
        let opacity = 0.25;
        let color = "#fbbf24"; // Warm gold
        
        if (isSelected) {
          opacity = 0.85;
          color = "#ffffff"; // White highlight for selected ring
        } else if (isHovered) {
          opacity = 0.55;
          color = "#fbbf24";
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
