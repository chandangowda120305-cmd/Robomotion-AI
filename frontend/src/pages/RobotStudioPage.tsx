import React, { useState } from 'react';
import {
  RotateCcw,
  Target,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  PlayCircle
} from 'lucide-react';
import { useRobotStore } from '../store/useRobotStore';
import { apiClient } from '../api/client';
import { ClientRobotKinematics } from '../robot/RobotKinematics';

export const RobotStudioPage: React.FC = () => {
  const arms = useRobotStore((s) => s.arms);
  const selectedArmId = useRobotStore((s) => s.selectedArmId);
  const setSelectedArmId = useRobotStore((s) => s.setSelectedArmId);
  const isDeadlocked = useRobotStore((s) => s.isDeadlocked);
  const clearDeadlock = useRobotStore((s) => s.clearDeadlock);

  const selectedArm = arms.find((a) => a.id === selectedArmId) || arms[0];
  const jointAngles = selectedArm.jointAngles;
  const currentPose = useRobotStore((s) => s.currentPose);
  const setSingleJointAngle = useRobotStore((s) => s.setSingleJointAngle);
  const setJointAngles = useRobotStore((s) => s.setJointAngles);
  const resetToHome = useRobotStore((s) => s.resetToHome);
  const targetPose = useRobotStore((s) => s.targetPose);
  const setTargetPose = useRobotStore((s) => s.setTargetPose);
  const addNotification = useRobotStore((s) => s.addNotification);

  const [isSolvingIK, setIsSolvingIK] = useState(false);
  const [ikFeedback, setIkFeedback] = useState<{
    success: boolean;
    iterations: number;
    error_pos: number;
    message: string;
  } | null>(null);

  const [showMatrix, setShowMatrix] = useState(false);

  // Joint specifications
  const jointInfo = [
    { name: 'Joint 1 (Base Yaw)', min: -180, max: 180, axis: 'Y (World Up)' },
    { name: 'Joint 2 (Shoulder Pitch)', min: -135, max: 135, axis: 'Z (Pitch)' },
    { name: 'Joint 3 (Elbow Pitch)', min: -155, max: 155, axis: 'Z (Pitch)' },
    { name: 'Joint 4 (Wrist 1 Pitch)', min: -180, max: 180, axis: 'Z (Pitch)' },
    { name: 'Joint 5 (Wrist 2 Yaw)', min: -180, max: 180, axis: 'Y (Yaw)' },
    { name: 'Joint 6 (Tool Roll)', min: -360, max: 360, axis: 'Y (Roll)' }
  ];

  // Presets
  const presets = [
    { name: 'Home Pose', angles: [0.0, 0.3, -0.6, 0.3, 0.0, 0.0] },
    { name: 'Ready Standby', angles: [0.0, 0.5, -0.9, 0.4, 0.0, 0.0] },
    { name: 'Reach Forward', angles: [0.0, 0.8, -0.5, -0.3, 0.0, 0.0] },
    { name: 'High Inspection', angles: [0.3, -0.2, 0.4, 0.5, -0.3, 0.0] },
    { name: 'Floor Grasping', angles: [0.0, 1.1, -1.2, 0.1, 0.0, 0.0] }
  ];

  const handleSliderChange = (idx: number, degVal: number) => {
    const rad = degVal * (Math.PI / 180);
    setSingleJointAngle(idx, rad);
  };

  const handleSolveIK = async () => {
    setIsSolvingIK(true);
    setIkFeedback(null);
    try {
      const res = await apiClient.computeIK({
        target_position: targetPose.position,
        initial_guess: jointAngles,
        position_only: true,
        tolerance_pos: 0.001
      });

      setIkFeedback({
        success: res.success,
        iterations: res.iterations,
        error_pos: res.final_error_pos,
        message: res.message
      });

      if (res.success) {
        setJointAngles(res.angles);
        addNotification(`IK Converged in ${res.iterations} iterations!`, 'success');
      } else {
        addNotification(`IK Warning: ${res.message}`, 'warning');
      }
    } catch (err: any) {
      setIkFeedback({
        success: false,
        iterations: 0,
        error_pos: 999,
        message: err.message || 'Inverse Kinematics computation failed.'
      });
      addNotification(`IK Failed: ${err.message}`, 'error');
    } finally {
      setIsSolvingIK(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs select-none">
      {/* Multi-Arm Focus & Deadlock Clearance Strip */}
      <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white font-mono">Target Arm:</span>
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
          title="Clear deadlock, release interlocks, and retract all 3 arms to home"
          className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors"
        >
          <span>CLEAR DEADLOCK</span>
        </button>
      </div>

      {/* Top Banner / Presets */}
      <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-xl flex items-center justify-between">
        <div>
          <span className="font-semibold text-white block">Kinematic Posture Presets</span>
          <span className="text-[11px] text-slate-400">
            Instantly set validated 6-DOF joint configurations
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setJointAngles(p.angles);
                addNotification(`Applied ${p.name}`);
              }}
              className="px-2.5 py-1 rounded-lg bg-industrial-950 border border-industrial-800 hover:border-cyanAccent/40 hover:text-cyanAccent text-slate-300 font-mono transition-colors text-[11px]"
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={resetToHome}
            title="Reset to initial home"
            className="p-1 rounded-lg bg-industrial-950 border border-industrial-800 hover:border-cyanAccent text-slate-400 hover:text-cyanAccent ml-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Interactive Joint Sliders */}
        <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyanAccent" />
              <span>Independent Joint Angle Controls</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              Units: Degrees (°)
            </span>
          </div>

          <div className="space-y-3">
            {jointInfo.map((info, idx) => {
              const currentDeg = jointAngles[idx] * (180 / Math.PI);
              return (
                <div key={idx} className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                  <div className="flex items-center justify-between mb-1.5 font-mono text-[11px]">
                    <span className="text-slate-300 font-medium">
                      J{idx + 1}: {info.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px]">{info.axis}</span>
                      <span className="text-cyanAccent font-bold w-12 text-right">
                        {currentDeg.toFixed(1)}°
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono w-8 text-right">
                      {info.min}°
                    </span>
                    <input
                      type="range"
                      min={info.min}
                      max={info.max}
                      step="0.5"
                      value={currentDeg}
                      onChange={(e) => handleSliderChange(idx, parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-industrial-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 font-mono w-8">
                      {info.max}°
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: FK Readout & Numerical IK Solver */}
        <div className="space-y-4">
          {/* Target Pose & Inverse Kinematics Card */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                <span>Numerical Inverse Kinematics (DLS)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                Jacobian Damped Solver
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Set desired end-effector 3D coordinates. The backend numerical Jacobian solver will
              iteratively converge to compliant joint angles.
            </p>

            <div className="grid grid-cols-3 gap-2 font-mono">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Target X (m)</label>
                <input
                  type="number"
                  step="0.02"
                  value={targetPose.position[0]}
                  onChange={(e) =>
                    setTargetPose({
                      position: [parseFloat(e.target.value) || 0, targetPose.position[1], targetPose.position[2]]
                    })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Target Y (m)</label>
                <input
                  type="number"
                  step="0.02"
                  value={targetPose.position[1]}
                  onChange={(e) =>
                    setTargetPose({
                      position: [targetPose.position[0], parseFloat(e.target.value) || 0, targetPose.position[2]]
                    })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Target Z (m)</label>
                <input
                  type="number"
                  step="0.02"
                  value={targetPose.position[2]}
                  onChange={(e) =>
                    setTargetPose({
                      position: [targetPose.position[0], targetPose.position[1], parseFloat(e.target.value) || 0]
                    })
                  }
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-200 focus:border-cyanAccent outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleSolveIK}
              disabled={isSolvingIK}
              className="w-full py-2 rounded-lg bg-cyanAccent hover:bg-cyanAccent-dark text-industrial-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-glow-cyan disabled:opacity-50"
            >
              {isSolvingIK ? 'Solving Jacobian...' : 'Calculate Inverse Kinematics'}
            </button>

            {/* IK Result Feedback */}
            {ikFeedback && (
              <div
                className={`p-2.5 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                  ikFeedback.success
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                {ikFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{ikFeedback.message}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Residual Pos Error: {(ikFeedback.error_pos * 1000).toFixed(2)}mm • Iterations:{' '}
                    {ikFeedback.iterations}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Forward Kinematics Readout */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white">Current End-Effector Pose (FK)</span>
              <button
                onClick={() => setShowMatrix(!showMatrix)}
                className="text-[11px] text-cyanAccent hover:underline flex items-center gap-1 font-mono"
              >
                {showMatrix ? 'Hide Matrix' : 'View 4x4 Matrix'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="bg-industrial-950 p-2 rounded border border-industrial-850">
                <span className="text-[10px] text-slate-500 block">Position X</span>
                <span className="text-white font-semibold">{currentPose.position[0].toFixed(4)} m</span>
              </div>
              <div className="bg-industrial-950 p-2 rounded border border-industrial-850">
                <span className="text-[10px] text-slate-500 block">Position Y</span>
                <span className="text-white font-semibold">{currentPose.position[1].toFixed(4)} m</span>
              </div>
              <div className="bg-industrial-950 p-2 rounded border border-industrial-850">
                <span className="text-[10px] text-slate-500 block">Position Z</span>
                <span className="text-white font-semibold">{currentPose.position[2].toFixed(4)} m</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="bg-industrial-950 p-2 rounded border border-industrial-850">
                <span className="text-[10px] text-slate-500 block">Roll (Rx)</span>
                <span className="text-slate-300">{(currentPose.orientation[0] * 57.2958).toFixed(1)}°</span>
              </div>
              <div className="bg-industrial-950 p-2 rounded border border-industrial-850">
                <span className="text-[10px] text-slate-500 block">Pitch (Ry)</span>
                <span className="text-slate-300">{(currentPose.orientation[1] * 57.2958).toFixed(1)}°</span>
              </div>
              <div className="bg-industrial-950 p-2 rounded border border-industrial-850">
                <span className="text-[10px] text-slate-500 block">Yaw (Rz)</span>
                <span className="text-slate-300">{(currentPose.orientation[2] * 57.2958).toFixed(1)}°</span>
              </div>
            </div>

            {/* 4x4 Homogeneous Matrix Viewer */}
            {showMatrix && currentPose.matrix && (
              <div className="mt-2 bg-industrial-950 p-2.5 rounded-lg border border-industrial-850 font-mono text-[10px]">
                <div className="text-slate-400 mb-1">T_ee = [R | p ; 0 1]</div>
                <div className="grid grid-cols-4 gap-1 text-center text-slate-300">
                  {currentPose.matrix.flatMap((row, r) =>
                    row.map((val, c) => (
                      <span
                        key={`${r}-${c}`}
                        className={`p-1 rounded ${
                          c === 3 ? 'text-cyanAccent font-semibold bg-cyan-950/30' : 'bg-industrial-900'
                        }`}
                      >
                        {val.toFixed(3)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
