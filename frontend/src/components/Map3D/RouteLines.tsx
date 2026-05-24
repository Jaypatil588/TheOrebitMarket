import { useMemo, useEffect, useState, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MissionRoute } from "@/types/orebit";
import { applyMockRouteCameraFacingAngle } from "@/lib/mockRoutePlacement";

const ROUTE_YELLOW = "#facc15";

interface AsteroidPosition {
  id: string;
  name?: string;
  ringIndex: number;
  angle: number;
  x: number;
  y: number;
  z: number;
}

interface RouteLinesProps {
  selectedAsteroid: { x: number; y: number; z: number } | null;
  routes?: MissionRoute[];
  mockRoutePlacement?: boolean;
}

const CENTER_X = -6;
const CENTER_Y = 4;
const CENTER_Z = 5;
const EARTH_RADIUS = 5.2;

const EARTH_CENTER = new THREE.Vector3(CENTER_X, CENTER_Y, CENTER_Z);

function resolveAsteroid(
  posMap: Map<string, AsteroidPosition>,
  stop: { asteroid_id?: string; body?: string }
): AsteroidPosition | undefined {
  if (stop.asteroid_id) {
    const byId = posMap.get(stop.asteroid_id);
    if (byId) return byId;
  }
  if (!stop.body || stop.body === "Earth") return undefined;
  const needle = stop.body.toLowerCase();
  for (const ast of Array.from(posMap.values())) {
    if (ast.name && needle.includes(ast.name.toLowerCase())) return ast;
  }
  return undefined;
}

function earthSurfaceToward(target: THREE.Vector3): THREE.Vector3 {
  const dir = target.clone().sub(EARTH_CENTER);
  if (dir.lengthSq() < 1e-6) return EARTH_CENTER.clone();
  return EARTH_CENTER.clone().add(dir.normalize().multiplyScalar(EARTH_RADIUS));
}

function buildRoutePointsFromScene(
  route: MissionRoute,
  posMap: Map<string, AsteroidPosition>,
  scene: THREE.Scene,
  scratch: THREE.Vector3
): THREE.Vector3[] {
  const raw: THREE.Vector3[] = [];
  for (const stop of route.stops) {
    if (stop.body === "Earth") {
      raw.push(EARTH_CENTER.clone());
      continue;
    }
    if (stop.asteroid_id) {
      const obj = scene.getObjectByName(`asteroid-${stop.asteroid_id}`);
      if (obj) {
        obj.getWorldPosition(scratch);
        raw.push(scratch.clone());
        continue;
      }
    }
    const ast = resolveAsteroid(posMap, stop);
    if (ast) raw.push(new THREE.Vector3(ast.x, ast.y, ast.z));
  }
  if (raw.length < 2) return [];
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (i === 0) points.push(earthSurfaceToward(raw[1]));
    else if (i === raw.length - 1) points.push(earthSurfaceToward(raw[raw.length - 2]));
    else points.push(raw[i]);
  }
  return points;
}

function LiveRouteLine({
  route,
  posMap,
  color,
}: {
  route: MissionRoute;
  posMap: Map<string, AsteroidPosition>;
  color: string;
}) {
  const { scene } = useThree();
  const scratch = useRef(new THREE.Vector3());
  const [linePoints, setLinePoints] = useState<[number, number, number][]>([]);

  useFrame(() => {
    const pts = buildRoutePointsFromScene(route, posMap, scene, scratch.current);
    if (pts.length < 2) return;
    const next = pts.map((p) => [p.x, p.y, p.z] as [number, number, number]);
    setLinePoints((prev) => {
      if (prev.length !== next.length) return next;
      const moved = next.some(
        (p, i) =>
          Math.abs(p[0] - prev[i][0]) > 0.002 ||
          Math.abs(p[1] - prev[i][1]) > 0.002 ||
          Math.abs(p[2] - prev[i][2]) > 0.002
      );
      return moved ? next : prev;
    });
  });

  if (linePoints.length < 2) return null;

  return (
    <Line
      points={linePoints}
      color={color}
      lineWidth={2}
      dashed
      dashSize={0.12}
      gapSize={0.08}
      transparent
      opacity={0.85}
      depthWrite={false}
    />
  );
}

export function RouteLines({
  selectedAsteroid,
  routes,
  mockRoutePlacement = false,
}: RouteLinesProps) {
  const [asteroidPositions, setAsteroidPositions] = useState<Map<string, AsteroidPosition>>(
    new Map()
  );

  useEffect(() => {
    fetch("/data/asteroids.json")
      .then((res) => res.json())
      .then((data: AsteroidPosition[]) => {
        const radii: number[] = [];
        for (let i = 0; i < 50; i++) radii.push(6.0 + i * 0.25);

        const posMap = new Map<string, AsteroidPosition>();
        data.forEach((ast) => {
          const placed = mockRoutePlacement
            ? applyMockRouteCameraFacingAngle(ast)
            : ast;
          const radius = radii[placed.ringIndex] || 6.0;
          posMap.set(placed.id, {
            ...placed,
            x: CENTER_X + Math.cos(placed.angle) * radius,
            y: CENTER_Y,
            z: CENTER_Z + Math.sin(placed.angle) * radius,
          });
        });
        setAsteroidPositions(posMap);
      })
      .catch((err) => console.error("[RouteLines] Failed to load asteroids:", err));
  }, [mockRoutePlacement]);

  const defaultRoute = useMemo(() => {
    if (!routes || routes.length === 0) return null;
    return routes.find((r) => r.is_default) ?? routes[0] ?? null;
  }, [routes]);

  const selectedPoints = useMemo(() => {
    if (!selectedAsteroid) return [];
    const target = new THREE.Vector3(
      selectedAsteroid.x,
      selectedAsteroid.y,
      selectedAsteroid.z
    );
    return [earthSurfaceToward(target), target];
  }, [selectedAsteroid]);

  const routeColor = defaultRoute?.color_hex ?? ROUTE_YELLOW;

  const selectedLinePoints = useMemo(
    () => selectedPoints.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    [selectedPoints]
  );

  return (
    <group>
      {defaultRoute && asteroidPositions.size > 0 && (
        <LiveRouteLine route={defaultRoute} posMap={asteroidPositions} color={routeColor} />
      )}
      {selectedLinePoints.length >= 2 && (
        <Line
          points={selectedLinePoints}
          color="#ffffff"
          lineWidth={1.5}
          dashed
          dashSize={0.3}
          gapSize={0.2}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      )}
    </group>
  );
}
