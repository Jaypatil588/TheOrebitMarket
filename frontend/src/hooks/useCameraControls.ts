import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  DEFAULT_CAMERA_LOOK_AT,
  DEFAULT_CAMERA_POSITION,
} from "@/lib/mockRoutePlacement";

interface AsteroidPosition {
  id: string;
  x: number;
  y: number;
  z: number;
}

const EARTH_POS = new THREE.Vector3(-6, 4, 5);
const DEFAULT_POS = new THREE.Vector3(...DEFAULT_CAMERA_POSITION);
const DEFAULT_LOOK = new THREE.Vector3(...DEFAULT_CAMERA_LOOK_AT);

export function useCameraControls(selectedAsteroid: AsteroidPosition | null) {
  const { camera, scene } = useThree();

  const targetPosition = useRef(DEFAULT_POS.clone());
  const lookAtTarget = useRef(DEFAULT_LOOK.clone());
  const targetLookAt = useRef(DEFAULT_LOOK.clone());

  const selectionTargetRef = useRef<THREE.Object3D | null>(null);
  const livePosScratch = useRef(new THREE.Vector3());

  useEffect(() => {
    if (selectedAsteroid) {
      selectionTargetRef.current =
        scene.getObjectByName(`asteroid-${selectedAsteroid.id}`) || null;

      const asteroidPos = new THREE.Vector3(
        selectedAsteroid.x,
        selectedAsteroid.y,
        selectedAsteroid.z
      );
      const dir = new THREE.Vector3().subVectors(asteroidPos, EARTH_POS).normalize();

      const zoomDistance = 1.5;
      const yOffset = 0.25;

      const targetPos = new THREE.Vector3()
        .copy(asteroidPos)
        .addScaledVector(dir, zoomDistance);
      targetPos.y += yOffset;

      targetPosition.current.copy(targetPos);
      targetLookAt.current.copy(asteroidPos);
      return;
    }

    selectionTargetRef.current = null;
    targetPosition.current.copy(DEFAULT_POS);
    targetLookAt.current.copy(DEFAULT_LOOK);
  }, [selectedAsteroid, scene]);

  useFrame((state, delta) => {
    const speed = 3.2;
    const t = Math.min(delta * speed, 1);

    if (selectionTargetRef.current) {
      selectionTargetRef.current.getWorldPosition(livePosScratch.current);

      const dir = new THREE.Vector3()
        .subVectors(livePosScratch.current, EARTH_POS)
        .normalize();

      const zoomDistance = 1.5;
      const yOffset = 0.25;

      const targetPos = new THREE.Vector3()
        .copy(livePosScratch.current)
        .addScaledVector(dir, zoomDistance);
      targetPos.y += yOffset;

      targetPosition.current.copy(targetPos);
      targetLookAt.current.copy(livePosScratch.current);
    }

    camera.position.lerp(targetPosition.current, t);
    lookAtTarget.current.lerp(targetLookAt.current, t);
    camera.lookAt(lookAtTarget.current);

    if (!selectedAsteroid) {
      const time = state.clock.getElapsedTime();
      camera.position.x += Math.sin(time * 0.15) * 0.0003;
      camera.position.y += Math.cos(time * 0.12) * 0.0002;
    }
  });

  return null;
}
