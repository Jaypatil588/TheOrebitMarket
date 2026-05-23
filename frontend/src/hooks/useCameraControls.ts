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
  const originalPosition = useRef(new THREE.Vector3(0, 3.5, 8.5));
  const targetPosition = useRef(new THREE.Vector3(0, 3.5, 8.5));
  const lookAtTarget = useRef(new THREE.Vector3(0, -1.2, 0)); // Orbit paths center level
  const targetLookAt = useRef(new THREE.Vector3(0, -1.2, 0));

  // Handle selected asteroid changes
  useEffect(() => {
    if (selectedAsteroid) {
      // Focus Camera closer to asteroid coordinate
      // Offset slightly to get a beautiful look
      targetPosition.current.set(
        selectedAsteroid.x + 0.8,
        selectedAsteroid.y + 0.5,
        selectedAsteroid.z + 1.5
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
      targetLookAt.current.set(0, -1.2, 0);
    }
  }, [selectedAsteroid]);

  // Interpolate camera frame by frame for ultra-smooth sliding
  useFrame((state, delta) => {
    // Standard lerp factor (dampen speed for organic feel)
    const speed = 3.5;
    const t = Math.min(delta * speed, 1);
    
    // Smooth position transition
    camera.position.lerp(targetPosition.current, t);

    // Smooth lookAt target transition
    lookAtTarget.current.lerp(targetLookAt.current, t);
    
    // Rotate camera to face target, while preserving Z-tilt angle
    camera.lookAt(lookAtTarget.current);
    
    // Apply cinematic Z-roll to lock our 45-degree angle
    camera.rotation.z = Math.PI / 4; 
    
    // Add subtle idle floating drift to make the viewport feel alive
    if (!selectedAsteroid) {
      const time = state.clock.getElapsedTime();
      camera.position.x += Math.sin(time * 0.25) * 0.0006;
      camera.position.y += Math.cos(time * 0.2) * 0.0004;
    }
  });

  return null;
}
