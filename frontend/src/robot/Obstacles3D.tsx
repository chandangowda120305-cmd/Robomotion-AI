import React from 'react';
import * as THREE from 'three';
import { useRobotStore } from '../store/useRobotStore';

export const Obstacles3D: React.FC = () => {
  const obstacles = useRobotStore((s) => s.obstacles);
  const selectedId = useRobotStore((s) => s.selectedObstacleId);
  const selectObstacle = useRobotStore((s) => s.selectObstacle);
  const collidingObstacleId = useRobotStore((s) => s.collidingObstacleId);

  return (
    <group name="WorkspaceObstacles">
      {obstacles.map((obs) => {
        const isSelected = selectedId === obs.id;
        const isCollidingThis = collidingObstacleId === obs.id;

        const baseColor = isCollidingThis
          ? '#ef4444'
          : isSelected
          ? '#38bdf8'
          : obs.color || '#f59e0b';

        return (
          <group
            key={obs.id}
            position={obs.position}
            rotation={obs.rotation}
            onClick={(e) => {
              e.stopPropagation();
              selectObstacle(obs.id);
            }}
          >
            {obs.type === 'box' && (
              <mesh castShadow receiveShadow>
                <boxGeometry args={obs.size} />
                <meshStandardMaterial
                  color={baseColor}
                  metalness={0.4}
                  roughness={0.4}
                  transparent
                  opacity={isCollidingThis ? 0.9 : 0.8}
                />
              </mesh>
            )}

            {obs.type === 'sphere' && (
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[obs.size[0], 32, 32]} />
                <meshStandardMaterial
                  color={baseColor}
                  metalness={0.4}
                  roughness={0.4}
                  transparent
                  opacity={isCollidingThis ? 0.9 : 0.8}
                />
              </mesh>
            )}

            {obs.type === 'cylinder' && (
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[obs.size[0], obs.size[0], obs.size[1], 32]} />
                <meshStandardMaterial
                  color={baseColor}
                  metalness={0.4}
                  roughness={0.4}
                  transparent
                  opacity={isCollidingThis ? 0.9 : 0.8}
                />
              </mesh>
            )}

            {/* Selection Bounding Wireframe */}
            {isSelected && (
              <mesh>
                {obs.type === 'box' ? (
                  <boxGeometry args={[obs.size[0] * 1.05, obs.size[1] * 1.05, obs.size[2] * 1.05]} />
                ) : obs.type === 'sphere' ? (
                  <sphereGeometry args={[obs.size[0] * 1.05, 16, 16]} />
                ) : (
                  <cylinderGeometry args={[obs.size[0] * 1.05, obs.size[0] * 1.05, obs.size[1] * 1.05, 16]} />
                )}
                <meshBasicMaterial color="#38bdf8" wireframe />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};
