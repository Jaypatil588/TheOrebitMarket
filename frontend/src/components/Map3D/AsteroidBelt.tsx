import { useRef, useMemo, useState } from "react";
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
  composition: {
    basalt: number;
    magnetite: number;
    platinumGroup: number;
    silicates: number;
  };
  valueUSD: number;
  x: number;
  y: number;
  z: number;
}

interface AsteroidBeltProps {
  radii: number[];
  selectedAsteroid: AsteroidData | null;
  onSelectAsteroid: (asteroid: AsteroidData | null) => void;
  onHoverRing: (ringIndex: number | null) => void;
}

export function AsteroidBelt({
  radii,
  selectedAsteroid,
  onSelectAsteroid,
  onHoverRing,
}: AsteroidBeltProps) {
  // Load standard basalt normal map
  const [normalMap] = useLoader(THREE.TextureLoader, [
    "/textures/asteroid_basalt_normal.jpg",
  ]);

  if (normalMap) {
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(1.5, 1.5);
  }

  // Initialize the list of asteroids with unique static stats
  const [asteroids, setAsteroids] = useState<AsteroidData[]>(() => {
    const list: Omit<AsteroidData, "x" | "y" | "z">[] = [
      {
        id: "ast-01",
        name: "Bennu-X",
        ringIndex: 0,
        angle: 0.0,
        orbitSpeed: 0.12,
        size: 0.09,
        mass: 145000,
        composition: { basalt: 82.5, magnetite: 12.0, platinumGroup: 1.5, silicates: 4.0 },
        valueUSD: 4.8e9,
      },
      {
        id: "ast-02",
        name: "Apophis-Beta",
        ringIndex: 1,
        angle: 1.8,
        orbitSpeed: 0.08,
        size: 0.14,
        mass: 320000,
        composition: { basalt: 78.0, magnetite: 16.4, platinumGroup: 0.8, silicates: 4.8 },
        valueUSD: 9.2e9,
      },
      {
        id: "ast-03",
        name: "Psyche-16-Min",
        ringIndex: 2,
        angle: 3.4,
        orbitSpeed: 0.05,
        size: 0.22,
        mass: 1850000,
        composition: { basalt: 45.0, magnetite: 32.0, platinumGroup: 9.8, silicates: 13.2 },
        valueUSD: 340.5e9,
      },
      {
        id: "ast-04",
        name: "Eros-Prime",
        ringIndex: 3,
        angle: 5.1,
        orbitSpeed: 0.04,
        size: 0.16,
        mass: 590000,
        composition: { basalt: 88.0, magnetite: 8.5, platinumGroup: 0.3, silicates: 3.2 },
        valueUSD: 14.6e9,
      },
      {
        id: "ast-05",
        name: "Ceres-Minor",
        ringIndex: 4,
        angle: 2.2,
        orbitSpeed: 0.025,
        size: 0.28,
        mass: 4200000,
        composition: { basalt: 70.0, magnetite: 15.0, platinumGroup: 2.2, silicates: 12.8 },
        valueUSD: 185.2e9,
      },
      {
        id: "ast-06",
        name: "Ryugu-Alpha",
        ringIndex: 1,
        angle: 4.5,
        orbitSpeed: -0.07, // Counter-rotating orbit
        size: 0.11,
        mass: 210000,
        composition: { basalt: 85.0, magnetite: 9.2, platinumGroup: 1.1, silicates: 4.7 },
        valueUSD: 6.4e9,
      },
      {
        id: "ast-07",
        name: "Itokawa-9",
        ringIndex: 3,
        angle: 0.8,
        orbitSpeed: 0.065,
        size: 0.08,
        mass: 95000,
        composition: { basalt: 92.0, magnetite: 4.5, platinumGroup: 0.5, silicates: 3.0 },
        valueUSD: 2.1e9,
      }
    ];

    return list.map(ast => ({
      ...ast,
      x: Math.cos(ast.angle) * radii[ast.ringIndex],
      y: -1.2,
      z: Math.sin(ast.angle) * radii[ast.ringIndex]
    }));
  });

  // Track hover states for cursor styling
  const [hoveredAsteroidId, setHoveredAsteroidId] = useState<string | null>(null);

  // Generate unique deformed low-poly geometries for each asteroid
  const deformedGeometries = useMemo(() => {
    return asteroids.map((ast) => {
      // Dodecahedron with 1 detail iteration produces a great low-poly basalt rock
      const geo = new THREE.DodecahedronGeometry(ast.size, 1);
      const posAttr = geo.attributes.position;
      
      // Seeded random vertex displacement to make irregular basalt structures
      const displacementFactor = ast.size * 0.28;
      
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        
        // Simple trigonometric pseudo-noise displacement based on initial vertex position
        const noise = Math.sin(vx * 15 + ast.mass) * Math.cos(vy * 15 - ast.mass) * Math.sin(vz * 15);
        const factor = 1.0 + noise * displacementFactor;

        posAttr.setX(i, vx * factor);
        posAttr.setY(i, vy * factor);
        posAttr.setZ(i, vz * factor);
      }
      
      geo.computeVertexNormals();
      return geo;
    });
  }, [asteroids]);

  // Update asteroid positions dynamically as they orbit in the XZ plane
  useFrame((state, delta) => {
    setAsteroids((prev) =>
      prev.map((ast) => {
        // Adjust angle based on speed
        const nextAngle = ast.angle + ast.orbitSpeed * delta;
        const currentRadius = radii[ast.ringIndex];
        
        const nextX = Math.cos(nextAngle) * currentRadius;
        const nextZ = Math.sin(nextAngle) * currentRadius;
        
        return {
          ...ast,
          angle: nextAngle,
          x: nextX,
          z: nextZ,
        };
      })
    );
  });

  // Keep track of active refs for rendering
  const meshesRefs = useRef<(THREE.Mesh | null)[]>([]);

  return (
    <group>
      {asteroids.map((ast, index) => {
        const isSelected = selectedAsteroid?.id === ast.id;
        const isHovered = hoveredAsteroidId === ast.id;
        const geo = deformedGeometries[index];

        // Trigger hover effect for parent coordinate ring
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

        return (
          <group key={ast.id} position={[ast.x, ast.y, ast.z]}>
            {/* Base Basalt Rocky Mesh */}
            <mesh
              ref={(el) => { meshesRefs.current[index] = el; }}
              geometry={geo}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              onClick={handleSelect}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={isSelected ? "#fbbf24" : isHovered ? "#94a3b8" : "#475569"} // Amber yellow, slate gray, dark slate
                roughness={0.9}
                metalness={0.05}
                normalMap={normalMap}
                normalScale={new THREE.Vector2(0.9, 0.9)}
              />
            </mesh>

            {/* Glowing orbital tracking pulse element */}
            {(isHovered || isSelected) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
                <ringGeometry args={[ast.size * 1.5, ast.size * 1.7, 32]} />
                <meshBasicMaterial
                  color={isSelected ? "#fbbf24" : "#f59e0b"}
                  transparent={true}
                  opacity={isSelected ? 0.8 : 0.4}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
            
            {/* Asteroid HUD Monospace Label overlay */}
            {(isHovered || isSelected) && (
              <group position={[0, ast.size + 0.18, 0]}>
                {/* Visual connecting wire stem */}
                <line>
                  <bufferGeometry attach="geometry">
                    <float32BufferAttribute
                      attach="attributes-position"
                      args={[new Float32Array([0, 0, 0, 0, -ast.size - 0.12, 0]), 3]}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial attach="material" color={isSelected ? "#fbbf24" : "#f59e0b"} opacity={0.5} transparent />
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
