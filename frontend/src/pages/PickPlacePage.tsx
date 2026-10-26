import React, { useState } from 'react';
import {
  PackageCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  ShieldAlert,
  Activity,
  Layers,
  CheckCircle,
  XCircle,
  X,
  Sparkles,
  Bot,
  Zap,
  Boxes,
  Circle,
  Square,
  Box
} from 'lucide-react';
import { useRobotStore } from '../store/useRobotStore';
import { apiClient } from '../api/client';
import { PickPlaceTask, TrajectoryData } from '../types';

export type ExecutionPhase =
  | 'IDLE'
  | 'VALIDATING'
  | 'PLANNING_APPROACH'
  | 'MOVING_TO_PREGRASP'
  | 'APPROACHING_OBJECT'
  | 'GRASPING'
  | 'LIFTING'
  | 'PLANNING_TRANSFER'
  | 'TRANSFERRING'
  | 'PLANNING_PLACE'
  | 'PLACING'
  | 'RELEASING'
  | 'RETURNING_HOME'
  | 'COMPLETED'
  | 'FAILED'
  | 'SWARM_SYNCHRONIZED';

interface DiagnosticStage {
  stage_number: number;
  stage_name: string;
  status: 'passed' | 'failed';
  duration_ms: number;
  details: string;
  data?: Record<string, any>;
}

interface DiagnosticsData {
  task_id: string;
  stages: DiagnosticStage[];
  all_passed: boolean;
  failure_stage: number | null;
  overall_message: string;
}

