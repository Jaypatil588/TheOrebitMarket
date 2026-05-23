import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface RouteLinesProps {
  selectedAsteroid: { x: number; y: number; z: number } | null;
}

export function RouteLines({ selectedAsteroid }: RouteLinesProps) {
  // Earth center — now at origin
  const earthCenter = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Pre-calculate line and geometry using useMemo
  const lineObject = useMemo(() => {
    if (!selectedAsteroid) return null;

    const points = [
      earthCenter,
      new THREE.Vector3(selectedAsteroid.x, selectedAsteroid.y, selectedAsteroid.z),
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color("#ffffff"),
      dashSize: 0.08,
      gapSize: 0.06,
      scale: 1.2,
      opacity: 0.4,
      transparent: true,
      depthWrite: false,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  }, [selectedAsteroid, earthCenter]);

  // Animate dashed lines
  useFrame((state) => {
    if (lineObject) {
      const material = lineObject.material as any;
      material.dashOffset = -state.clock.getElapsedTime() * 0.45;
    }
  });

  if (!lineObject) return null;

  return <primitive object={lineObject} />;
}
