import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface RouteLinesProps {
  selectedAsteroid: { x: number; y: number; z: number } | null;
}

export function RouteLines({ selectedAsteroid }: RouteLinesProps) {
  // Position of Earth's core matching EarthSystem positioning
  const earthCenter = useMemo(() => new THREE.Vector3(-3.8, 3.8, -2.0), []);

  // Pre-calculate line and geometry using useMemo
  const lineObject = useMemo(() => {
    if (!selectedAsteroid) return null;

    const points = [
      earthCenter,
      new THREE.Vector3(selectedAsteroid.x, selectedAsteroid.y, selectedAsteroid.z),
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create the material
    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color("#fbbf24"), // Bright yellow gold
      dashSize: 0.08,
      gapSize: 0.06,
      scale: 1.2,
      opacity: 0.6,
      transparent: true,
      depthWrite: false,
    });

    // Create a Three.js Line object
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances(); // Required for lineDashedMaterial
    return line;
  }, [selectedAsteroid, earthCenter]);

  // Animate dashed lines in useFrame
  useFrame((state) => {
    if (lineObject) {
      const material = lineObject.material as any;
      // Animate line dash offset to produce dynamic directional current movement
      material.dashOffset = -state.clock.getElapsedTime() * 0.45;
    }
  });

  if (!lineObject) return null;

  // Render using standard R3F primitive element to bypass SVG tag name clashes in TSX
  return <primitive object={lineObject} />;
}
