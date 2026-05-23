import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

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
          const radius = radii[ast.ringIndex] || 6.0;
          const d = ast.diameter_km !== undefined ? ast.diameter_km : (ast.DiameterKm !== undefined ? ast.DiameterKm : 1.0);

          // Pure linear min-max scaling (no logarithmic compression)
          const linearSize = minSize + ((d - minD) / (maxD - minD)) * (maxSize - minSize);

          return {
            ...ast,
            size: linearSize,
            x: CENTER_X + Math.cos(ast.angle) * radius,
            y: CENTER_Y,
            z: CENTER_Z + Math.sin(ast.angle) * radius,
          };
        });
        anglesRef.current = loaded.map((a) => a.angle);
        setAsteroids(loaded);
      })
      .catch((err) => {
        console.error("[AsteroidBelt] Error fetching dataset:", err);
      });
  }, [radii]);

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
      const nextAngle = anglesRef.current[index] + ast.orbitSpeed * delta;
      anglesRef.current[index] = nextAngle;

      const currentRadius = radii[ast.ringIndex];
      if (currentRadius === undefined) return;

      const nextX = CENTER_X + Math.cos(nextAngle) * currentRadius;
      const nextZ = CENTER_Z + Math.sin(nextAngle) * currentRadius;

      if (groupRefs.current[index]) {
        groupRefs.current[index]!.position.set(nextX, CENTER_Y, nextZ);
      }
    });
  });

  return (
    <group>
      {asteroids.map((ast, index) => {
        const isSelected = selectedAsteroid?.id === ast.id;
        const isHovered = hoveredAsteroidId === ast.id;
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
        let rockColor = "#404145"; // fallback charcoal
        if (isSelected) {
          rockColor = "#3b82f6"; // Selected light blue glow accent
        } else if (isHovered) {
          rockColor = "#94a3b8"; // Hover slate highlight
        } else {
          switch (spec) {
            case "C": // Carbonaceous
              rockColor = "#2c2d30"; // Very dark, carbonaceous slate grey
              break;
            case "S": // Silicaceous / Stony
              rockColor = "#5e5954"; // Stony silicate brown-grey
              break;
            case "M": // Metallic
              rockColor = "#7c726a"; // Rusty oxidized iron-nickel grey
              break;
          }
        }

        return (
          <group
            key={ast.id}
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
                color={rockColor}
                roughness={0.96}
                metalness={spec === "M" ? 0.22 : 0.08}
                normalMap={normalMap}
                normalScale={new THREE.Vector2(0.9, 0.9)}
              />
            </mesh>

            {/* Selector orbit rings */}
            {(isHovered || isSelected) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
                <ringGeometry args={[ast.size * 1.5, ast.size * 1.7, 32]} />
                <meshBasicMaterial
                  color={isSelected ? "#3b82f6" : "#ffffff"}
                  transparent={true}
                  opacity={isSelected ? 0.7 : 0.3}
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
