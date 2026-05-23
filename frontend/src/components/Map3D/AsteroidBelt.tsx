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
  radii = [5.6, 6.1, 6.6, 7.1, 7.6],
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

  // Orbit center — centered with Earth at origin
  const centerX = 0;
  const centerY = 0;
  const centerZ = 0;

  // Initialize the list of asteroids with unique static stats
  const [asteroids] = useState<AsteroidData[]>(() => {
    const list: Omit<AsteroidData, "x" | "y" | "z">[] = [
      {
        id: "ast-01",
        name: "Bennu-X",
        ringIndex: 0,
        angle: 4.8,
        orbitSpeed: 0.035,
        size: 0.12,
        mass: 145000,
        composition: { basalt: 82.5, magnetite: 12.0, platinumGroup: 1.5, silicates: 4.0 },
        valueUSD: 4.8e9,
      },
      {
        id: "ast-02",
        name: "Apophis-Beta",
        ringIndex: 1,
        angle: 5.2,
        orbitSpeed: 0.024,
        size: 0.18,
        mass: 320000,
        composition: { basalt: 78.0, magnetite: 16.4, platinumGroup: 0.8, silicates: 4.8 },
        valueUSD: 9.2e9,
      },
      {
        id: "ast-03",
        name: "Psyche-16-Min",
        ringIndex: 2,
        angle: 5.5,
        orbitSpeed: 0.015,
        size: 0.26,
        mass: 1850000,
        composition: { basalt: 45.0, magnetite: 32.0, platinumGroup: 9.8, silicates: 13.2 },
        valueUSD: 340.5e9,
      },
      {
        id: "ast-04",
        name: "Eros-Prime",
        ringIndex: 3,
        angle: 5.7,
        orbitSpeed: 0.012,
        size: 0.21,
        mass: 590000,
        composition: { basalt: 88.0, magnetite: 8.5, platinumGroup: 0.3, silicates: 3.2 },
        valueUSD: 14.6e9,
      },
      {
        id: "ast-05",
        name: "Ceres-Minor",
        ringIndex: 4,
        angle: 6.0,
        orbitSpeed: 0.008,
        size: 0.32,
        mass: 4200000,
        composition: { basalt: 70.0, magnetite: 15.0, platinumGroup: 2.2, silicates: 12.8 },
        valueUSD: 185.2e9,
      },
      {
        id: "ast-06",
        name: "Ryugu-Alpha",
        ringIndex: 1,
        angle: 4.2,
        orbitSpeed: -0.018, // Counter-rotating orbit
        size: 0.15,
        mass: 210000,
        composition: { basalt: 85.0, magnetite: 9.2, platinumGroup: 1.1, silicates: 4.7 },
        valueUSD: 6.4e9,
      },
      {
        id: "ast-07",
        name: "Itokawa-9",
        ringIndex: 3,
        angle: 4.9,
        orbitSpeed: 0.02,
        size: 0.11,
        mass: 95000,
        composition: { basalt: 92.0, magnetite: 4.5, platinumGroup: 0.5, silicates: 3.0 },
        valueUSD: 2.1e9,
      }
    ];

    return list.map(ast => ({
      ...ast,
      x: centerX + Math.cos(ast.angle) * radii[ast.ringIndex],
      y: centerY,
      z: centerZ + Math.sin(ast.angle) * radii[ast.ringIndex]
    }));
  });

  // Track hover states for cursor styling
  const [hoveredAsteroidId, setHoveredAsteroidId] = useState<string | null>(null);

  // Generate unique deformed low-poly geometries for each asteroid
  const deformedGeometries = useMemo(() => {
    return asteroids.map((ast) => {
      const geo = new THREE.DodecahedronGeometry(ast.size, 1);
      const posAttr = geo.attributes.position;
      
      const displacementFactor = ast.size * 0.28;
      
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        
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

  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const anglesRef = useRef(asteroids.map(a => a.angle));

  // Update asteroid positions dynamically as they orbit
  useFrame((state, delta) => {
    asteroids.forEach((ast, index) => {
      const nextAngle = anglesRef.current[index] + ast.orbitSpeed * delta;
      anglesRef.current[index] = nextAngle;
      
      const currentRadius = radii[ast.ringIndex];
      const nextX = centerX + Math.cos(nextAngle) * currentRadius;
      const nextZ = centerZ + Math.sin(nextAngle) * currentRadius;
      
      if (groupRefs.current[index]) {
        groupRefs.current[index]!.position.set(nextX, centerY, nextZ);
      }
    });
  });

  return (
    <group>
      {asteroids.map((ast, index) => {
        const isSelected = selectedAsteroid?.id === ast.id;
        const isHovered = hoveredAsteroidId === ast.id;
        const geo = deformedGeometries[index];

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
          <group key={ast.id} position={[ast.x, ast.y, ast.z]} ref={(el) => { groupRefs.current[index] = el; }}>
            {/* Base Basalt Rocky Mesh */}
            <mesh
              geometry={geo}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              onClick={handleSelect}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={isSelected ? "#3b82f6" : isHovered ? "#cbd5e1" : "#64748b"}
                roughness={0.9}
                metalness={0.05}
                normalMap={normalMap}
                normalScale={new THREE.Vector2(0.8, 0.8)}
              />
            </mesh>

            {/* Selection ring — Earth blue */}
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
            
            {/* Label connector line */}
            {(isHovered || isSelected) && (
              <group position={[0, ast.size + 0.18, 0]}>
                <line>
                  <bufferGeometry attach="geometry">
                    <float32BufferAttribute
                      attach="attributes-position"
                      args={[new Float32Array([0, 0, 0, 0, -ast.size - 0.12, 0]), 3]}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial attach="material" color={"#ffffff"} opacity={0.3} transparent />
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
