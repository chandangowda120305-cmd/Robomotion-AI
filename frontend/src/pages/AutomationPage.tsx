import React, { useState } from 'react';
import {
  Cpu,
  Plus,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ArrowDown,
  ArrowUp,
  Save,
  Clock,
  HandMetal
} from 'lucide-react';
import { useRobotStore } from '../store/useRobotStore';
import { apiClient } from '../api/client';
import { AutomationStep, AutomationSequence } from '../types';

export const AutomationPage: React.FC = () => {
  const automationSequences = useRobotStore((s) => s.automationSequences);
  const saveSequence = useRobotStore((s) => s.saveSequence);
  const obstacles = useRobotStore((s) => s.obstacles);
  const jointAngles = useRobotStore((s) => s.jointAngles);
  const setJointAngles = useRobotStore((s) => s.setJointAngles);
  const setTrajectory = useRobotStore((s) => s.setTrajectory);
  const startSimulation = useRobotStore((s) => s.startSimulation);
  const setGripperState = useRobotStore((s) => s.setGripperState);
  const addNotification = useRobotStore((s) => s.addNotification);

  // Active sequence being edited
  const [currentSeq, setCurrentSeq] = useState<AutomationSequence>(
    automationSequences[0] || {
      id: 'seq-custom',
      name: 'Custom Robotic Automation Task',
      description: 'Sequential production cell automation routine',
      steps: []
    }
  );

  const [activeRunningStepIndex, setActiveRunningStepIndex] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error_message: string | null;
    failing_step_index: number | null;
  } | null>(null);

  // Action palette options
  const actionPalette: Array<{ type: AutomationStep['type']; label: string; icon: string }> = [
    { type: 'home', label: 'Home Posture', icon: '🏠' },
    { type: 'move_pose', label: 'Move to 3D Pose', icon: '🎯' },
    { type: 'move_joints', label: 'Move to Joint Angles', icon: '🦾' },
    { type: 'open_gripper', label: 'Open Gripper', icon: '👐' },
    { type: 'close_gripper', label: 'Close Gripper', icon: '✊' },
    { type: 'wait', label: 'Dwell / Wait Timer', icon: '⏱️' },
    { type: 'stop_on_error', label: 'Stop on Error Guard', icon: '🛑' }
  ];

  const handleAddStep = (type: AutomationStep['type']) => {
    const id = `step-${Date.now()}`;
    let params: Record<string, any> = {};

    if (type === 'move_pose') {
      params = { position: [0.35, 0.45, 0.2] };
    } else if (type === 'move_joints') {
      params = { angles: [0.0, 0.4, -0.6, 0.2, 0.0, 0.0] };
    } else if (type === 'wait') {
      params = { duration: 1.0 };
    }

    const newStep: AutomationStep = {
      id,
      type,
      name: `${type.toUpperCase()} Step #${currentSeq.steps.length + 1}`,
      params,
      status: 'idle'
    };

    setCurrentSeq({
      ...currentSeq,
      steps: [...currentSeq.steps, newStep]
    });
    setValidationResult(null);
  };

  const handleRemoveStep = (idx: number) => {
    const newSteps = [...currentSeq.steps];
    newSteps.splice(idx, 1);
    setCurrentSeq({ ...currentSeq, steps: newSteps });
    setValidationResult(null);
  };

  const handleMoveStep = (idx: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === currentSeq.steps.length - 1)) {
      return;
    }
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSteps = [...currentSeq.steps];
    const temp = newSteps[idx];
    newSteps[idx] = newSteps[targetIdx];
    newSteps[targetIdx] = temp;
    setCurrentSeq({ ...currentSeq, steps: newSteps });
    setValidationResult(null);
  };

  // Validate entire sequence with backend engine
  const handleValidateSequence = async () => {
    try {
      const res = await apiClient.validateAutomationSequence({
        sequence: currentSeq,
        initial_angles: jointAngles,
        obstacles
      });

      setValidationResult({
        valid: res.valid,
        error_message: res.error_message,
        failing_step_index: res.failing_step_index
      });

      if (res.valid) {
        addNotification('All automation steps successfully validated!', 'success');
      } else {
        addNotification(`Validation Failed: ${res.error_message}`, 'error');
      }
      return res;
    } catch (err: any) {
      addNotification(`Validation error: ${err.message}`, 'error');
      return null;
    }
  };

  // Run sequence step-by-step
  const handleRunSequence = async () => {
    setIsRunning(true);
    const valRes = await handleValidateSequence();
    if (!valRes || !valRes.valid) {
      setIsRunning(false);
      return;
    }

    addNotification('Starting automation sequence execution...', 'info');

    for (let i = 0; i < valRes.compiled_steps.length; i++) {
      setActiveRunningStepIndex(i);
      const stepData = valRes.compiled_steps[i];

      if (stepData.data.trajectory) {
        setTrajectory(stepData.data.trajectory);
        startSimulation();
        const durationMs = stepData.data.trajectory.total_duration * 1000;
        await new Promise((r) => setTimeout(r, Math.max(700, durationMs)));
        const finalQ = stepData.data.trajectory.positions[stepData.data.trajectory.positions.length - 1];
        setJointAngles(finalQ);
      } else if (stepData.data.gripper_action === 'open') {
        setGripperState('open');
        await new Promise((r) => setTimeout(r, 600));
      } else if (stepData.data.gripper_action === 'close') {
        setGripperState('closed');
        await new Promise((r) => setTimeout(r, 600));
      } else if (stepData.data.duration) {
        await new Promise((r) => setTimeout(r, stepData.data.duration * 1000));
      }
    }

    setActiveRunningStepIndex(null);
    setIsRunning(false);
    addNotification('Automation sequence successfully completed!', 'success');
  };

  const handleSaveToDatabase = async () => {
    saveSequence(currentSeq);
    addNotification('Automation sequence saved to database!', 'success');
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs select-none">
      {/* Top Banner */}
      <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyanAccent" />
          <div>
            <span className="font-semibold text-white block">{currentSeq.name}</span>
            <span className="text-[11px] text-slate-400">
              Visual sequence editor & kinematic execution compiler
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToDatabase}
            className="px-3 py-1.5 rounded-lg bg-industrial-950 border border-industrial-800 hover:border-cyanAccent text-slate-300 text-[11px] font-mono flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save Sequence
          </button>
          <button
            onClick={handleValidateSequence}
            className="px-3 py-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-750 text-cyanAccent text-[11px] font-mono font-semibold flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Validate
          </button>
          <button
            onClick={handleRunSequence}
            disabled={isRunning}
            className="px-4 py-1.5 rounded-lg bg-cyanAccent hover:bg-cyanAccent-dark text-industrial-950 text-[11px] font-bold flex items-center gap-1.5 shadow-glow-cyan disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" /> {isRunning ? 'Running...' : 'Run Automation'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Step List */}
        <div className="lg:col-span-8 bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
            <span className="font-semibold text-white">Execution Steps ({currentSeq.steps.length})</span>
            {validationResult && (
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  validationResult.valid
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {validationResult.valid ? 'VALIDATED' : 'ERRORS DETECTED'}
              </span>
            )}
          </div>

          {/* Steps Table/List */}
          <div className="space-y-2">
            {currentSeq.steps.map((step, idx) => {
              const isFailing = validationResult?.failing_step_index === idx;
              const isRunningThis = activeRunningStepIndex === idx;

              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isRunningThis
                      ? 'bg-cyan-950/60 border-cyanAccent shadow-glow-cyan animate-pulse'
                      : isFailing
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                      : 'bg-industrial-950 border-industrial-850 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded bg-industrial-900 border border-industrial-800 text-slate-400 font-mono text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{step.name}</span>
                        <span className="text-[10px] font-mono text-cyanAccent uppercase">
                          [{step.type}]
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {step.type === 'move_pose' && (
                          <span>Pos: [{step.params.position?.map((v: number) => v.toFixed(2)).join(', ')}]</span>
                        )}
                        {step.type === 'move_joints' && (
                          <span>Angles: [{step.params.angles?.map((v: number) => (v * 57.3).toFixed(0)).join('°, ')}°]</span>
                        )}
                        {step.type === 'wait' && <span>Dwell Duration: {step.params.duration}s</span>}
                        {step.type === 'home' && <span>Restores predefined home posture</span>}
                        {step.type === 'open_gripper' && <span>Actuates pneumatic jaws open</span>}
                        {step.type === 'close_gripper' && <span>Clamps jaws on target</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveStep(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveStep(idx, 'down')}
                      disabled={idx === currentSeq.steps.length - 1}
                      className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveStep(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {currentSeq.steps.length === 0 && (
              <div className="py-8 text-center text-slate-500 font-mono text-[11px]">
                No steps in sequence. Select actions from the Action Palette on the right to build an automation sequence.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Action Palette */}
        <div className="lg:col-span-4 bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
          <span className="font-semibold text-white block border-b border-industrial-800 pb-2">
            Action Palette
          </span>
          <p className="text-[11px] text-slate-400">
            Click an action block to append it to the current sequence:
          </p>

          <div className="space-y-1.5">
            {actionPalette.map((act) => (
              <button
                key={act.type}
                onClick={() => handleAddStep(act.type)}
                className="w-full p-2.5 rounded-lg bg-industrial-950 border border-industrial-850 hover:border-cyanAccent/50 hover:bg-industrial-800 text-left flex items-center justify-between text-slate-200 font-mono text-[11px] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{act.icon}</span>
                  <span className="group-hover:text-cyanAccent">{act.label}</span>
                </div>
                <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyanAccent" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
