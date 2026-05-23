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

      // Earth position matching EarthSystem.tsx
      const earthPos = new THREE.Vector3(-6, 4, 5);
      const asteroidPos = new THREE.Vector3(selectedAsteroid.x, selectedAsteroid.y, selectedAsteroid.z);
      const dir = new THREE.Vector3().subVectors(asteroidPos, earthPos).normalize();
      
      const zoomDistance = 1.5;
      const yOffset = 0.25;

      // Calculate initial target position along the line from Earth through asteroid
      const targetPos = new THREE.Vector3()
        .copy(asteroidPos)
        .addScaledVector(dir, zoomDistance);
      targetPos.y += yOffset;

      targetPosition.current.copy(targetPos);
      targetLookAt.current.copy(asteroidPos);
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

      // Earth position matching EarthSystem.tsx
      const earthPos = new THREE.Vector3(-6, 4, 5);
      const dir = new THREE.Vector3().subVectors(livePos, earthPos).normalize();

      const zoomDistance = 1.5;
      const yOffset = 0.25;

      const targetPos = new THREE.Vector3()
        .copy(livePos)
        .addScaledVector(dir, zoomDistance);
      targetPos.y += yOffset;

      // Update target positions to track the moving asteroid
      targetPosition.current.copy(targetPos);
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
