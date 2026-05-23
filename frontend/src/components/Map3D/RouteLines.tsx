import { useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MissionRoute } from "@/hooks/useWebSockets";

interface AsteroidPosition {
  id: string;
  ringIndex: number;
  angle: number;
  x: number;
  y: number;
  z: number;
}

interface RouteLinesProps {
  selectedAsteroid: { x: number; y: number; z: number } | null;
  routes?: MissionRoute[];
}

const CENTER_X = -6;
const CENTER_Y = 4;
const CENTER_Z = 5;

const EARTH_CENTER = new THREE.Vector3(CENTER_X, CENTER_Y, CENTER_Z);

export function RouteLines({ selectedAsteroid, routes }: RouteLinesProps) {
  const [asteroidPositions, setAsteroidPositions] = useState<Map<string, AsteroidPosition>>(new Map());

  useEffect(() => {
    fetch("/data/asteroids.json")
      .then((res) => res.json())
      .then((data: AsteroidPosition[]) => {
        const radii: number[] = [];
        for (let i = 0; i < 50; i++) radii.push(6.0 + i * 0.25);

        const posMap = new Map<string, AsteroidPosition>();
        data.forEach((ast) => {
          const radius = radii[ast.ringIndex] || 6.0;
          posMap.set(ast.id, {
            ...ast,
            x: CENTER_X + Math.cos(ast.angle) * radius,
            y: CENTER_Y,
            z: CENTER_Z + Math.sin(ast.angle) * radius,
          });
        });
        setAsteroidPositions(posMap);
      })
      .catch((err) => console.error("[RouteLines] Failed to load asteroids:", err));
  }, []);

  const defaultRoute = useMemo(() => {
    return routes?.find((r) => r.is_default) || (routes && routes.length > 0 ? routes[0] : null);
  }, [routes]);

  const routeLineObject = useMemo(() => {
    if (!defaultRoute || asteroidPositions.size === 0) return null;

    const points: THREE.Vector3[] = [];
    
    for (const stop of defaultRoute.stops) {
      if (stop.body === "Earth") {
        points.push(EARTH_CENTER.clone());
      } else if (stop.asteroid_id) {
        const ast = asteroidPositions.get(stop.asteroid_id);
        if (ast) {
          points.push(new THREE.Vector3(ast.x, ast.y, ast.z));
        }
      }
    }

    if (points.length < 2) return null;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color("#fbbf24"),
      dashSize: 0.12,
      gapSize: 0.08,
      scale: 1.0,
      opacity: 0.85,
      transparent: true,
      depthWrite: false,
      linewidth: 2,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  }, [defaultRoute, asteroidPositions]);

  const selectedLineObject = useMemo(() => {
    if (!selectedAsteroid) return null;

    const points = [
      EARTH_CENTER,
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
  }, [selectedAsteroid]);

  useFrame((state) => {
    if (routeLineObject) {
      const mat = routeLineObject.material as THREE.LineDashedMaterial & { dashOffset: number };
      mat.dashOffset = -state.clock.getElapsedTime() * 0.6;
    }
    if (selectedLineObject) {
      const mat = selectedLineObject.material as THREE.LineDashedMaterial & { dashOffset: number };
      mat.dashOffset = -state.clock.getElapsedTime() * 0.45;
    }
  });

  return (
    <group>
      {routeLineObject && <primitive object={routeLineObject} />}
      {selectedLineObject && <primitive object={selectedLineObject} />}
    </group>
  );
}
