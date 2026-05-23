import { useMemo } from "react";
import * as THREE from "three";

interface OrbitPathsProps {
  radii: number[];
  hoveredRingIndex: number | null;
  selectedRingIndex: number | null;
}

export function OrbitPaths({
  radii = [3.2, 4.4, 5.6, 6.8, 8.0],
  hoveredRingIndex,
  selectedRingIndex,
}: OrbitPathsProps) {
  // Pre-calculate line loops for each radius to maximize performance
  const orbits = useMemo(() => {
    const segments = 128;
    return radii.map((radius) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        // Calculate coordinate in horizontal XZ plane, depressed on Y axis
        points.push(new THREE.Vector3(Math.cos(theta) * radius, -1.2, Math.sin(theta) * radius));
      }
      return new THREE.BufferGeometry().setFromPoints(points);
    });
  }, [radii]);

  return (
    <group>
      {orbits.map((geometry, index) => {
        const isSelected = selectedRingIndex === index;
        const isHovered = hoveredRingIndex === index;
        
        // Dynamically shift brightness based on interaction state
        let opacity = 0.15;
        let color = "#d97706"; // Amber gold
        
        if (isSelected) {
          opacity = 0.75;
          color = "#fbbf24"; // Bright amber gold
        } else if (isHovered) {
          opacity = 0.45;
          color = "#f59e0b"; // Medium amber gold
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
