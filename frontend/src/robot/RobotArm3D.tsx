import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRobotStore } from '../store/useRobotStore';
import { ClientRobotKinematics } from './RobotKinematics';

interface RobotArm3DProps {
  armId?: string;
  basePosition?: [number, number, number];
  baseRotation?: number; // yaw in radians
  jointAngles?: number[];
  accentColor?: string;
  isDeadlocked?: boolean;
  gripperState?: 'open' | 'closed';
  isSelected?: boolean;
  label?: string;
  onClick?: () => void;
}

export const RobotArm3D: React.FC<RobotArm3DProps> = ({
  armId = 'arm-1',
  basePosition = [0, 0, 0],
  baseRotation = 0,
  jointAngles: propsAngles,
  accentColor = '#06b6d4',
  isDeadlocked = false,
  gripperState: propsGripperState,
  isSelected = false,
  label,
  onClick
}) => {
  const storeJointAngles = useRobotStore((s) => s.jointAngles);
  const storeGripperState = useRobotStore((s) => s.gripperState);
  const viewSettings = useRobotStore((s) => s.viewSettings);
  const isColliding = useRobotStore((s) => s.isColliding);

  const angles = propsAngles || storeJointAngles;
  const currentGripperState = propsGripperState || storeGripperState;

  // Compute transformation matrices for all 8 frames
  const transforms = useMemo(() => {
    return ClientRobotKinematics.computeTransforms(angles);
  }, [angles]);

  // Interpolate gripper finger opening/closing smoothly
  const leftFingerRef = useRef<THREE.Group>(null);
  const rightFingerRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const targetOffset = currentGripperState === 'open' ? 0.028 : 0.008;
    if (leftFingerRef.current && rightFingerRef.current) {
      leftFingerRef.current.position.x = THREE.MathUtils.lerp(
        leftFingerRef.current.position.x,
        targetOffset,
        delta * 12
      );
      rightFingerRef.current.position.x = THREE.MathUtils.lerp(
        rightFingerRef.current.position.x,
        -targetOffset,
        delta * 12
      );
    }
  });

  // Extract positions and rotation matrices for each joint frame
  const frames = useMemo(() => {
    return transforms.map((T) => {
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      T.decompose(pos, quat, scale);
      return { pos, quat };
    });
  }, [transforms]);

  // Materials: Light industrial composite body (KUKA/ABB style) with dark cast joints and vibrant accents
  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: isSelected ? '#3b82f6' : '#334155',
        metalness: 0.4,
        roughness: 0.35,
        wireframe: viewSettings.showWireframe
      }),
    [isSelected, viewSettings.showWireframe]
  );

  const linkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: isDeadlocked || isColliding ? '#dc2626' : isSelected ? '#f8fafc' : '#e2e8f0',
        metalness: 0.22,
        roughness: 0.32,
        wireframe: viewSettings.showWireframe
      }),
    [isDeadlocked, isColliding, isSelected, viewSettings.showWireframe]
  );

  const accentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: isDeadlocked ? '#ef4444' : accentColor,
        metalness: 0.5,
        roughness: 0.2,
        emissive: isDeadlocked ? '#dc2626' : accentColor,
        emissiveIntensity: isDeadlocked ? 0.7 : isSelected ? 0.45 : 0.25,
        wireframe: viewSettings.showWireframe
      }),
    [isDeadlocked, accentColor, isSelected, viewSettings.showWireframe]
  );

  const jointPivotMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        metalness: 0.6,
        roughness: 0.3,
        wireframe: viewSettings.showWireframe
      }),
    [viewSettings.showWireframe]
  );

  const collisionCapsuleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: isDeadlocked ? '#ef4444' : '#f59e0b',
        wireframe: true,
        transparent: true,
        opacity: 0.45
      }),
    [isDeadlocked]
  );

  return (
    <group
      name={`RobotArmSystem-${armId}`}
      position={basePosition}
      rotation={[0, baseRotation, 0]}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      {/* Selection Base Halo */}
      {isSelected && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.26, 36]} />
          <meshBasicMaterial color={accentColor} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Arm Name Identifier Plaque */}
      {label && (
        <group position={[0, 0.01, 0.26]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.24, 0.06]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
        </group>
      )}

      {/* 1. Base Pedestal (Ground to Y=0.20) */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow material={baseMat}>
        <cylinderGeometry args={[0.16, 0.18, 0.2, 32]} />
      </mesh>
      {/* Base mounting flange rim */}
      <mesh position={[0, 0.02, 0]} material={jointPivotMat}>
        <cylinderGeometry args={[0.20, 0.20, 0.04, 32]} />
      </mesh>

      {/* Frame 1: Joint 1 (Base Yaw) */}
      <group position={frames[1].pos} quaternion={frames[1].quat}>
        {/* Turntable disk */}
        <mesh position={[0, 0, 0]} material={accentMat} castShadow>
          <cylinderGeometry args={[0.13, 0.14, 0.05, 32]} />
        </mesh>
        {/* Shoulder support bracket */}
        <mesh position={[0, 0.075, 0]} material={linkMat} castShadow>
          <boxGeometry args={[0.16, 0.15, 0.14]} />
        </mesh>

        {/* Joint 1 Axis indicator */}
        {viewSettings.showAxes && (
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 16]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        )}
      </group>

      {/* Frame 2: Joint 2 (Shoulder Pitch) */}
      <group position={frames[2].pos} quaternion={frames[2].quat}>
        {/* Shoulder pivot cylinder (along Z axis) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={jointPivotMat} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 0.16, 32]} />
        </mesh>
        {/* Accent ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={accentMat}>
          <cylinderGeometry args={[0.077, 0.077, 0.02, 32]} />
        </mesh>

        {/* Upper Arm Link (Length: 0.40m along local +Y) */}
        <mesh position={[0, 0.20, 0]} material={linkMat} castShadow>
          <boxGeometry args={[0.11, 0.38, 0.10]} />
        </mesh>
        {/* Upper Arm accent styling stripe */}
        <mesh position={[0.057, 0.20, 0]} material={accentMat}>
          <boxGeometry args={[0.005, 0.30, 0.06]} />
        </mesh>

        {/* Collision Capsule visualization */}
        {viewSettings.showCollisionCapsules && (
          <mesh position={[0, 0.20, 0]} material={collisionCapsuleMat}>
            <cylinderGeometry args={[0.06, 0.06, 0.40, 16]} />
          </mesh>
        )}
      </group>

      {/* Frame 3: Joint 3 (Elbow Pitch) */}
      <group position={frames[3].pos} quaternion={frames[3].quat}>
        {/* Elbow pivot cylinder along Z */}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={jointPivotMat} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.14, 32]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={accentMat}>
          <cylinderGeometry args={[0.067, 0.067, 0.02, 32]} />
        </mesh>

        {/* Forearm Link (Length: 0.35m along local +Y) */}
        <mesh position={[0, 0.175, 0]} material={linkMat} castShadow>
          <boxGeometry args={[0.09, 0.33, 0.08]} />
        </mesh>

        {viewSettings.showCollisionCapsules && (
          <mesh position={[0, 0.175, 0]} material={collisionCapsuleMat}>
            <cylinderGeometry args={[0.05, 0.05, 0.35, 16]} />
          </mesh>
        )}
      </group>

      {/* Frame 4: Joint 4 (Wrist 1 Pitch) */}
      <group position={frames[4].pos} quaternion={frames[4].quat}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={jointPivotMat} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.11, 24]} />
        </mesh>
        {/* Wrist 1 link */}
        <mesh position={[0, 0.06, 0]} material={linkMat} castShadow>
          <cylinderGeometry args={[0.045, 0.048, 0.12, 24]} />
        </mesh>
      </group>

      {/* Frame 5: Joint 5 (Wrist 2 Yaw) */}
      <group position={frames[5].pos} quaternion={frames[5].quat}>
        <mesh material={jointPivotMat} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.05, 24]} />
        </mesh>
        {/* Wrist 2 link */}
        <mesh position={[0, 0.05, 0]} material={linkMat} castShadow>
          <boxGeometry args={[0.07, 0.10, 0.065]} />
        </mesh>
      </group>

      {/* Frame 6: Joint 6 (Tool Flange Roll) */}
      <group position={frames[6].pos} quaternion={frames[6].quat}>
        {/* Flange plate */}
        <mesh material={jointPivotMat} castShadow>
          <cylinderGeometry args={[0.042, 0.042, 0.02, 32]} />
        </mesh>

        {/* Parallel 2-Finger Gripper Base */}
        <mesh position={[0, 0.035, 0]} material={linkMat} castShadow>
          <boxGeometry args={[0.08, 0.05, 0.06]} />
        </mesh>
        {/* Gripper actuator status indicator */}
        <mesh position={[0, 0.035, 0.032]}>
          <boxGeometry args={[0.04, 0.015, 0.005]} />
          <meshBasicMaterial color={currentGripperState === 'closed' ? '#10b981' : accentColor} />
        </mesh>

        {/* Left Finger */}
        <group ref={leftFingerRef} position={[0.028, 0.07, 0]}>
          <mesh material={accentMat} castShadow>
            <boxGeometry args={[0.012, 0.06, 0.025]} />
          </mesh>
          <mesh position={[-0.007, 0, 0]}>
            <boxGeometry args={[0.003, 0.045, 0.022]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        </group>

        {/* Right Finger */}
        <group ref={rightFingerRef} position={[-0.028, 0.07, 0]}>
          <mesh material={accentMat} castShadow>
            <boxGeometry args={[0.012, 0.06, 0.025]} />
          </mesh>
          <mesh position={[0.007, 0, 0]}>
            <boxGeometry args={[0.003, 0.045, 0.022]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Frame 7: End-Effector Tip & RGB Coordinate Triad */}
      <group position={frames[7].pos} quaternion={frames[7].quat}>
        {viewSettings.showAxes && (
          <group name="EndEffectorCoordinateFrame">
            {/* X Axis (Red) */}
            <mesh position={[0.04, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <cylinderGeometry args={[0.003, 0.003, 0.08, 16]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
            {/* Y Axis (Green) */}
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.003, 0.003, 0.08, 16]} />
              <meshBasicMaterial color="#22c55e" />
            </mesh>
            {/* Z Axis (Blue) */}
            <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.003, 0.003, 0.08, 16]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
          </group>
        )}

        {/* Center tool tip focal sphere */}
        <mesh>
          <sphereGeometry args={[0.006, 16, 16]} />
          <meshBasicMaterial color={isDeadlocked ? '#ef4444' : '#fcd34d'} />
        </mesh>
      </group>
    </group>
  );
};
