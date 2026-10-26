import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useRobotStore } from '../store/useRobotStore';

export const TrajectoryPath3D: React.FC = () => {
  const planResult = useRobotStore((s) => s.planResult);
  const trajectory = useRobotStore((s) => s.trajectory);
  const currentPlayheadTime = useRobotStore((s) => s.currentPlayheadTime);
  const isPlaying = useRobotStore((s) => s.isPlaying);

  // Extract EE points from plan result or trajectory
  const points = useMemo(() => {
    if (trajectory && trajectory.ee_positions.length > 1) {
      return trajectory.ee_positions.map((p) => new THREE.Vector3(...p));
    }
    if (planResult && planResult.ee_path && planResult.ee_path.length > 1) {
      return planResult.ee_path.map((p) => new THREE.Vector3(...p));
    }
    return [];
  }, [planResult, trajectory]);

  // Build smooth curve tube geometry
  const tubeGeometry = useMemo(() => {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, Math.min(100, points.length * 4), 0.006, 8, false);
  }, [points]);

  // Current playhead bead position
  const playheadPos = useMemo(() => {
    if (!trajectory || !isPlaying || trajectory.time_points.length === 0) return null;
    const times = trajectory.time_points;
    const totalT = times[times.length - 1];
    if (totalT <= 0) return null;

    const clampedT = Math.min(Math.max(0, currentPlayheadTime), totalT);
    // Find closest index
    let idx = 0;
    for (let i = 0; i < times.length - 1; i++) {
      if (clampedT >= times[i] && clampedT <= times[i + 1]) {
        idx = i;
        break;
      }
    }
    const t0 = times[idx];
    const t1 = times[idx + 1] || times[idx];
    const alpha = t1 > t0 ? (clampedT - t0) / (t1 - t0) : 0;
    const p0 = trajectory.ee_positions[idx];
    const p1 = trajectory.ee_positions[idx + 1] || p0;

    return new THREE.Vector3(
      p0[0] + alpha * (p1[0] - p0[0]),
      p0[1] + alpha * (p1[1] - p0[1]),
      p0[2] + alpha * (p1[2] - p0[2])
    );
  }, [trajectory, currentPlayheadTime, isPlaying]);

  if (points.length < 2) return null;

  return (
    <group name="PlannedTrajectory">
      {/* 3D Path Tube */}
      {tubeGeometry && (
        <mesh geometry={tubeGeometry}>
          <meshStandardMaterial
            color="#06b6d4"
            emissive="#0891b2"
            emissiveIntensity={0.6}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      )}

      {/* Start Waypoint Marker */}
      <mesh position={points[0]}>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>

      {/* Goal Waypoint Marker */}
      <mesh position={points[points.length - 1]}>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshBasicMaterial color="#f43f5e" />
      </mesh>

      {/* Intermediate Waypoints */}
      {points.slice(1, -1).map((pt, i) => (
        <mesh key={i} position={pt}>
          <sphereGeometry args={[0.008, 12, 12]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>
      ))}

      {/* Active Animated Playhead Bead */}
      {playheadPos && (
        <mesh position={playheadPos}>
          <sphereGeometry args={[0.022, 24, 24]} />
          <meshStandardMaterial
            color="#fcd34d"
            emissive="#f59e0b"
            emissiveIntensity={0.8}
          />
        </mesh>
      )}
    </group>
  );
};
