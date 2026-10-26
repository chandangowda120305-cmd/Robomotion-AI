import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRobotStore } from '../store/useRobotStore';
import { RobotArm3D } from './RobotArm3D';
import { WorkspaceGrid } from './WorkspaceGrid';
import { Obstacles3D } from './Obstacles3D';
import { TrajectoryPath3D } from './TrajectoryPath3D';
import { PickPlaceObjects3D } from './PickPlaceObjects3D';
import {
  Camera,
  Layers,
  Box,
  Compass,
  Eye,
  RotateCcw,
  ShieldAlert,
  Unlock,
  AlertTriangle,
  Bot
} from 'lucide-react';

const interpolateTrajectoryPose = (trajectory: any, t: number): number[] => {
  const times = trajectory.time_points;
  if (!times || times.length === 0) return trajectory.positions[0] || [0, 0, 0, 0, 0, 0];
  if (t <= times[0]) return trajectory.positions[0];
  if (t >= times[times.length - 1]) return trajectory.positions[trajectory.positions.length - 1];

  let idx = 0;
  for (let i = 0; i < times.length - 1; i++) {
    if (t >= times[i] && t <= times[i + 1]) {
      idx = i;
      break;
    }
  }

  const t0 = times[idx];
  const t1 = times[idx + 1] || t0;
  const alpha = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const q0 = trajectory.positions[idx];
  const q1 = trajectory.positions[idx + 1] || q0;

  return q0.map((v: number, j: number) => v + alpha * ((q1[j] ?? v) - v));
};

const SimulationRunner: React.FC = () => {
  const isPlaying = useRobotStore((s) => s.isPlaying);
  const isPaused = useRobotStore((s) => s.isPaused);
  const trajectory = useRobotStore((s) => s.trajectory);
  const currentPlayheadTime = useRobotStore((s) => s.currentPlayheadTime);
  const playbackSpeed = useRobotStore((s) => s.playbackSpeed);
  const setPlayheadTime = useRobotStore((s) => s.setPlayheadTime);
  const setJointAngles = useRobotStore((s) => s.setJointAngles);
  const stopSimulation = useRobotStore((s) => s.stopSimulation);

  // Swarm Coordination States
  const isSwarmRunning = useRobotStore((s) => s.isSwarmRunning);
  const arms = useRobotStore((s) => s.arms);
  const armTrajectories = useRobotStore((s) => s.armTrajectories);
  const armPlayheads = useRobotStore((s) => s.armPlayheads);
  const setArmPlayhead = useRobotStore((s) => s.setArmPlayhead);
  const setArmJointAngles = useRobotStore((s) => s.setArmJointAngles);
  const stopSwarmSimulation = useRobotStore((s) => s.stopSwarmSimulation);

  useFrame((_, delta) => {
    if (isPaused) return;

    // Mode A: Active Single Arm Trajectory Playback
    if (isPlaying && trajectory && trajectory.time_points.length > 0) {
      const totalT = trajectory.total_duration;
      const nextT = currentPlayheadTime + delta * playbackSpeed;

      if (nextT >= totalT) {
        setPlayheadTime(totalT);
        const finalQ = trajectory.positions[trajectory.positions.length - 1];
        setJointAngles(finalQ);
        stopSimulation();
      } else {
        setPlayheadTime(nextT);
        const interpQ = interpolateTrajectoryPose(trajectory, nextT);
        setJointAngles(interpQ);
      }
    }

    // Mode B: Swarm Multi-Arm Synchronized Simultaneous Execution
    if (isSwarmRunning) {
      let anyStillMoving = false;

      arms.forEach((arm) => {
        const armTraj = armTrajectories[arm.id];
        if (armTraj && armTraj.time_points && armTraj.time_points.length > 0) {
          const totalT = armTraj.total_duration;
          const currentT = armPlayheads[arm.id] || 0;
          const nextT = currentT + delta * playbackSpeed;

          if (nextT < totalT) {
            anyStillMoving = true;
            setArmPlayhead(arm.id, nextT);
            const interpQ = interpolateTrajectoryPose(armTraj, nextT);
            setArmJointAngles(arm.id, interpQ);
          } else {
            const finalQ = armTraj.positions[armTraj.positions.length - 1];
            setArmJointAngles(arm.id, finalQ);
          }
        }
      });

      if (!anyStillMoving && Object.values(armTrajectories).some((t) => t !== null)) {
        stopSwarmSimulation();
      }
    }
  });

  return null;
};

