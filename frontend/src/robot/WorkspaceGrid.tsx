import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useRobotStore } from '../store/useRobotStore';

export const WorkspaceGrid: React.FC = () => {
  const showWorkspace = useRobotStore((s) => s.viewSettings.showWorkspace);

  // Generate workspace envelope point cloud
  const workspacePoints = useMemo(() => {
    const pts: number[] = [];
    const maxR = 0.95;
    const minR = 0.20;
    // Stratified shell sampling
    for (let i = 0; i < 900; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.random() * Math.PI * 0.6; // Upper hemisphere
      const r = minR + Math.random() * (maxR - minR);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = Math.max(0.04, 0.20 + r * Math.cos(phi));
      const z = r * Math.sin(phi) * Math.sin(theta);
      pts.push(x, y, z);
    }
    return new Float32Array(pts);
  }, []);

  return (
    <group name="EnvironmentWorkspace">
      {/* Studio Lighting Setup for Photorealistic Industrial Arm Materials */}
      <hemisphereLight args={['#e0f2fe', '#0f172a', 0.95]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[4, 8, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
      />
      {/* Fill Light */}
      <directionalLight position={[-4, 5, -3]} intensity={0.9} color="#bae6fd" />
      {/* Rim / Backlight for clean silhouette separation */}
      <directionalLight position={[0, 4, -5]} intensity={0.7} color="#cbd5e1" />
      <pointLight position={[0, 2.5, 0]} intensity={0.4} color="#38bdf8" />

      {/* Grid Floor */}
      <gridHelper
        args={[4.0, 40, '#0284c7', '#1e293b']}
        position={[0, 0.001, 0]}
      />

      {/* Industrial Multi-Arm Workcell Base Platform */}
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[2.4, 0.08, 1.3]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Three Individual Arm Mounting Pedestals */}
      {[-0.75, 0.0, 0.75].map((x, idx) => (
        <group key={`pedestal-${idx}`} position={[x, 0.002, 0]}>
          <mesh receiveShadow>
            <cylinderGeometry args={[0.22, 0.24, 0.02, 32]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.20, 0.22, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}

      {/* World Origin Coordinate Axes (RGB) */}
      <group position={[0, 0.005, 0]}>
        {/* X Axis (Red) */}
        <mesh position={[0.15, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.003, 0.003, 0.3, 16]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        {/* Y Axis (Green) */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.3, 16]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        {/* Z Axis (Blue) */}
        <mesh position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.3, 16]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      </group>

      {/* Reachable Workspace Point Cloud */}
      {showWorkspace && (
        <points position={[0, 0, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[workspacePoints, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.012}
            color="#06b6d4"
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  );
};