export const PickPlacePage: React.FC = () => {
  const tasks = useRobotStore((s) => s.pickPlaceTasks);
  const addTask = useRobotStore((s) => s.addTask);
  const updateTask = useRobotStore((s) => s.updateTask);
  const removeTask = useRobotStore((s) => s.removeTask);
  const obstacles = useRobotStore((s) => s.obstacles);
  const arms = useRobotStore((s) => s.arms);
  const selectedArmId = useRobotStore((s) => s.selectedArmId);
  const setSelectedArmId = useRobotStore((s) => s.setSelectedArmId);
  const setArmJointAngles = useRobotStore((s) => s.setArmJointAngles);
  const setJointAngles = useRobotStore((s) => s.setJointAngles);
  const gripperState = useRobotStore((s) => s.gripperState);
  const setGripperState = useRobotStore((s) => s.setGripperState);
  const setArmGripperState = useRobotStore((s) => s.setArmGripperState);
  const setAttachedObjectId = useRobotStore((s) => s.setAttachedObjectId);
  const setArmAttachedObject = useRobotStore((s) => s.setArmAttachedObject);
  const armAttachedObjects = useRobotStore((s) => s.armAttachedObjects);
  const addNotification = useRobotStore((s) => s.addNotification);
  const setTrajectory = useRobotStore((s) => s.setTrajectory);
  const startSimulation = useRobotStore((s) => s.startSimulation);
  const stopSimulation = useRobotStore((s) => s.stopSimulation);

  // Swarm coordination store methods
  const isSwarmRunning = useRobotStore((s) => s.isSwarmRunning);
  const setArmTrajectory = useRobotStore((s) => s.setArmTrajectory);
  const startSwarmSimulation = useRobotStore((s) => s.startSwarmSimulation);
  const stopSwarmSimulation = useRobotStore((s) => s.stopSwarmSimulation);
  const setSwarmPhase = useRobotStore((s) => s.setSwarmPhase);

  const activeArm = arms.find((a) => a.id === selectedArmId) || arms[1];

  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [isExecutingQueue, setIsExecutingQueue] = useState<boolean>(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [activePhase, setActivePhase] = useState<ExecutionPhase>('IDLE');

  // Diagnostics State
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState<boolean>(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<DiagnosticsData | null>(null);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);

  // Custom Object Creator Modal State
  const [showObjectCreator, setShowObjectCreator] = useState<boolean>(false);
  const [newObjName, setNewObjName] = useState('Titanium Shaft Component');
  const [newObjType, setNewObjType] = useState<'box' | 'cylinder' | 'sphere'>('cylinder');
  const [newObjColor, setNewObjColor] = useState('#38bdf8');
  const [newObjSizeX, setNewObjSizeX] = useState(0.04);
  const [newObjSizeY, setNewObjSizeY] = useState(0.08);
  const [newObjSizeZ, setNewObjSizeZ] = useState(0.04);
  const [newObjPickX, setNewObjPickX] = useState(0.25);
  const [newObjPickY, setNewObjPickY] = useState(0.12);
  const [newObjPickZ, setNewObjPickZ] = useState(0.25);
  const [newObjPlaceX, setNewObjPlaceX] = useState(-0.25);
  const [newObjPlaceY, setNewObjPlaceY] = useState(0.12);
  const [newObjPlaceZ, setNewObjPlaceZ] = useState(0.25);
  const [newObjAssignedArm, setNewObjAssignedArm] = useState('arm-2');
  const [newObjMass, setNewObjMass] = useState(0.25);

  const appendLog = (msg: string) => {
    setExecutionLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 25)]);
  };

  // Run comprehensive 10-stage diagnostic suite for an individual task
  const handleRunDiagnostics = async (task: PickPlaceTask) => {
    setIsRunningDiagnostics(true);
    const assignedArm = arms.find((a) => a.id === (task.assignedArmId || selectedArmId)) || activeArm;
    appendLog(`[DIAGNOSTICS] Launching 10-stage verification for '${task.name}' on ${assignedArm.name}...`);

    try {
      const res = await apiClient.runDiagnostics({
        task,
        start_angles: assignedArm.jointAngles,
        obstacles,
        arm_base_pos: assignedArm.basePosition,
        arm_base_yaw: assignedArm.baseRotation
      });

      setDiagnosticsResult(res);
      setShowDiagnosticsModal(true);

      if (res.all_passed) {
        appendLog(`[DIAGNOSTICS] ALL 10 STAGES PASSED: ${res.overall_message}`);
        addNotification(`All 10 diagnostic stages passed for '${task.name}'`, 'success');
      } else {
        appendLog(`[DIAGNOSTICS] FAILED at Stage ${res.failure_stage}: ${res.overall_message}`);
        addNotification(`Diagnostics failed at stage ${res.failure_stage}: ${res.overall_message}`, 'error');
      }
    } catch (err: any) {
      appendLog(`[DIAGNOSTICS ERROR] ${err.message}`);
      addNotification(`Failed running diagnostics: ${err.message}`, 'error');
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  // Execute full multi-stage pick-and-place sequence for a single assigned arm
  const handleExecuteTask = async (task: PickPlaceTask) => {
    setIsExecutingQueue(true);
    setActivePhase('VALIDATING');
    updateTask(task.id, { status: 'planning', progress: 5 });
    const assignedArm = arms.find((a) => a.id === (task.assignedArmId || selectedArmId)) || activeArm;
    appendLog(`[EXEC] Pre-validating kinematics & environment for '${task.name}' (${assignedArm.name})...`);

    try {
      const planRes = await apiClient.planPickPlace({
        task,
        start_angles: assignedArm.jointAngles,
        obstacles,
        arm_base_pos: assignedArm.basePosition,
        arm_base_yaw: assignedArm.baseRotation
      });

      if (!planRes.success) {
        setActivePhase('FAILED');
        updateTask(task.id, { status: 'failed', error_message: planRes.error_message });
        appendLog(`[EXEC ERROR] Planning failed: ${planRes.error_message}`);
        addNotification(`Trajectory planning failed: ${planRes.error_message}`, 'error');
        setIsExecutingQueue(false);
        return;
      }

      updateTask(task.id, { status: 'executing', progress: 20 });
      appendLog(`[EXEC] Generated ${planRes.stages.length} verified motion stages.`);
      addNotification(`Executing pick & place sequence on ${assignedArm.name}!`, 'success');

      for (let s = 0; s < planRes.stages.length; s++) {
        const stage = planRes.stages[s];
        appendLog(`[STAGE ${s + 1}/${planRes.stages.length}] ${stage.name}`);

        if (stage.name.toLowerCase().includes('pre-pick')) {
          setActivePhase('MOVING_TO_PREGRASP');
        } else if (stage.name.toLowerCase().includes('approach')) {
          setActivePhase('APPROACHING_OBJECT');
        } else if (stage.action === 'gripper_close') {
          setActivePhase('GRASPING');
        } else if (stage.name.toLowerCase().includes('lift')) {
          setActivePhase('LIFTING');
        } else if (stage.name.toLowerCase().includes('transfer')) {
          setActivePhase('TRANSFERRING');
        } else if (stage.name.toLowerCase().includes('place') && stage.action === 'move') {
          setActivePhase('PLACING');
        } else if (stage.action === 'gripper_open') {
          setActivePhase('RELEASING');
        } else if (stage.name.toLowerCase().includes('home') || stage.name.toLowerCase().includes('return')) {
          setActivePhase('RETURNING_HOME');
        }

        if (stage.action === 'move' && stage.trajectory) {
          setTrajectory(stage.trajectory);
          startSimulation();
          const durationMs = Math.max(900, (stage.trajectory.total_duration / 1.0) * 1000);
          await new Promise((r) => setTimeout(r, durationMs));
          stopSimulation();
          const finalPos = stage.trajectory.positions[stage.trajectory.positions.length - 1];
          setArmJointAngles(assignedArm.id, finalPos);
          if (assignedArm.id === selectedArmId) {
            setJointAngles(finalPos);
          }
        } else if (stage.action === 'gripper_close') {
          setArmGripperState(assignedArm.id, 'closed');
          setArmAttachedObject(assignedArm.id, task.object_id);
          await new Promise((r) => setTimeout(r, 650));
        } else if (stage.action === 'gripper_open') {
          setArmGripperState(assignedArm.id, 'open');
          setArmAttachedObject(assignedArm.id, null);
          await new Promise((r) => setTimeout(r, 650));
        }

        const pct = Math.round(((s + 1) / planRes.stages.length) * 100);
        updateTask(task.id, { progress: pct });
      }

      setActivePhase('COMPLETED');
      updateTask(task.id, { status: 'completed', progress: 100 });
      appendLog(`[EXEC SUCCESS] Object '${task.object_id}' transferred and placed with zero errors!`);
      addNotification(`Task '${task.name}' successfully completed!`, 'success');
    } catch (err: any) {
      setActivePhase('FAILED');
      updateTask(task.id, { status: 'failed', error_message: err.message });
      appendLog(`[FATAL ERROR] ${err.message}`);
      addNotification(`Execution error: ${err.message}`, 'error');
    } finally {
      setIsExecutingQueue(false);
    }
  };

  // Simultaneous Swarm Coordination: All 3 robotic arms plan and execute concurrently!
  const handleExecuteSwarmCoordination = async () => {
    if (isExecutingQueue || isSwarmRunning) return;
    setIsExecutingQueue(true);
    setActivePhase('SWARM_SYNCHRONIZED');
    setSwarmPhase('SWARM_PLANNING');
    appendLog(`[SWARM] Initializing Simultaneous Swarm Coordination for 3-Arm Workcell...`);
    addNotification('Swarm Coordination Activated: Synchronizing 3 Collaborative Robots!', 'info');

    try {
      // 1. Identify distinct tasks for the 3 arms
      const taskArm1 = tasks.find((t) => t.assignedArmId === 'arm-1' || t.id === 'task-1') || tasks[0];
      const taskArm2 = tasks.find((t) => t.assignedArmId === 'arm-2' || t.id === 'task-2') || tasks[1];
      const taskArm3 = tasks.find((t) => t.assignedArmId === 'arm-3' || t.id === 'task-3') || tasks[2];

      const swarmJobs = [
        { arm: arms[0], task: taskArm1 },
        { arm: arms[1], task: taskArm2 },
        { arm: arms[2], task: taskArm3 }
      ];

      appendLog(`[SWARM] Synthesizing simultaneous motion trajectories across Arm 1, Arm 2, and Arm 3...`);

      // Plan for all 3 arms simultaneously using Promise.all
      const planResults = await Promise.all(
        swarmJobs.map((job) => {
          updateTask(job.task.id, { status: 'planning', progress: 15 });
          return apiClient.planPickPlace({
            task: job.task,
            start_angles: job.arm.jointAngles,
            obstacles,
            arm_base_pos: job.arm.basePosition,
            arm_base_yaw: job.arm.baseRotation
          });
        })
      );

      // Check if all planned successfully
      for (let i = 0; i < planResults.length; i++) {
        if (!planResults[i].success) {
          throw new Error(
            `${swarmJobs[i].arm.name} failed trajectory synthesis: ${planResults[i].error_message}`
          );
        }
      }

      appendLog(`[SWARM] All 3 arms successfully generated collision-free trajectories! Launching synchronized execution...`);
      swarmJobs.forEach((job) => updateTask(job.task.id, { status: 'executing', progress: 25 }));

      // Find maximum number of stages across the 3 arms
      const maxStages = Math.max(...planResults.map((p) => p.stages.length));

      // Execute each stage in coordinated lockstep
      for (let s = 0; s < maxStages; s++) {
        appendLog(`[SWARM CYCLE ${s + 1}/${maxStages}] Synchronizing motion step across all 3 robots...`);

        // Prepare simultaneous trajectories and gripper actions for this stage
        const stage1 = planResults[0].stages[s] || planResults[0].stages[planResults[0].stages.length - 1];
        const stage2 = planResults[1].stages[s] || planResults[1].stages[planResults[1].stages.length - 1];
        const stage3 = planResults[2].stages[s] || planResults[2].stages[planResults[2].stages.length - 1];

        // Trigger simultaneous arm trajectories in 3D canvas
        if (stage1?.action === 'move' && stage1.trajectory) {
          setArmTrajectory('arm-1', stage1.trajectory);
        }
        if (stage2?.action === 'move' && stage2.trajectory) {
          setArmTrajectory('arm-2', stage2.trajectory);
        }
        if (stage3?.action === 'move' && stage3.trajectory) {
          setArmTrajectory('arm-3', stage3.trajectory);
        }

        startSwarmSimulation();

        // Calculate max duration for this synchronized cycle
        const dur1 = stage1?.trajectory?.total_duration || 0.8;
        const dur2 = stage2?.trajectory?.total_duration || 0.8;
        const dur3 = stage3?.trajectory?.total_duration || 0.8;
        const maxDurationMs = Math.max(900, Math.max(dur1, dur2, dur3) * 1000);

        // Wait for all three arms to complete this synchronized trajectory in real time
        await new Promise((r) => setTimeout(r, maxDurationMs));
        stopSwarmSimulation();

        // Handle simultaneous gripper actions & object couplings
        if (stage1?.action === 'gripper_close') {
          setArmGripperState('arm-1', 'closed');
          setArmAttachedObject('arm-1', taskArm1.object_id);
        } else if (stage1?.action === 'gripper_open') {
          setArmGripperState('arm-1', 'open');
          setArmAttachedObject('arm-1', null);
        }

        if (stage2?.action === 'gripper_close') {
          setArmGripperState('arm-2', 'closed');
          setArmAttachedObject('arm-2', taskArm2.object_id);
        } else if (stage2?.action === 'gripper_open') {
          setArmGripperState('arm-2', 'open');
          setArmAttachedObject('arm-2', null);
        }

        if (stage3?.action === 'gripper_close') {
          setArmGripperState('arm-3', 'closed');
          setArmAttachedObject('arm-3', taskArm3.object_id);
        } else if (stage3?.action === 'gripper_open') {
          setArmGripperState('arm-3', 'open');
          setArmAttachedObject('arm-3', null);
        }

        // Commit final joint postures for all 3 arms
        if (stage1?.trajectory?.positions) {
          const finalPos1 = stage1.trajectory.positions[stage1.trajectory.positions.length - 1];
          setArmJointAngles('arm-1', finalPos1);
        }
        if (stage2?.trajectory?.positions) {
          const finalPos2 = stage2.trajectory.positions[stage2.trajectory.positions.length - 1];
          setArmJointAngles('arm-2', finalPos2);
        }
        if (stage3?.trajectory?.positions) {
          const finalPos3 = stage3.trajectory.positions[stage3.trajectory.positions.length - 1];
          setArmJointAngles('arm-3', finalPos3);
        }

        const pct = Math.round(((s + 1) / maxStages) * 100);
        swarmJobs.forEach((job) => updateTask(job.task.id, { progress: pct }));
      }

      // Mark all 3 tasks completed
      swarmJobs.forEach((job) => updateTask(job.task.id, { status: 'completed', progress: 100 }));
      setActivePhase('COMPLETED');
      setSwarmPhase('COMPLETED');
      appendLog(`[SWARM SUCCESS] 3-Arm Swarm Cycle Finished! All 3 objects successfully transferred & palletized.`);
      addNotification('Swarm Coordination Complete: All 3 parts processed simultaneously!', 'success');
    } catch (err: any) {
      setActivePhase('FAILED');
      setSwarmPhase('FAILED');
      appendLog(`[SWARM ERROR] ${err.message}`);
      addNotification(`Swarm coordination error: ${err.message}`, 'error');
    } finally {
      setIsExecutingQueue(false);
      stopSwarmSimulation();
    }
  };

  // Add Custom Object Handler
  const handleCreateCustomObject = () => {
    const id = `task-${Date.now()}`;
    const object_id = `obj-${Date.now()}`;

    const size: [number, number, number] =
      newObjType === 'sphere'
        ? [newObjSizeX, newObjSizeX, newObjSizeX]
        : newObjType === 'cylinder'
        ? [newObjSizeX, newObjSizeY, 0]
        : [newObjSizeX, newObjSizeY, newObjSizeZ];

    const newTask: PickPlaceTask = {
      id,
      name: newObjName || `Custom ${newObjType.toUpperCase()}`,
      object_id,
      object_type: newObjType,
      object_color: newObjColor,
      object_size: size,
      pick_position: [newObjPickX, newObjPickY, newObjPickZ],
      place_position: [newObjPlaceX, newObjPlaceY, newObjPlaceZ],
      status: 'pending',
      progress: 0,
      assignedArmId: newObjAssignedArm,
      mass: newObjMass
    };

    addTask(newTask);
    setShowObjectCreator(false);
    addNotification(`Created new ${newObjType} object '${newTask.name}'!`, 'success');
    appendLog(`[OBJECT CREATOR] Registered new object '${newTask.name}' (${newObjType}, mass ${newObjMass}kg).`);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs select-none">
      {/* Top Banner & Multi-Arm Swarm Header */}
      <div className="bg-industrial-900 border border-industrial-800 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-amber-500/10 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyanAccent shadow-inner">
            <Zap className="w-5 h-5 text-cyanAccent animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white block text-sm">
                RoboMotion Swarm — 3-Arm Collaborative Pick & Place Workcell
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyanAccent/10 text-cyanAccent border border-cyanAccent/30">
                Multi-Robot Swarm
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Simultaneous multi-arm trajectory coordination with collision-free handovers & arbitrary payload manipulation
            </span>
          </div>
        </div>

        {/* Global Swarm Execution & Add Object Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add Custom Object Button */}
          <button
            onClick={() => setShowObjectCreator(true)}
            className="px-3 py-1.5 rounded-lg bg-industrial-950 border border-industrial-750 hover:border-cyan-500/50 text-cyan-300 font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Object / Part
          </button>

          {/* Master 3-Arm Swarm Coordination Trigger */}
          <button
            onClick={handleExecuteSwarmCoordination}
            disabled={isExecutingQueue || isSwarmRunning}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-industrial-950 font-bold font-mono text-[11px] flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-current" />
            {isSwarmRunning ? 'Swarm Moving...' : 'Execute 3-Arm Swarm'}
          </button>

          {/* Assigned Arm Selector */}
          <div className="flex items-center gap-1 bg-industrial-950 p-1 rounded-lg border border-industrial-800">
            <span className="text-[10px] text-slate-400 font-mono px-1 flex items-center gap-1">
              <Bot className="w-3 h-3 text-cyanAccent" /> Active:
            </span>
            {arms.map((arm) => (
              <button
                key={arm.id}
                onClick={() => setSelectedArmId(arm.id)}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                  selectedArmId === arm.id
                    ? 'bg-industrial-800 text-white font-bold border border-industrial-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {arm.id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Swarm Tri-Robot Status Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {arms.map((arm) => {
          const isHolding = armAttachedObjects[arm.id];
          const assignedCount = tasks.filter((t) => t.assignedArmId === arm.id).length;
          return (
            <div
              key={arm.id}
              onClick={() => setSelectedArmId(arm.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                selectedArmId === arm.id
                  ? 'bg-industrial-850 border-cyanAccent/50 shadow-md'
                  : 'bg-industrial-900 border-industrial-800 hover:border-industrial-750'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: arm.accentColor }}
                  />
                  <span className="font-semibold text-white text-xs">{arm.name}</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-industrial-950 border border-industrial-800 text-slate-400">
                  Base: [{arm.basePosition.map((v) => v.toFixed(2)).join(', ')}]
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="text-slate-500">{arm.role}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                    isHolding
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isHolding ? `Gripped: ${isHolding}` : 'Gripper Empty'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live State Machine Phase Indicator */}
      {activePhase !== 'IDLE' && (
        <div className="bg-industrial-900/90 border border-industrial-800 p-2.5 rounded-xl flex items-center justify-between text-xs shadow-md">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyanAccent animate-pulse" />
            <span className="text-slate-400 font-mono">Current Sequence Phase:</span>
            <span className="font-mono font-bold text-cyanAccent tracking-wider bg-industrial-950 px-2.5 py-1 rounded border border-cyanAccent/30">
              {activePhase}
            </span>
          </div>
          {(isExecutingQueue || isSwarmRunning) && (
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Simultaneous Multi-Robot Execution Live (60 FPS)
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Task Queue & Objects Inventory */}
        <div className="lg:col-span-7 bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-cyanAccent" />
              <span>Multi-Object Queue ({tasks.length} Objects Configured)</span>
            </span>
            <button
              onClick={() => setShowObjectCreator(true)}
              className="px-2.5 py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-cyan-500/40 text-cyan-400 text-[11px] font-mono flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New Object
            </button>
          </div>

          <div className="space-y-3">
            {tasks.map((task, idx) => {
              const isSelected = activeTaskIndex === idx;
              const assignedArm = arms.find((a) => a.id === task.assignedArmId) || arms[1];
              const isHoldingThis = Object.values(armAttachedObjects).includes(task.object_id);

              return (
                <div
                  key={task.id}
                  onClick={() => setActiveTaskIndex(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-industrial-850 border-cyanAccent/50 shadow-lg'
                      : 'bg-industrial-950 border-industrial-850 hover:border-industrial-750'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      {/* Object Geometry Shape Icon */}
                      <span
                        className="w-4 h-4 rounded-md shrink-0 shadow-sm flex items-center justify-center text-[9px] text-white font-bold"
                        style={{ backgroundColor: task.object_color }}
                      >
                        {task.object_type === 'box' ? (
                          <Square className="w-3 h-3 fill-current text-white/80" />
                        ) : task.object_type === 'cylinder' ? (
                          <Box className="w-3 h-3 text-white/80" />
                        ) : (
                          <Circle className="w-3 h-3 fill-current text-white/80" />
                        )}
                      </span>
                      <span className="font-semibold text-white text-xs">{task.name}</span>
                      <span className="font-mono text-[10px] text-slate-500 uppercase">
                        [{task.object_type} • {task.mass ? `${task.mass}kg` : '0.25kg'}]
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono border"
                        style={{
                          borderColor: `${assignedArm.accentColor}40`,
                          color: assignedArm.accentColor,
                          backgroundColor: `${assignedArm.accentColor}15`
                        }}
                      >
                        {assignedArm.id.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                          task.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : task.status === 'executing'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                            : task.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {task.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTask(task.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Pick & Place Coordinates */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 mb-2.5">
                    <div className="bg-industrial-900/90 p-2 rounded-lg border border-industrial-800">
                      <span className="text-cyanAccent block text-[9px] uppercase font-bold tracking-wider">
                        Pick Position (X, Y, Z):
                      </span>
                      <span className="text-slate-200">
                        [{task.pick_position.map((v) => v.toFixed(2)).join(', ')}]
                      </span>
                    </div>
                    <div className="bg-industrial-900/90 p-2 rounded-lg border border-industrial-800">
                      <span className="text-emerald-400 block text-[9px] uppercase font-bold tracking-wider">
                        Place Position (X, Y, Z):
                      </span>
                      <span className="text-slate-200">
                        [{task.place_position.map((v) => v.toFixed(2)).join(', ')}]
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {task.status !== 'pending' && (
                    <div className="w-full bg-industrial-900 h-1.5 rounded-full overflow-hidden mb-3">
                      <div
                        className="bg-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Action Buttons: Run Diagnostics & Execute Pipeline */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunDiagnostics(task);
                      }}
                      disabled={isRunningDiagnostics || isExecutingQueue || isSwarmRunning}
                      className="px-2.5 py-1.5 rounded-lg bg-industrial-900 hover:bg-industrial-800 border border-cyanAccent/40 text-cyanAccent hover:text-cyan-300 font-mono text-[11px] font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Run Diagnostics
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecuteTask(task);
                      }}
                      disabled={isExecutingQueue || isRunningDiagnostics || isSwarmRunning}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-industrial-950 font-bold text-[11px] transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-md"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Execute on {assignedArm.id.toUpperCase()}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (5 cols): Pipeline Overview & Live Execution Log */}
        <div className="lg:col-span-5 space-y-4">
          {/* Swarm Coordination Architecture Overview */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white block">
                Tri-Robot Swarm Handshake Protocol
              </span>
              <span className="text-[10px] font-mono text-cyanAccent">Active Swarm</span>
            </div>

            <ol className="space-y-2 text-[11px] font-mono text-slate-300">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyanAccent flex items-center justify-center text-[9px] font-bold mt-0.5 shrink-0">1</span>
                <div>
                  <span className="font-bold text-white">Arm 1 (Infeed):</span>
                  <span className="text-slate-400 block text-[10px]">Takes raw block payload from infeed station to handover pedestal `[-0.40, 0.12, 0.20]`.</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[9px] font-bold mt-0.5 shrink-0">2</span>
                <div>
                  <span className="font-bold text-white">Arm 2 (Assembly):</span>
                  <span className="text-slate-400 block text-[10px]">Simultaneously takes hydraulic canister, aligns in central space, and places to `[0.40, 0.12, 0.20]`.</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-bold mt-0.5 shrink-0">3</span>
                <div>
                  <span className="font-bold text-white">Arm 3 (Palletizer):</span>
                  <span className="text-slate-400 block text-[10px]">Simultaneously grasps precision sphere and pallets into destination rack `[0.85, 0.12, -0.20]`.</span>
                </div>
              </li>
            </ol>
          </div>

          {/* Real-time Execution Terminal */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyanAccent" /> Workcell Swarm Telemetry Log
              </span>
              <span className="text-[10px] font-mono text-slate-500">Synchronized Bus</span>
            </div>
            <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850 font-mono text-[10px] space-y-1 h-56 overflow-y-auto">
              {executionLog.length > 0 ? (
                executionLog.map((log, i) => (
                  <div key={i} className="text-slate-300">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-slate-600 italic">
                  Workcell standby. Click "Execute 3-Arm Swarm" or "Run Diagnostics" to stream live real-time coordination logs.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Object Creator Modal */}
      {showObjectCreator && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-industrial-900 border border-industrial-750 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-cyanAccent" />
                <h3 className="font-bold text-white text-sm">Add New Workpiece / Object to Workcell</h3>
              </div>
              <button
                onClick={() => setShowObjectCreator(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Object Name:</label>
                <input
                  type="text"
                  value={newObjName}
                  onChange={(e) => setNewObjName(e.target.value)}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Geometry Type:</label>
                  <select
                    value={newObjType}
                    onChange={(e) => setNewObjType(e.target.value as any)}
                    className="w-full bg-industrial-950 border border-industrial-800 rounded-lg p-2 text-white"
                  >
                    <option value="cylinder">Cylinder (Canister / Shaft)</option>
                    <option value="box">Box (Machined Block / Module)</option>
                    <option value="sphere">Sphere (Precision Ball / Bearing)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Color / Material:</label>
                  <div className="flex items-center gap-2 pt-1">
                    {['#38bdf8', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#ec4899'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewObjColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          newObjColor === c ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Assigned Robotic Arm:</label>
                  <select
                    value={newObjAssignedArm}
                    onChange={(e) => setNewObjAssignedArm(e.target.value)}
                    className="w-full bg-industrial-950 border border-industrial-800 rounded-lg p-2 text-white"
                  >
                    <option value="arm-1">Arm 1 (Infeed)</option>
                    <option value="arm-2">Arm 2 (Main Assembly)</option>
                    <option value="arm-3">Arm 3 (Palletizer)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Mass (kg):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={newObjMass}
                    onChange={(e) => setNewObjMass(parseFloat(e.target.value) || 0.2)}
                    className="w-full bg-industrial-950 border border-industrial-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              {/* Coordinates Pick & Place */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-cyanAccent block mb-1 text-[10px] font-bold">Pick Coord (X, Y, Z):</label>
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="number"
                      step="0.05"
                      value={newObjPickX}
                      onChange={(e) => setNewObjPickX(parseFloat(e.target.value) || 0)}
                      className="bg-industrial-950 border border-industrial-800 rounded p-1 text-center text-white text-[11px]"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={newObjPickY}
                      onChange={(e) => setNewObjPickY(parseFloat(e.target.value) || 0)}
                      className="bg-industrial-950 border border-industrial-800 rounded p-1 text-center text-white text-[11px]"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={newObjPickZ}
                      onChange={(e) => setNewObjPickZ(parseFloat(e.target.value) || 0)}
                      className="bg-industrial-950 border border-industrial-800 rounded p-1 text-center text-white text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-emerald-400 block mb-1 text-[10px] font-bold">Place Coord (X, Y, Z):</label>
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="number"
                      step="0.05"
                      value={newObjPlaceX}
                      onChange={(e) => setNewObjPlaceX(parseFloat(e.target.value) || 0)}
                      className="bg-industrial-950 border border-industrial-800 rounded p-1 text-center text-white text-[11px]"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={newObjPlaceY}
                      onChange={(e) => setNewObjPlaceY(parseFloat(e.target.value) || 0)}
                      className="bg-industrial-950 border border-industrial-800 rounded p-1 text-center text-white text-[11px]"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={newObjPlaceZ}
                      onChange={(e) => setNewObjPlaceZ(parseFloat(e.target.value) || 0)}
                      className="bg-industrial-950 border border-industrial-800 rounded p-1 text-center text-white text-[11px]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-industrial-800">
              <button
                onClick={() => setShowObjectCreator(false)}
                className="px-3 py-1.5 rounded-lg bg-industrial-950 hover:bg-industrial-800 text-slate-300 font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomObject}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-industrial-950 font-bold font-mono"
              >
                Create Object
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10-Stage Diagnostics Result Modal */}
      {showDiagnosticsModal && diagnosticsResult && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-industrial-900 border border-industrial-750 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-industrial-800 flex items-center justify-between bg-industrial-950">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-cyanAccent" />
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    10-Stage Pick & Place Diagnostic Report
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Evaluated on {activeArm.name} | Base: [{activeArm.basePosition.join(', ')}]
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-industrial-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overall Status Banner */}
            <div
              className={`p-3.5 border-b flex items-center gap-3 ${
                diagnosticsResult.all_passed
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              {diagnosticsResult.all_passed ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="text-xs">
                <span className="font-bold block">
                  {diagnosticsResult.all_passed
                    ? 'ALL 10 DIAGNOSTIC STAGES PASSED'
                    : `DIAGNOSTIC FAILURE AT STAGE ${diagnosticsResult.failure_stage}`}
                </span>
                <span className="font-mono text-[11px] opacity-90">
                  {diagnosticsResult.overall_message}
                </span>
              </div>
            </div>

            {/* Stages List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {diagnosticsResult.stages.map((stage) => {
                const passed = stage.status === 'passed';
                return (
                  <div
                    key={stage.stage_number}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                      passed
                        ? 'bg-industrial-950/80 border-industrial-800'
                        : 'bg-rose-950/20 border-rose-500/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-500">
                            #{stage.stage_number}
                          </span>
                          <span className="font-semibold text-white text-xs">
                            {stage.stage_name}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-300 mt-1">
                          {stage.details}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                          passed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {stage.status}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {stage.duration_ms.toFixed(1)}ms
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-industrial-800 bg-industrial-950 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                Total pipeline diagnostic time:{' '}
                {diagnosticsResult.stages
                  .reduce((acc, s) => acc + s.duration_ms, 0)
                  .toFixed(1)}
                ms
              </span>
              <button
                onClick={() => setShowDiagnosticsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-white font-mono text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};