export const Viewport3D: React.FC = () => {
  const controlsRef = useRef<any>(null);
  const viewSettings = useRobotStore((s) => s.viewSettings);
  const toggleViewSetting = useRobotStore((s) => s.toggleViewSetting);
  const setCameraPreset = useRobotStore((s) => s.setCameraPreset);
  const isColliding = useRobotStore((s) => s.isColliding);
  const collidingLink = useRobotStore((s) => s.collidingLink);

  const arms = useRobotStore((s) => s.arms);
  const selectedArmId = useRobotStore((s) => s.selectedArmId);
  const setSelectedArmId = useRobotStore((s) => s.setSelectedArmId);

  const isDeadlocked = useRobotStore((s) => s.isDeadlocked);
  const deadlockReason = useRobotStore((s) => s.deadlockReason);
  const clearDeadlock = useRobotStore((s) => s.clearDeadlock);
  const triggerDeadlockDemo = useRobotStore((s) => s.triggerDeadlockDemo);

  const resetCamera = (preset: 'isometric' | 'front' | 'top' | 'side' = 'isometric') => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    controls.target.set(0, 0.45, 0);

    if (preset === 'isometric') {
      controls.object.position.set(1.9, 1.6, 1.9);
    } else if (preset === 'front') {
      controls.object.position.set(0, 0.8, 2.8);
    } else if (preset === 'side') {
      controls.object.position.set(2.8, 0.8, 0);
    } else if (preset === 'top') {
      controls.object.position.set(0, 3.5, 0.001);
    }
    controls.update();
    setCameraPreset(preset);
  };

  return (
    <div className="relative w-full h-full bg-industrial-950 overflow-hidden select-none">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [1.9, 1.6, 1.9], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <OrbitControls
          ref={controlsRef}
          target={[0, 0.45, 0]}
          maxPolarAngle={Math.PI / 2 - 0.02}
          minDistance={0.5}
          maxDistance={7.0}
        />
        <SimulationRunner />
        <WorkspaceGrid />
        <Obstacles3D />
        <TrajectoryPath3D />
        <PickPlaceObjects3D />

        {/* 3 Robotic Arms in Multi-Robot Cell */}
        {arms.map((arm) => (
          <RobotArm3D
            key={arm.id}
            armId={arm.id}
            basePosition={arm.basePosition}
            baseRotation={arm.baseRotation}
            jointAngles={arm.jointAngles}
            accentColor={arm.accentColor}
            isDeadlocked={isDeadlocked || arm.isDeadlocked}
            gripperState={arm.gripperState}
            isSelected={selectedArmId === arm.id}
            label={arm.name}
            onClick={() => setSelectedArmId(arm.id)}
          />
        ))}
      </Canvas>

      {/* Floating Viewport Overlay: Quick Toggles & Camera Presets */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        {/* Arm Quick Selection Pill in Viewport */}
        <div className="flex items-center gap-1 bg-industrial-900/90 backdrop-blur-md border border-industrial-750 px-2 py-1.5 rounded-lg shadow-xl text-xs font-mono text-slate-300">
          <span className="text-cyanAccent mr-1 flex items-center gap-1 font-bold">
            <Bot className="w-3.5 h-3.5" /> Arm Focus:
          </span>
          {arms.map((arm, idx) => (
            <button
              key={arm.id}
              onClick={() => setSelectedArmId(arm.id)}
              className={`px-2 py-1 rounded text-[11px] transition-all flex items-center gap-1 ${
                selectedArmId === arm.id
                  ? 'bg-industrial-800 text-white font-bold border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{
                borderColor: selectedArmId === arm.id ? arm.accentColor : 'transparent'
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: arm.accentColor }}
              />
              <span>Arm {idx + 1}</span>
            </button>
          ))}
        </div>

        {/* Camera Presets */}
        <div className="flex items-center gap-1 bg-industrial-900/90 backdrop-blur-md border border-industrial-750 px-2 py-1.5 rounded-lg shadow-xl text-xs font-medium text-slate-300">
          <span className="text-cyanAccent mr-1 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" /> View:
          </span>
          <button
            onClick={() => resetCamera('isometric')}
            className={`px-2 py-1 rounded transition-colors ${
              viewSettings.cameraPreset === 'isometric'
                ? 'bg-cyanAccent/20 text-cyanAccent'
                : 'hover:bg-industrial-800 text-slate-400'
            }`}
          >
            Iso
          </button>
          <button
            onClick={() => resetCamera('front')}
            className={`px-2 py-1 rounded transition-colors ${
              viewSettings.cameraPreset === 'front'
                ? 'bg-cyanAccent/20 text-cyanAccent'
                : 'hover:bg-industrial-800 text-slate-400'
            }`}
          >
            Front
          </button>
          <button
            onClick={() => resetCamera('side')}
            className={`px-2 py-1 rounded transition-colors ${
              viewSettings.cameraPreset === 'side'
                ? 'bg-cyanAccent/20 text-cyanAccent'
                : 'hover:bg-industrial-800 text-slate-400'
            }`}
          >
            Side
          </button>
          <button
            onClick={() => resetCamera('top')}
            className={`px-2 py-1 rounded transition-colors ${
              viewSettings.cameraPreset === 'top'
                ? 'bg-cyanAccent/20 text-cyanAccent'
                : 'hover:bg-industrial-800 text-slate-400'
            }`}
          >
            Top
          </button>
          <button
            onClick={() => resetCamera('isometric')}
            title="Reset Camera View"
            className="p-1 rounded hover:bg-industrial-800 text-slate-400 ml-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Visibility Toggles */}
        <div className="flex items-center gap-1 bg-industrial-900/90 backdrop-blur-md border border-industrial-750 p-1 rounded-lg shadow-xl text-xs text-slate-300">
          <button
            onClick={() => toggleViewSetting('showWorkspace')}
            title="Reachable Workspace Point Cloud"
            className={`p-1.5 rounded flex items-center gap-1 text-[11px] transition-colors ${
              viewSettings.showWorkspace
                ? 'bg-cyanAccent/20 text-cyanAccent border border-cyanAccent/40'
                : 'hover:bg-industrial-800 text-slate-400'
            }`}
          >
            <Eye className="w-3 h-3" /> Workspace
          </button>
          <button
            onClick={() => toggleViewSetting('showAxes')}
            title="Joint & World Coordinate Axes"
            className={`p-1.5 rounded flex items-center gap-1 text-[11px] transition-colors ${
              viewSettings.showAxes
                ? 'bg-cyanAccent/20 text-cyanAccent border border-cyanAccent/40'
                : 'hover:bg-industrial-800 text-slate-400'
            }`}
          >
            <Compass className="w-3 h-3" /> Axes
          </button>
          <button
            onClick={() => toggleViewSetting('showWireframe')}
            title="Wireframe View"
            className={`p-1.5 rounded flex items-center gap-1 text-[11px] transition-colors ${
              viewSettings.showWireframe
                ? 'bg-cyanAccent/20 text-cyanAccent border border-cyanAccent/40'
                : 'hover:bg-industrial-800 text-slate-400'
            }`}
          >
            <Box className="w-3 h-3" /> Wireframe
          </button>
          <button
            onClick={() => toggleViewSetting('showCollisionCapsules')}
            title="Geometric Collision Link Capsules"
            className={`p-1.5 rounded flex items-center gap-1 text-[11px] transition-colors ${
              viewSettings.showCollisionCapsules
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'hover:bg-industrial-800 text-slate-400'
            }`}
          >
            <Layers className="w-3 h-3" /> Capsules
          </button>
        </div>
      </div>

      {/* Prominent Deadlock & Clear Deadlock Resolution Overlay at Top-Right */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {isDeadlocked ? (
          <div className="flex items-center gap-2 bg-red-950/95 border-2 border-red-500 text-red-100 px-3.5 py-2 rounded-xl shadow-glow-red backdrop-blur-md animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <div className="font-bold text-xs font-mono">DEADLOCK INTERLOCK TRIPPED</div>
              <div className="text-[10px] text-red-300 font-mono">
                {deadlockReason || 'Collision zone interference between arms.'}
              </div>
            </div>
            <button
              onClick={clearDeadlock}
              className="ml-2 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs font-mono flex items-center gap-1.5 shadow-lg transition-transform active:scale-95"
            >
              <Unlock className="w-4 h-4" /> CLEAR DEADLOCK
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-industrial-900/90 border border-industrial-750 px-3 py-1.5 rounded-xl shadow-xl backdrop-blur-md">
            <button
              onClick={clearDeadlock}
              title="Manually clear interlocks and retract all 3 arms to home"
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" /> Clear Deadlock
            </button>
            <button
              onClick={triggerDeadlockDemo}
              title="Simulate mutual interference deadlock to test clearing"
              className="px-2 py-1 rounded-lg bg-industrial-950 hover:bg-industrial-800 text-slate-400 hover:text-amber-400 border border-industrial-800 font-mono text-[10px] transition-colors"
            >
              Test Trip
            </button>
          </div>
        )}
      </div>

      {/* Coordinates / HUD Status at Bottom Left */}
      <div className="absolute bottom-3 left-4 z-10 pointer-events-none text-[11px] font-mono text-slate-400 flex items-center gap-4 bg-industrial-950/85 px-3 py-1.5 rounded-lg border border-industrial-800 backdrop-blur-sm">
        <span className="text-cyanAccent font-semibold">3-Arm Collaborative Workcell Active</span>
        <span>•</span>
        <span>Interlock Safety: Normal</span>
        <span>•</span>
        <span>DLS Kinematics</span>
      </div>
    </div>
  );
};
