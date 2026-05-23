import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AsteroidPosition {
  x: number;
  y: number;
  z: number;
}

export function useCameraControls(selectedAsteroid: AsteroidPosition | null) {
  const { camera } = useThree();

  // Camera defaults for Earth in the top-left quadrant — camera at [0, 6, 14], looking at [0, 0, 0]
  const originalPosition = useRef(new THREE.Vector3(0, 6, 14));
  const targetPosition = useRef(new THREE.Vector3(0, 6, 14));
  
  // Look at the center of the scene (origin)
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // Handle selected asteroid changes
  useEffect(() => {
    if (selectedAsteroid) {
      // Focus Camera closer to asteroid coordinate
      targetPosition.current.set(
        selectedAsteroid.x + 0.6,
        selectedAsteroid.y + 0.4,
        selectedAsteroid.z + 1.3
      );
      // Camera looks directly at the asteroid center
      targetLookAt.current.set(
        selectedAsteroid.x,
        selectedAsteroid.y,
        selectedAsteroid.z
      );
    } else {
      // Return to global view
      targetPosition.current.copy(originalPosition.current);
      targetLookAt.current.set(0, 0, 0);
    }
  }, [selectedAsteroid]);

  // Interpolate camera frame by frame for ultra-smooth transitions
  useFrame((state, delta) => {
    const speed = 3.2;
    const t = Math.min(delta * speed, 1);

    // Smooth position transition
    camera.position.lerp(targetPosition.current, t);

    // Smooth lookAt target transition
    lookAtTarget.current.lerp(targetLookAt.current, t);

    // Rotate camera to face target
    camera.lookAt(lookAtTarget.current);

    // Subtle float drift when no asteroid selected
    if (!selectedAsteroid) {
      const time = state.clock.getElapsedTime();
      camera.position.x += Math.sin(time * 0.15) * 0.0003;
      camera.position.y += Math.cos(time * 0.12) * 0.0002;
    }
  });

  return null;
}
