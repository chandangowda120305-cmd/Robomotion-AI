import React from 'react';
import {
  Bot,
  Compass,
  Cpu,
  PackageCheck,
  BarChart3,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useRobotStore } from '../store/useRobotStore';

export const OverviewPage: React.FC = () => {
  const setActiveTab = useRobotStore((s) => s.setActiveTab);
  const setJointAngles = useRobotStore((s) => s.setJointAngles);
  const addNotification = useRobotStore((s) => s.addNotification);

  const applyPreset = (angles: number[], name: string, targetTab?: any) => {
    setJointAngles(angles);
    addNotification(`Preset applied: ${name}`, 'success');
    if (targetTab) {
      setActiveTab(targetTab);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 text-slate-200">
      {/* Hero Industrial Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-industrial-900 via-industrial-850 to-industrial-900 border border-industrial-750 p-6 shadow-2xl">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded bg-cyanAccent/20 text-cyanAccent text-[11px] font-mono font-semibold border border-cyanAccent/30">
              Mechatronics & AI Engineering Platform
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-mono border border-emerald-500/30">
              6-DOF Digital Twin Active
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            RoboMotion AI — Virtual Robotic Arm & Motion Planning
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            A comprehensive software-based robotics engineering environment combining
            forward/inverse kinematics (Jacobian Damped Least Squares), 3D collision detection with
            link capsules, sampling-based AI motion planners (RRT / RRT* / Trajectory Optimization),
            closed-loop joint PID dynamics, and automated pick-and-place sequencing.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('studio')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyanAccent hover:bg-cyanAccent-dark text-industrial-950 font-semibold text-xs transition-all shadow-glow-cyan"
            >
              <Bot className="w-4 h-4" />
              <span>Open Robot Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTab('planning')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-industrial-800 hover:bg-industrial-750 text-slate-200 border border-industrial-700 font-semibold text-xs transition-all"
            >
              <Compass className="w-4 h-4" />
              <span>Launch Motion Planner</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-industrial-800 hover:bg-industrial-750 text-slate-200 border border-industrial-700 font-semibold text-xs transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Benchmark Algorithms</span>
            </button>
          </div>
        </div>
      </div>

      {/* Core Engineering Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-industrial-900/80 border border-industrial-800 p-4 rounded-xl flex flex-col justify-between hover:border-industrial-700 transition-colors">
          <div>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Kinematics & Jacobians</h3>
            <p className="text-xs text-slate-400 leading-normal">
              Continuous forward kinematics transforms and numerical DLS inverse kinematics with
              joint limits and null-space projection.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('studio')}
            className="mt-4 text-xs text-cyanAccent flex items-center gap-1 hover:underline font-mono"
          >
            Configure Arm &rarr;
          </button>
        </div>

        <div className="bg-industrial-900/80 border border-industrial-800 p-4 rounded-xl flex flex-col justify-between hover:border-industrial-700 transition-colors">
          <div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">AI Motion Planning</h3>
            <p className="text-xs text-slate-400 leading-normal">
              Joint-space RRT, asymptotically optimal RRT*, and randomized path shortcutting
              avoiding static and moving 3D obstacles.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('planning')}
            className="mt-4 text-xs text-amber-400 flex items-center gap-1 hover:underline font-mono"
          >
            Run Planners &rarr;
          </button>
        </div>

        <div className="bg-industrial-900/80 border border-industrial-800 p-4 rounded-xl flex flex-col justify-between hover:border-industrial-700 transition-colors">
          <div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/20">
              <PackageCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Pick & Place Automation</h3>
            <p className="text-xs text-slate-400 leading-normal">
              Multi-stage automated grasping pipeline: approach, grasp, gripper close, object
              attachment, transfer, and precision release.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('pick_place')}
            className="mt-4 text-xs text-emerald-400 flex items-center gap-1 hover:underline font-mono"
          >
            Execute Tasks &rarr;
          </button>
        </div>

        <div className="bg-industrial-900/80 border border-industrial-800 p-4 rounded-xl flex flex-col justify-between hover:border-industrial-700 transition-colors">
          <div>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 border border-blue-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Control & Dynamics</h3>
            <p className="text-xs text-slate-400 leading-normal">
              Cubic spline time-parameterized trajectories, acceleration limits, and closed-loop
              joint-level PID controller simulation.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('analytics')}
            className="mt-4 text-xs text-blue-400 flex items-center gap-1 hover:underline font-mono"
          >
            View Dynamics &rarr;
          </button>
        </div>
      </div>

      {/* Quick Demonstration Presets */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyanAccent" />
          <span>Interactive Engineering Scenarios</span>
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Select an industrial scenario to load predefined joint postures and workspace setups:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => applyPreset([0.0, 0.45, -0.85, 0.4, 0.0, 0.0], 'Arc Welding Ready', 'planning')}
            className="p-3.5 bg-industrial-950 rounded-xl border border-industrial-800 hover:border-cyanAccent/50 cursor-pointer transition-all group"
          >
            <div className="text-xs font-semibold text-white group-hover:text-cyanAccent mb-1">
              Arc Welding Toolpath
            </div>
            <p className="text-[11px] text-slate-400">
              Configures arm for continuous seam welding with downward torch orientation.
            </p>
          </div>

          <div
            onClick={() => applyPreset([0.78, 0.25, -0.6, 0.35, 0.78, 0.0], 'Palletizing Staging', 'pick_place')}
            className="p-3.5 bg-industrial-950 rounded-xl border border-industrial-800 hover:border-cyanAccent/50 cursor-pointer transition-all group"
          >
            <div className="text-xs font-semibold text-white group-hover:text-cyanAccent mb-1">
              Palletizing Staging
            </div>
            <p className="text-[11px] text-slate-400">
              Rotates manipulator toward conveyor intake for rapid package handling.
            </p>
          </div>

          <div
            onClick={() => applyPreset([-0.65, 0.35, -0.5, 0.15, 0.0, 0.0], 'Obstacle Clearance', 'planning')}
            className="p-3.5 bg-industrial-950 rounded-xl border border-industrial-800 hover:border-cyanAccent/50 cursor-pointer transition-all group"
          >
            <div className="text-xs font-semibold text-white group-hover:text-cyanAccent mb-1">
              Obstacle Clearance Benchmark
            </div>
            <p className="text-[11px] text-slate-400">
              Sets start position opposite to barrier obstacle to benchmark RRT vs RRT*.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
