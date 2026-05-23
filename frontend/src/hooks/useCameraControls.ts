import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AsteroidPosition {
  id: string;
  x: number;
  y: number;
  z: number;
}

export function useCameraControls(selectedAsteroid: AsteroidPosition | null) {
  const { camera, scene } = useThree();

  // Camera defaults — elevated view with Earth half-visible in top-left, belt below
  const originalPosition = useRef(new THREE.Vector3(3, 8, 16));
  const targetPosition = useRef(new THREE.Vector3(3, 10, 16));

  // Look downward so the asteroid belt falls below camera horizon
  const lookAtTarget = useRef(new THREE.Vector3(2, 1, 2));
  const targetLookAt = useRef(new THREE.Vector3(2, 1, 2));

  // Cache the live 3D object to avoid expensive scene graph queries on every frame
  const liveTargetRef = useRef<THREE.Object3D | null>(null);

  // Handle selected asteroid changes (resets to initial positions or global view)
  useEffect(() => {
    if (selectedAsteroid) {
      // Find the object ONCE when selection changes and cache it
      liveTargetRef.current = scene.getObjectByName(`asteroid-${selectedAsteroid.id}`) || null;

      // Set initial focus coordinate (will be tracked dynamically in useFrame)
      targetPosition.current.set(
        selectedAsteroid.x + 0.6,
        selectedAsteroid.y + 0.4,
        selectedAsteroid.z + 1.3
      );
      targetLookAt.current.set(
        selectedAsteroid.x,
        selectedAsteroid.y,
        selectedAsteroid.z
      );
    } else {
      liveTargetRef.current = null;
      // Return to global view
      targetPosition.current.copy(originalPosition.current);
      targetLookAt.current.set(2, 1, 2);
    }
  }, [selectedAsteroid, scene]);

  // Interpolate camera frame by frame for ultra-smooth transitions and live tracking
  useFrame((state, delta) => {
    const speed = 3.2;
    const t = Math.min(delta * speed, 1);

    if (liveTargetRef.current) {
      const livePos = new THREE.Vector3();
      liveTargetRef.current.getWorldPosition(livePos);

      // Update target positions to track the moving asteroid
      targetPosition.current.set(
        livePos.x + 0.6,
        livePos.y + 0.4,
        livePos.z + 1.3
      );
      targetLookAt.current.copy(livePos);
    }

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
