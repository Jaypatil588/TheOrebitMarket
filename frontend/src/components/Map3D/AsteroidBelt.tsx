import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { applyRouteCameraFacingAngle } from "@/lib/mockRoutePlacement";

export interface AsteroidData {
  id: string;
  name: string;
  ringIndex: number;
  angle: number;
  orbitSpeed: number;
  size: number;
  mass: number;
  composition: Record<string, number>;
  valueUSD: number;
  spec_type?: string;
  specType?: string;
  x: number;
  y: number;
  z: number;
  diameter_km?: number;
  DiameterKm?: number;
}

interface AsteroidBeltProps {
  radii: number[];
  selectedAsteroid: AsteroidData | null;
  onSelectAsteroid: (asteroid: AsteroidData | null) => void;
  onHoverRing: (ringIndex: number | null) => void;
  /** Asteroid IDs repositioned to the camera-facing belt arc for the active route. */
  routePlacementIds?: readonly string[];
  /** Asteroid IDs on the active mission route — highlighted with routeColor. */
  routedAsteroidIds?: string[];
  routeColor?: string;
}

// Orbit center — centered with Earth
const CENTER_X = -6;
const CENTER_Y = 4;
const CENTER_Z = 5;

export function AsteroidBelt({
  radii = [],
  selectedAsteroid,
  onSelectAsteroid,
  onHoverRing,
  routePlacementIds = [],
  routedAsteroidIds = [],
  routeColor = "#22d3ee",
}: AsteroidBeltProps) {
  // Load standard basalt textures
  const [colorMap, normalMap] = useLoader(THREE.TextureLoader, [
    "/textures/asteroid_basalt_color.png",
    "/textures/asteroid_basalt_normal.jpg",
  ]);

  if (colorMap) {
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(1.5, 1.5);
  }

  if (normalMap) {
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(1.5, 1.5);
  }

  const [asteroids, setAsteroids] = useState<AsteroidData[]>([]);
  const [hoveredAsteroidId, setHoveredAsteroidId] = useState<string | null>(null);

  // Fetch the Top 500 distance-clustered asteroids cache on mount
  useEffect(() => {
    fetch("/data/asteroids.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load asteroids database: ${res.status}`);
        }
        return res.json();
      })
      .then((data: AsteroidData[]) => {
        // Find minimum and maximum physical diameters in dataset to build a linear scale
        let minD = Infinity;
        let maxD = -Infinity;
        data.forEach((ast) => {
          const d = ast.diameter_km !== undefined ? ast.diameter_km : (ast.DiameterKm !== undefined ? ast.DiameterKm : 1.0);
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        });

        // Set safe bounds
        if (minD === Infinity) minD = 0.1;
        if (maxD === -Infinity) maxD = 100.0;
        if (minD === maxD) maxD = minD + 1.0;

        // Target visual size range (linear mapping bounds in WebGL)
        const minSize = 0.05;
        const maxSize = 0.35;

        // Map elements into initial 3D positions with linear visual sizes
        const loaded = data.map((ast) => {
          const placed =
            routePlacementIds.length > 0
              ? applyRouteCameraFacingAngle(ast, routePlacementIds)
              : ast;
          const radius = radii[placed.ringIndex] || 6.0;
          const d = placed.diameter_km !== undefined ? placed.diameter_km : (placed.DiameterKm !== undefined ? placed.DiameterKm : 1.0);

          // Pure linear min-max scaling (no logarithmic compression)
          const linearSize = minSize + ((d - minD) / (maxD - minD)) * (maxSize - minSize);

          return {
            ...placed,
            size: linearSize,
            x: CENTER_X + Math.cos(placed.angle) * radius,
            y: CENTER_Y,
            z: CENTER_Z + Math.sin(placed.angle) * radius,
          };
        });
        anglesRef.current = loaded.map((a) => a.angle);
        setAsteroids(loaded);
      })
      .catch((err) => {
        console.error("[AsteroidBelt] Error fetching dataset:", err);
      });
  }, [radii, routePlacementIds]);

  // Generate unique deformed low-poly geometries for each asteroid to look like craggy rocks in space
  const deformedGeometries = useMemo(() => {
    return asteroids.map((ast) => {
      // Detail=1 gives a highly jagged, multi-faceted low-poly base geometry (12 faces)
      const geo = new THREE.DodecahedronGeometry(ast.size || 0.1, 1);
      const posAttr = geo.attributes.position;
      if (!posAttr) return geo;

      // Seed displacement factor based on size and ID characteristics to make every rock completely unique
      const seed = (ast.mass || 100) + parseFloat(ast.id.replace(/\D/g, "") || "0");
      const displacementFactor = (ast.size || 0.1) * 0.32;

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);

        // Combined multi-frequency fractal sine/cosine noise for maximum organic surface irregularities
        const n1 = Math.sin(vx * 10.0 + seed) * Math.cos(vy * 10.0 - seed) * Math.sin(vz * 10.0);
        const n2 = Math.cos(vx * 20.0 - seed * 0.3) * Math.sin(vy * 20.0 + seed * 0.3) * Math.cos(vz * 20.0) * 0.55;
        const noise = n1 + n2;

        const factor = 1.0 + noise * displacementFactor;

        posAttr.setX(i, vx * factor);
        posAttr.setY(i, vy * factor);
        posAttr.setZ(i, vz * factor);
      }

      geo.computeVertexNormals();
      return geo;
    });
  }, [asteroids]);

  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const anglesRef = useRef<number[]>([]);

  // Update asteroid positions dynamically as they orbit around Earth
  useFrame((state, delta) => {
    if (asteroids.length === 0) return;

    // Synchronize angles tracking structure
    if (anglesRef.current.length !== asteroids.length) {
      anglesRef.current = asteroids.map((a) => a.angle);
    }

    asteroids.forEach((ast, index) => {
      const currentRadius = radii[ast.ringIndex];
      if (currentRadius === undefined) return;

      // Keplerian speed scaling: inner orbits are much faster.
      // Proximity goes from 1.0 (radius 6.0) to 0.0 (radius 18.25)
      const proximity = Math.max(0, Math.min(1, (18.25 - currentRadius) / (18.25 - 6.0)));
      // Boost inner asteroid speed by up to 3.5x
      const speedMultiplier = 1.0 + Math.pow(proximity, 1.5) * 2.5;

      const nextAngle = anglesRef.current[index] + ast.orbitSpeed * speedMultiplier * delta;
      anglesRef.current[index] = nextAngle;

      const nextX = CENTER_X + Math.cos(nextAngle) * currentRadius;
      const nextZ = CENTER_Z + Math.sin(nextAngle) * currentRadius;

      if (groupRefs.current[index]) {
        groupRefs.current[index]!.position.set(nextX, CENTER_Y, nextZ);
      }
    });
  });

  const routedIdSet = useMemo(() => new Set(routedAsteroidIds), [routedAsteroidIds]);

  return (
    <group>
      {asteroids.map((ast, index) => {
        const isSelected = selectedAsteroid?.id === ast.id;
        const isHovered = hoveredAsteroidId === ast.id;
        const isRouted = routedIdSet.has(ast.id);
        const geo = deformedGeometries[index];
        if (!geo) return null;

        // Custom pointer dynamics
        const handlePointerOver = (e: any) => {
          e.stopPropagation();
          setHoveredAsteroidId(ast.id);
          onHoverRing(ast.ringIndex);
          document.body.style.cursor = "pointer";
        };

        const handlePointerOut = () => {
          setHoveredAsteroidId(null);
          onHoverRing(null);
          document.body.style.cursor = "default";
        };

        const handleSelect = (e: any) => {
          e.stopPropagation();
          onSelectAsteroid(ast);
        };

        // Determine authentic space-rock coloration based on taxonomic class mapping
        const spec = ast.spec_type || ast.specType || "C";
        let rockColor = "#8a8d93"; // fallback medium warm grey
        if (isSelected) {
          rockColor = "#3b82f6"; // Selected bright celestial blue highlight
        } else if (isHovered) {
          rockColor = "#cbd5e1"; // Hover bright slate highlight
        } else if (isRouted) {
          rockColor = routeColor;
        } else {
          switch (spec) {
            case "C": // Carbonaceous
              rockColor = "#8a8d93"; // Medium warm grey — visible in shadow
              break;
            case "S": // Silicaceous / Stony
              rockColor = "#b5a898"; // Warm sandy stone like sandstone/feldspar
              break;
            case "M": // Metallic
              rockColor = "#a89080"; // Warm iron-rust / nickel alloy coloring
              break;
          }
        }

        // Dynamically boost material color brightness for asteroids closer to Earth
        // (simulates Earth-shine and stronger primary illumination reflections)
        const currentRadius = radii[ast.ringIndex] || 6.0;
        const colorProximity = Math.max(0, Math.min(1, (18.25 - currentRadius) / (18.25 - 6.0)));
        const finalColor = new THREE.Color(rockColor);
        if (!isSelected && !isHovered && !isRouted) {
          // Increase lightness of channels up to 0.25 (25% boost) for inner rings
          const colorBoost = colorProximity * 0.25;
          finalColor.r = Math.min(1, finalColor.r + colorBoost);
          finalColor.g = Math.min(1, finalColor.g + colorBoost);
          finalColor.b = Math.min(1, finalColor.b + colorBoost);
        }

        return (
          <group
            key={ast.id}
            name={`asteroid-${ast.id}`}
            position={[ast.x, ast.y, ast.z]}
            ref={(el) => {
              groupRefs.current[index] = el;
            }}
          >
            {/* Craggy, faceted low-poly asteroid mesh */}
            <mesh
              geometry={geo}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              onClick={handleSelect}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                map={colorMap}
                color={finalColor}
                roughness={0.88}
                metalness={spec === "M" ? 0.25 : 0.08}
                normalMap={normalMap}
                normalScale={new THREE.Vector2(0.9, 0.9)}
              />
            </mesh>

            {/* Route / selector orbit rings */}
            {(isRouted || isHovered || isSelected) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
                <ringGeometry args={[ast.size * 1.5, ast.size * 1.7, 32]} />
                <meshBasicMaterial
                  color={isSelected ? "#3b82f6" : isHovered ? "#ffffff" : routeColor}
                  transparent={true}
                  opacity={isSelected ? 0.7 : isHovered ? 0.3 : 0.55}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Vertical HUD reference vector */}
            {(isHovered || isSelected) && (
              <group position={[0, ast.size + 0.18, 0]}>
                <line>
                  <bufferGeometry attach="geometry">
                    <float32BufferAttribute
                      attach="attributes-position"
                      args={[new Float32Array([0, 0, 0, 0, -ast.size - 0.12, 0]), 3]}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial
                    attach="material"
                    color={"#ffffff"}
                    opacity={0.3}
                    transparent
                  />
                </line>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

export type UseAsteroidBeltReturn = ReturnType<typeof AsteroidBelt>;
