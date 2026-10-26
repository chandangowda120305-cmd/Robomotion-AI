import React from 'react';
import * as THREE from 'three';
import { useRobotStore } from '../store/useRobotStore';

export const PickPlaceObjects3D: React.FC = () => {
  const tasks = useRobotStore((s) => s.pickPlaceTasks);
  const attachedObjectId = useRobotStore((s) => s.attachedObjectId);
  const armAttachedObjects = useRobotStore((s) => s.armAttachedObjects);
  const arms = useRobotStore((s) => s.arms);
  const selectedArmId = useRobotStore((s) => s.selectedArmId);

  const activeArm = arms.find((a) => a.id === selectedArmId) || arms[1];

  return (
    <group name="PickPlaceSystem">
      {tasks.map((task) => {
        // Detect which arm (if any) is currently holding this object
        const holdingArm =
          arms.find((a) => armAttachedObjects[a.id] === task.object_id) ||
          (attachedObjectId === task.object_id ? activeArm : null);

        const isAttached = Boolean(holdingArm);
        const isCompleted = task.status === 'completed';

        // Determine object world position:
        // 1. If attached: follow holding arm's gripper in world coordinates
        // 2. If completed: rest on place position
        // 3. Otherwise: rest on pick position
        let objPos: [number, number, number];
        if (isAttached && holdingArm) {
          const worldGripperX = holdingArm.basePosition[0] + holdingArm.currentPose.position[0];
          const worldGripperY = holdingArm.basePosition[1] + holdingArm.currentPose.position[1] - 0.03;
          const worldGripperZ = holdingArm.basePosition[2] + holdingArm.currentPose.position[2];
          objPos = [worldGripperX, worldGripperY, worldGripperZ];
        } else if (isCompleted) {
          objPos = task.place_position;
        } else {
          objPos = task.pick_position;
        }

        return (
          <group key={task.id}>
            {/* Pick Table Pedestal */}
            <mesh position={[task.pick_position[0], 0.05, task.pick_position[2]]} receiveShadow>
              <cylinderGeometry args={[0.07, 0.08, 0.10, 24]} />
              <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Pick Zone Target Ring */}
            <mesh
              position={[task.pick_position[0], 0.101, task.pick_position[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.038, 0.048, 32]} />
              <meshBasicMaterial color={task.object_color} side={THREE.DoubleSide} />
            </mesh>

            {/* Place Table Pedestal */}
            <mesh position={[task.place_position[0], 0.05, task.place_position[2]]} receiveShadow>
              <cylinderGeometry args={[0.07, 0.08, 0.10, 24]} />
              <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Place Zone Target Ring */}
            <mesh
              position={[task.place_position[0], 0.101, task.place_position[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.038, 0.048, 32]} />
              <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
            </mesh>

            {/* Physical Pick/Place Object (Box, Cylinder, Sphere) */}
            <group position={objPos}>
              {task.object_type === 'box' && (
                <mesh castShadow receiveShadow>
                  <boxGeometry args={task.object_size} />
                  <meshStandardMaterial
                    color={task.object_color}
                    metalness={0.45}
                    roughness={0.25}
                  />
                </mesh>
              )}
              {task.object_type === 'cylinder' && (
                <mesh castShadow receiveShadow>
                  <cylinderGeometry
                    args={[
                      task.object_size[0],
                      task.object_size[0],
                      task.object_size[1] || 0.08,
                      32
                    ]}
                  />
                  <meshStandardMaterial
                    color={task.object_color}
                    metalness={0.65}
                    roughness={0.2}
                  />
                </mesh>
              )}
              {task.object_type === 'sphere' && (
                <mesh castShadow receiveShadow>
                  <sphereGeometry args={[task.object_size[0] || 0.035, 32, 32]} />
                  <meshStandardMaterial
                    color={task.object_color}
                    metalness={0.8}
                    roughness={0.12}
                  />
                </mesh>
              )}
            </group>
          </group>
        );
      })}
    </group>
  );
};
