import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Gauge,
  Activity,
  Zap,
  Sliders,
  Maximize2
} from 'lucide-react';
import { useRobotStore } from '../store/useRobotStore';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

export const TelemetryTimeline: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() =>
    window.matchMedia('(max-width: 640px)').matches
  );
  const [activeChart, setActiveChart] = useState<'tracking_error' | 'velocity' | 'control_torque'>('tracking_error');

  const arms = useRobotStore((s) => s.arms);
  const selectedArmId = useRobotStore((s) => s.selectedArmId);
  const setSelectedArmId = useRobotStore((s) => s.setSelectedArmId);
  const selectedArm = arms.find((a) => a.id === selectedArmId) || arms[0];
  const jointAngles = selectedArm.jointAngles;
  const currentPose = useRobotStore((s) => s.currentPose);
  const trajectory = useRobotStore((s) => s.trajectory);
  const telemetry = useRobotStore((s) => s.telemetry);
  const currentPlayheadTime = useRobotStore((s) => s.currentPlayheadTime);
  const playbackSpeed = useRobotStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useRobotStore((s) => s.setPlaybackSpeed);
  const setPlayheadTime = useRobotStore((s) => s.setPlayheadTime);
  const setJointAngles = useRobotStore((s) => s.setJointAngles);

  const totalDuration = trajectory?.total_duration || 0;

  // Handle timeline scrubber drag
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayheadTime(val);

    if (trajectory && trajectory.time_points.length > 0) {
      const times = trajectory.time_points;
      let idx = 0;
      for (let i = 0; i < times.length - 1; i++) {
        if (val >= times[i] && val <= times[i + 1]) {
          idx = i;
          break;
        }
      }
      setJointAngles(trajectory.positions[idx]);
    }
  };

  // Prepare chart data from telemetry or trajectory
  const chartData = React.useMemo(() => {
    if (!telemetry || telemetry.time_points.length === 0) return [];
    // Downsample for rendering performance
    const step = Math.max(1, Math.floor(telemetry.time_points.length / 50));
    return telemetry.time_points
      .filter((_, i) => i % step === 0)
      .map((t, idx) => {
        const i = idx * step;
        return {
          time: t.toFixed(2),
          J1_err: (telemetry.tracking_errors[i]?.[0] * 57.2958 || 0).toFixed(2),
          J2_err: (telemetry.tracking_errors[i]?.[1] * 57.2958 || 0).toFixed(2),
          J3_err: (telemetry.tracking_errors[i]?.[2] * 57.2958 || 0).toFixed(2),
          J1_vel: (telemetry.velocities[i]?.[0] * 57.2958 || 0).toFixed(2),
          J2_vel: (telemetry.velocities[i]?.[1] * 57.2958 || 0).toFixed(2),
          J3_vel: (telemetry.velocities[i]?.[2] * 57.2958 || 0).toFixed(2),
          J1_torque: (telemetry.control_outputs[i]?.[0] || 0).toFixed(1),
          J2_torque: (telemetry.control_outputs[i]?.[1] || 0).toFixed(1)
        };
      });
  }, [telemetry]);

  return (
    <div className="bg-industrial-900 border-t border-industrial-800 z-20 select-none transition-all duration-200">
      {/* Top Header / Collapsible Control Bar */}
      <div className="h-9 px-4 flex items-center justify-between border-b border-industrial-800 bg-industrial-950/50 text-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            className="flex items-center gap-1.5 text-slate-300 hover:text-cyanAccent font-medium"
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="font-mono text-[11px] uppercase tracking-wider">
              Telemetry & Timeline
            </span>
          </button>

          {/* Time scrubber display */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span className="text-cyanAccent font-semibold">{currentPlayheadTime.toFixed(2)}s</span>
            <span>/</span>
            <span>{totalDuration.toFixed(2)}s</span>
          </div>

          {/* Arm Telemetry Switcher */}
          <div className="flex items-center gap-1 font-mono text-[10px] bg-industrial-900 px-1.5 py-0.5 rounded border border-industrial-800">
            <span className="text-slate-500">Telemetry:</span>
            {arms.map((arm) => (
              <button
                key={arm.id}
                onClick={() => setSelectedArmId(arm.id)}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  selectedArmId === arm.id
                    ? 'font-bold text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                style={{
                  backgroundColor: selectedArmId === arm.id ? `${arm.accentColor}33` : 'transparent',
                  color: selectedArmId === arm.id ? arm.accentColor : undefined
                }}
              >
                {arm.name.split(' ')[0]} {arm.name.split(' ')[1]}
              </button>
            ))}
          </div>
        </div>

        {/* Playback speed buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase font-mono">Speed:</span>
          {[0.5, 1.0, 1.5, 2.0].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                playbackSpeed === spd
                  ? 'bg-cyanAccent/20 text-cyanAccent border border-cyanAccent/40 font-semibold'
                  : 'hover:bg-industrial-800 text-slate-400'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Main Body */}
      {!collapsed && (
        <div className="p-3 grid grid-cols-12 gap-3 text-xs">
          {/* Left: Interactive Timeline Scrubber & Live Joint Angles */}
          <div className="col-span-5 flex flex-col justify-between border-r border-industrial-800 pr-3">
            {/* Scrubber slider */}
            <div className="mb-2">
              <input
                type="range"
                min="0"
                max={totalDuration > 0 ? totalDuration : 1}
                step="0.02"
                value={currentPlayheadTime}
                onChange={handleScrubberChange}
                disabled={totalDuration === 0}
                className="w-full accent-cyan-400 h-1.5 bg-industrial-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Joint Angles Display (6 joints) */}
            <div className="grid grid-cols-6 gap-1 bg-industrial-950 p-2 rounded-lg border border-industrial-800 font-mono text-[11px]">
              {jointAngles.map((angle, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500">J{idx + 1}</span>
                  <span className="text-slate-200 font-semibold">
                    {(angle * 57.2958).toFixed(1)}°
                  </span>
                </div>
              ))}
            </div>

            {/* End-Effector Current Pose Coordinates */}
            <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-industrial-850 px-2.5 py-1 rounded border border-industrial-750">
              <span className="text-slate-500">EE Pose (m):</span>
              <span>X: <strong className="text-cyanAccent">{currentPose.position[0].toFixed(3)}</strong></span>
              <span>Y: <strong className="text-cyanAccent">{currentPose.position[1].toFixed(3)}</strong></span>
              <span>Z: <strong className="text-cyanAccent">{currentPose.position[2].toFixed(3)}</strong></span>
            </div>
          </div>

          {/* Right: Controller Telemetry Mini Chart */}
          <div className="col-span-7 flex flex-col justify-between pl-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px]">
                <Activity className="w-3.5 h-3.5 text-cyanAccent" />
                <span>Simulated PID Closed-Loop Dynamics</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveChart('tracking_error')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    activeChart === 'tracking_error'
                      ? 'bg-cyanAccent/20 text-cyanAccent border border-cyanAccent/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Tracking Error
                </button>
                <button
                  onClick={() => setActiveChart('velocity')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    activeChart === 'velocity'
                      ? 'bg-cyanAccent/20 text-cyanAccent border border-cyanAccent/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Joint Velocities
                </button>
                <button
                  onClick={() => setActiveChart('control_torque')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    activeChart === 'control_torque'
                      ? 'bg-cyanAccent/20 text-cyanAccent border border-cyanAccent/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Torque Output
                </button>
              </div>
            </div>

            {/* Telemetry Chart or Placeholder */}
            <div className="h-20 w-full bg-industrial-950 rounded-lg border border-industrial-800 p-1 flex items-center justify-center">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                    />
                    {activeChart === 'tracking_error' && (
                      <>
                        <Line type="monotone" dataKey="J1_err" stroke="#06b6d4" dot={false} strokeWidth={1.5} name="J1 Err (°)" />
                        <Line type="monotone" dataKey="J2_err" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="J2 Err (°)" />
                        <Line type="monotone" dataKey="J3_err" stroke="#10b981" dot={false} strokeWidth={1.5} name="J3 Err (°)" />
                      </>
                    )}
                    {activeChart === 'velocity' && (
                      <>
                        <Line type="monotone" dataKey="J1_vel" stroke="#06b6d4" dot={false} strokeWidth={1.5} name="J1 Vel (°/s)" />
                        <Line type="monotone" dataKey="J2_vel" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="J2 Vel (°/s)" />
                        <Line type="monotone" dataKey="J3_vel" stroke="#10b981" dot={false} strokeWidth={1.5} name="J3 Vel (°/s)" />
                      </>
                    )}
                    {activeChart === 'control_torque' && (
                      <>
                        <Line type="monotone" dataKey="J1_torque" stroke="#38bdf8" dot={false} strokeWidth={1.5} name="J1 Torque (Nm)" />
                        <Line type="monotone" dataKey="J2_torque" stroke="#fb7185" dot={false} strokeWidth={1.5} name="J2 Torque (Nm)" />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-[11px] text-slate-500 font-mono">
                  {trajectory
                    ? 'Execute or generate telemetry in Motion Planning to display live PID tracking signals.'
                    : 'Plan and execute a trajectory to observe real-time controller feedback.'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
