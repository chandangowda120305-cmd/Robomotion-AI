import React, { useState } from 'react';
import {
  Compass,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Activity,
  Zap,
  Sliders
} from 'lucide-react';
import { useRobotStore } from '../store/useRobotStore';
import { apiClient } from '../api/client';
import { Obstacle } from '../types';

export const MotionPlanningPage: React.FC = () => {
  const jointAngles = useRobotStore((s) => s.jointAngles);
  const selectedAlgorithm = useRobotStore((s) => s.selectedAlgorithm);
  const setSelectedAlgorithm = useRobotStore((s) => s.setSelectedAlgorithm);
  const planningParams = useRobotStore((s) => s.planningParams);
  const setPlanningParams = useRobotStore((s) => s.setPlanningParams);
  const obstacles = useRobotStore((s) => s.obstacles);
  const addObstacle = useRobotStore((s) => s.addObstacle);
  const updateObstacle = useRobotStore((s) => s.updateObstacle);
  const removeObstacle = useRobotStore((s) => s.removeObstacle);
  const arms = useRobotStore((s) => s.arms);
  const selectedArmId = useRobotStore((s) => s.selectedArmId);
  const setSelectedArmId = useRobotStore((s) => s.setSelectedArmId);
  const isDeadlocked = useRobotStore((s) => s.isDeadlocked);
  const clearDeadlock = useRobotStore((s) => s.clearDeadlock);
  const selectedObstacleId = useRobotStore((s) => s.selectedObstacleId);
  const selectObstacle = useRobotStore((s) => s.selectObstacle);

  const isPlanning = useRobotStore((s) => s.isPlanning);
  const setIsPlanning = useRobotStore((s) => s.setIsPlanning);
  const planResult = useRobotStore((s) => s.planResult);
  const setPlanResult = useRobotStore((s) => s.setPlanResult);
  const setTrajectory = useRobotStore((s) => s.setTrajectory);
  const setTelemetry = useRobotStore((s) => s.setTelemetry);
  const startSimulation = useRobotStore((s) => s.startSimulation);
  const addNotification = useRobotStore((s) => s.addNotification);
  const setCollisionStatus = useRobotStore((s) => s.setCollisionStatus);
  const isColliding = useRobotStore((s) => s.isColliding);

  // Target Goal Joint Configuration
  const [goalAngles, setGoalAngles] = useState<number[]>([0.7, 0.45, -0.65, 0.2, -0.1, 0.0]);

  // Execute Motion Planning
  const handlePlanPath = async () => {
    setIsPlanning(true);
    try {
      // 1. Run Collision check on start and goal first
      const startCheck = await apiClient.checkCollision(jointAngles, obstacles);
      setCollisionStatus(startCheck);
      if (startCheck.in_collision) {
        addNotification(`Start posture collides with ${startCheck.colliding_link_name}!`, 'error');
        setIsPlanning(false);
        return;
      }

      // 2. Request Motion Planning
      const res = await apiClient.planMotion({
        start_angles: jointAngles,
        goal_angles: goalAngles,
        algorithm: selectedAlgorithm,
        obstacles: obstacles,
        max_iterations: planningParams.maxIterations,
        step_size: planningParams.stepSize,
        goal_bias: planningParams.goalBias,
        rewire_radius: planningParams.rewireRadius,
        random_seed: planningParams.randomSeed
      });

      setPlanResult(res);

      if (res.success) {
        addNotification(`Plan succeeded using ${res.algorithm}! Generating trajectory...`, 'success');

        // Automatically generate time-parameterized cubic spline trajectory
        const traj = await apiClient.generateTrajectory({
          path: res.path,
          method: 'cubic_spline',
          speed_factor: planningParams.speedFactor
        });
        setTrajectory(traj);

        // Generate PID closed-loop simulation telemetry
        const tel = await apiClient.simulateTelemetry({
          trajectory: traj,
          load_mass: 0.25
        });
        setTelemetry(tel);

        // Record run to database
        await apiClient.saveSimulationRun({
          algorithm: res.algorithm,
          success: true,
          planning_time_ms: res.planning_time_s * 1000,
          execution_time_s: traj.total_duration,
          path_length: res.path_cost,
          sampled_nodes: res.sampled_nodes,
          collision_checks: res.collision_checks,
          max_velocity: traj.max_velocity,
          max_acceleration: traj.max_acceleration,
          rms_tracking_error: tel.rms_tracking_error,
          name: `${res.algorithm} to [${goalAngles.map((a) => (a * 57.3).toFixed(0)).join(', ')}]`
        });
      } else {
        addNotification(`Planning Failed: ${res.message}`, 'error');
      }
    } catch (err: any) {
      addNotification(`Error: ${err.message}`, 'error');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleAddNewObstacle = (type: 'box' | 'sphere' | 'cylinder') => {
    const id = `obs-${Date.now()}`;
    const newObs: Obstacle = {
      id,
      name: `${type.toUpperCase()} Obstacle`,
      type,
      position: [0.15, 0.45, 0.2],
      rotation: [0, 0, 0],
      size: type === 'box' ? [0.18, 0.25, 0.18] : type === 'sphere' ? [0.12, 0, 0] : [0.08, 0.3, 0],
      velocity: [0, 0, 0],
      is_moving: false,
      color: type === 'box' ? '#f59e0b' : type === 'sphere' ? '#38bdf8' : '#ef4444'
    };
    addObstacle(newObs);
    selectObstacle(id);
    addNotification(`Added ${type} obstacle`, 'info');
  };

  const selectedObs = obstacles.find((o) => o.id === selectedObstacleId);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs select-none">
      {/* Arm Focus & Deadlock Resolution */}
      <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white font-mono">Plan Trajectory For:</span>
          <div className="flex items-center gap-1.5 font-mono">
            {arms.map((arm, idx) => (
              <button
                key={arm.id}
                onClick={() => setSelectedArmId(arm.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  selectedArmId === arm.id
                    ? 'bg-industrial-800 text-white shadow-sm border'
                    : 'bg-industrial-950 text-slate-400 hover:text-white border border-industrial-850'
                }`}
                style={{
                  borderColor: selectedArmId === arm.id ? arm.accentColor : undefined
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: arm.accentColor }} />
                <span>{arm.name}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={clearDeadlock}
          title="Clear cell deadlock, release interlocks, and yield all arms to safe home postures"
          className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors"
        >
          <span>CLEAR DEADLOCK</span>
        </button>
      </div>

      {/* Algorithm Selector Bar */}
      <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyanAccent" />
          <span className="font-semibold text-white">Motion Planning Algorithm:</span>
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { id: 'rrt', label: 'RRT' },
            { id: 'rrt_star', label: 'RRT*' },
            { id: 'rrt_star_opt', label: 'RRT* + Trajectory Opt' },
            { id: 'direct', label: 'Direct Interpolation (Baseline)' }
          ].map((alg) => (
            <button
              key={alg.id}
              onClick={() => setSelectedAlgorithm(alg.id as any)}
              className={`px-3 py-1.5 rounded-lg font-mono text-[11px] transition-all ${
                selectedAlgorithm === alg.id
                  ? 'bg-cyanAccent text-industrial-950 font-bold shadow-glow-cyan'
                  : 'bg-industrial-950 text-slate-400 hover:text-slate-200 border border-industrial-800'
              }`}
            >
              {alg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (5 cols): Parameter Controls & Target Posture */}
        <div className="lg:col-span-5 space-y-4">
          {/* Planner Hyperparameters */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyanAccent" />
                <span>Hyperparameter Configuration</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase">Joint Space</span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div>
                <label className="text-slate-400 block mb-1">Max Iterations</label>
                <input
                  type="number"
                  step="100"
                  min="200"
                  max="4000"
                  value={planningParams.maxIterations}
                  onChange={(e) =>
                    setPlanningParams({ maxIterations: parseInt(e.target.value) || 1000 })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Step Size (rad)</label>
                <input
                  type="number"
                  step="0.02"
                  min="0.05"
                  max="0.5"
                  value={planningParams.stepSize}
                  onChange={(e) =>
                    setPlanningParams({ stepSize: parseFloat(e.target.value) || 0.15 })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Goal Bias (0-1)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="0.5"
                  value={planningParams.goalBias}
                  onChange={(e) =>
                    setPlanningParams({ goalBias: parseFloat(e.target.value) || 0.15 })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Rewire Radius (rad)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.2"
                  max="1.0"
                  value={planningParams.rewireRadius}
                  onChange={(e) =>
                    setPlanningParams({ rewireRadius: parseFloat(e.target.value) || 0.45 })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Random Seed</label>
                <input
                  type="number"
                  value={planningParams.randomSeed}
                  onChange={(e) =>
                    setPlanningParams({ randomSeed: parseInt(e.target.value) || 42 })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Execution Speed</label>
                <input
                  type="number"
                  step="0.2"
                  min="0.2"
                  max="2.5"
                  value={planningParams.speedFactor}
                  onChange={(e) =>
                    setPlanningParams({ speedFactor: parseFloat(e.target.value) || 1.0 })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Target Goal Configuration */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white">Target Goal Joint Configuration</span>
              <button
                onClick={() => setGoalAngles([...jointAngles])}
                className="text-[10px] text-cyanAccent font-mono hover:underline"
              >
                Set From Current
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              {goalAngles.map((ang, idx) => (
                <div key={idx} className="bg-industrial-950 p-2 rounded border border-industrial-850">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>J{idx + 1}</span>
                    <span>{(ang * 57.3).toFixed(0)}°</span>
                  </div>
                  <input
                    type="range"
                    min={idx === 1 || idx === 2 ? -135 : -180}
                    max={idx === 1 || idx === 2 ? 135 : 180}
                    value={ang * 57.2958}
                    onChange={(e) => {
                      const newG = [...goalAngles];
                      newG[idx] = (parseFloat(e.target.value) * Math.PI) / 180;
                      setGoalAngles(newG);
                    }}
                    className="w-full accent-cyan-400 h-1 bg-industrial-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* Plan Button */}
            <div className="pt-2 flex gap-2">
              <button
                onClick={handlePlanPath}
                disabled={isPlanning}
                className="flex-1 py-2.5 rounded-xl bg-cyanAccent hover:bg-cyanAccent-dark text-industrial-950 font-bold text-xs transition-all shadow-glow-cyan flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Compass className="w-4 h-4" />
                <span>{isPlanning ? 'Computing Tree...' : 'Plan Collision-Free Path'}</span>
              </button>

              <button
                onClick={startSimulation}
                disabled={!planResult || !planResult.success}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-industrial-950 font-bold text-xs transition-all shadow-glow-amber flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                <span>Simulate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Obstacles Manager & Real Empirical Metrics */}
        <div className="lg:col-span-7 space-y-4">
          {/* Obstacle Manager Card */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Dynamic Workspace Obstacles ({obstacles.length})</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddNewObstacle('box')}
                  className="px-2 py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-amber-400/50 text-slate-300 text-[10px] font-mono flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Box
                </button>
                <button
                  onClick={() => handleAddNewObstacle('sphere')}
                  className="px-2 py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-cyanAccent/50 text-slate-300 text-[10px] font-mono flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Sphere
                </button>
                <button
                  onClick={() => handleAddNewObstacle('cylinder')}
                  className="px-2 py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-rose-400/50 text-slate-300 text-[10px] font-mono flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Cyl
                </button>
              </div>
            </div>

            {/* Obstacle List and Inspector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {obstacles.map((obs) => {
                  const isSelected = selectedObstacleId === obs.id;
                  return (
                    <div
                      key={obs.id}
                      onClick={() => selectObstacle(obs.id)}
                      className={`p-2 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-industrial-800 border-cyanAccent/50 text-white'
                          : 'bg-industrial-950 border-industrial-850 text-slate-400 hover:border-industrial-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: obs.color || '#f59e0b' }}
                        />
                        <span className="font-mono text-[11px] font-medium">{obs.name}</span>
                        <span className="text-[9px] uppercase px-1 rounded bg-industrial-900 border border-industrial-750">
                          {obs.type}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeObstacle(obs.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Selected Obstacle Parameter Editor */}
              {selectedObs ? (
                <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850 font-mono text-[10px] space-y-2">
                  <span className="font-bold text-slate-200 block">Edit: {selectedObs.name}</span>
                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      <span className="text-slate-500 block">Pos X</span>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedObs.position[0]}
                        onChange={(e) =>
                          updateObstacle(selectedObs.id, {
                            position: [parseFloat(e.target.value) || 0, selectedObs.position[1], selectedObs.position[2]]
                          })
                        }
                        className="w-full bg-industrial-900 border border-industrial-800 rounded px-1.5 py-1 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 block">Pos Y</span>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedObs.position[1]}
                        onChange={(e) =>
                          updateObstacle(selectedObs.id, {
                            position: [selectedObs.position[0], parseFloat(e.target.value) || 0, selectedObs.position[2]]
                          })
                        }
                        className="w-full bg-industrial-900 border border-industrial-800 rounded px-1.5 py-1 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 block">Pos Z</span>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedObs.position[2]}
                        onChange={(e) =>
                          updateObstacle(selectedObs.id, {
                            position: [selectedObs.position[0], selectedObs.position[1], parseFloat(e.target.value) || 0]
                          })
                        }
                        className="w-full bg-industrial-900 border border-industrial-800 rounded px-1.5 py-1 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedObs.is_moving || false}
                        onChange={(e) =>
                          updateObstacle(selectedObs.id, {
                            is_moving: e.target.checked,
                            velocity: e.target.checked ? [0.05, 0, 0] : [0, 0, 0]
                          })
                        }
                        className="rounded accent-cyan-400"
                      />
                      <span>Dynamic Moving Obstacle</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="bg-industrial-950 p-4 rounded-lg border border-industrial-850 flex items-center justify-center text-slate-500 font-mono text-[11px]">
                  Select an obstacle to inspect or edit position
                </div>
              )}
            </div>
          </div>

          {/* Real Planning Results & Benchmark Metric Cards */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Empirical Motion Planning Metrics</span>
              </span>
              {planResult && (
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    planResult.success
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {planResult.success ? 'SUCCESS' : 'FAILED'}
                </span>
              )}
            </div>

            {planResult ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                    <span className="text-[10px] text-slate-500 block">Planning Time</span>
                    <span className="text-cyanAccent font-bold text-sm">
                      {(planResult.planning_time_s * 1000).toFixed(1)} ms
                    </span>
                  </div>
                  <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                    <span className="text-[10px] text-slate-500 block">Total Path Cost</span>
                    <span className="text-white font-bold text-sm">
                      {planResult.path_cost.toFixed(3)} rad
                    </span>
                  </div>
                  <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                    <span className="text-[10px] text-slate-500 block">Waypoints</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {planResult.path.length} nodes
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                    <span className="text-[10px] text-slate-500 block">Sampled Configs</span>
                    <span className="text-slate-200 font-semibold">{planResult.sampled_nodes}</span>
                  </div>
                  <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                    <span className="text-[10px] text-slate-500 block">Collision Checks</span>
                    <span className="text-slate-200 font-semibold">
                      {planResult.collision_checks}
                    </span>
                  </div>
                  <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                    <span className="text-[10px] text-slate-500 block">Rejected (Collision)</span>
                    <span className="text-amber-400 font-semibold">
                      {planResult.rejected_nodes}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-mono bg-industrial-950 p-2 rounded border border-industrial-850">
                  {planResult.message}
                </p>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 font-mono text-[11px]">
                No motion plan calculated yet. Configure start/goal and click 'Plan Collision-Free Path'.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
