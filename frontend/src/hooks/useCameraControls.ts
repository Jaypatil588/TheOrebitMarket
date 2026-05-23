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
  
  // Adjusted original/idle camera positioning for precise top-left Earth and diagonal orbit alignment
  const originalPosition = useRef(new THREE.Vector3(0, 1.2, 9.2));
  const targetPosition = useRef(new THREE.Vector3(0, 1.2, 9.2));
  
  // Set default lookAt to be centered near the orbits crossing plane
  const lookAtTarget = useRef(new THREE.Vector3(-0.6, 0.5, 0));
  const targetLookAt = useRef(new THREE.Vector3(-0.6, 0.5, 0));

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
      targetLookAt.current.set(-0.6, 0.5, 0);
    }
  }, [selectedAsteroid]);

  // Interpolate camera frame by frame for ultra-smooth sliding
  useFrame((state, delta) => {
    const speed = 3.2;
    const t = Math.min(delta * speed, 1);
    
    // Smooth position transition
    camera.position.lerp(targetPosition.current, t);

    // Smooth lookAt target transition
    lookAtTarget.current.lerp(targetLookAt.current, t);
    
    // Rotate camera to face target, preserving roll angle
    camera.lookAt(lookAtTarget.current);
    
    // Apply counter-clockwise roll to get visual alignment of diagonal orbits wrapping Earth
    camera.rotation.z = Math.PI / 4.0;
    
    // Subtle float drift
    if (!selectedAsteroid) {
      const time = state.clock.getElapsedTime();
      camera.position.x += Math.sin(time * 0.2) * 0.0004;
      camera.position.y += Math.cos(time * 0.15) * 0.0003;
    }
  });

  return null;
}
