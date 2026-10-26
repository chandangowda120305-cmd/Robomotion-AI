import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Server,
  Zap,
  Layers
} from 'lucide-react';
import { useRobotStore } from '../store/useRobotStore';
import { apiClient } from '../api/client';

export const SettingsPage: React.FC = () => {
  const pidGains = useRobotStore((s) => s.pidGains);
  const setPidGains = useRobotStore((s) => s.setPidGains);
  const viewSettings = useRobotStore((s) => s.viewSettings);
  const toggleViewSetting = useRobotStore((s) => s.toggleViewSetting);
  const backendConnected = useRobotStore((s) => s.backendConnected);
  const setBackendConnected = useRobotStore((s) => s.setBackendConnected);
  const addNotification = useRobotStore((s) => s.addNotification);

  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    const ok = await apiClient.checkHealth();
    setBackendConnected(ok);
    setTestingConnection(false);
    if (ok) {
      addNotification('Connected to FastAPI backend on http://localhost:8000', 'success');
    } else {
      addNotification('Unable to reach backend on port 8000', 'error');
    }
  };

  const handleGainChange = (type: 'kp' | 'ki' | 'kd', index: number, val: number) => {
    const newArr = [...pidGains[type]];
    newArr[index] = val;
    setPidGains({ [type]: newArr });
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs select-none">
      {/* Top Banner */}
      <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyanAccent" />
          <div>
            <span className="font-semibold text-white block">System & Controller Settings</span>
            <span className="text-[11px] text-slate-400">
              Joint-level servo PID gains, dynamic payload parameters, and server endpoints
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Joint-level PID Controller Tuning */}
        <div className="lg:col-span-8 bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Joint-Level PID Feedback Controller Gains</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              u(t) = Kp*e + Ki*∫e + Kd*ė
            </span>
          </div>

          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map((jointIdx) => (
              <div
                key={jointIdx}
                className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850 grid grid-cols-1 md:grid-cols-4 gap-3 items-center"
              >
                <div className="font-mono text-[11px]">
                  <span className="text-white font-bold block">Joint {jointIdx + 1}</span>
                  <span className="text-[10px] text-slate-500">
                    {jointIdx <= 2 ? 'High Torque Arm' : 'Precision Wrist'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono block mb-0.5">
                    Proportional (Kp): {pidGains.kp[jointIdx]}
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={pidGains.kp[jointIdx]}
                    onChange={(e) => handleGainChange('kp', jointIdx, parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-industrial-800 rounded appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono block mb-0.5">
                    Integral (Ki): {pidGains.ki[jointIdx]}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={pidGains.ki[jointIdx]}
                    onChange={(e) => handleGainChange('ki', jointIdx, parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-industrial-800 rounded appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono block mb-0.5">
                    Derivative (Kd): {pidGains.kd[jointIdx]}
                  </span>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.2"
                    value={pidGains.kd[jointIdx]}
                    onChange={(e) => handleGainChange('kd', jointIdx, parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-industrial-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-industrial-850">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-slate-400">Attached Payload Mass:</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="5.0"
                value={pidGains.loadMass}
                onChange={(e) =>
                  setPidGains({ loadMass: parseFloat(e.target.value) || 0 })
                }
                className="w-20 bg-industrial-950 border border-industrial-800 rounded px-2 py-1 text-slate-200 outline-none"
              />
              <span className="text-slate-500">kg</span>
            </div>

            <button
              onClick={() => {
                setPidGains({
                  kp: [24.0, 26.0, 22.0, 20.0, 18.0, 16.0],
                  ki: [1.5, 1.8, 1.2, 1.0, 0.8, 0.6],
                  kd: [4.2, 4.5, 3.8, 3.2, 2.8, 2.2],
                  loadMass: 0.25
                });
                addNotification('Reset PID gains to default calibration');
              }}
              className="text-[11px] text-slate-400 hover:text-cyanAccent font-mono flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset Default PID Gains
            </button>
          </div>
        </div>

        {/* Right Column (4 cols): Server & Visuals */}
        <div className="lg:col-span-4 space-y-4">
          {/* Server Connection Card */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Server className="w-4 h-4 text-cyanAccent" />
                <span>Backend API Connection</span>
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  backendConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
            </div>

            <div className="font-mono text-[11px] space-y-2">
              <div>
                <label className="text-slate-500 block mb-1">FastAPI Endpoint URL</label>
                <input
                  type="text"
                  readOnly
                  value="http://localhost:8000"
                  className="w-full bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1.5 text-slate-300 outline-none"
                />
              </div>

              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="w-full py-2 rounded-lg bg-industrial-800 hover:bg-industrial-750 text-cyanAccent font-mono text-[11px] font-semibold border border-industrial-700 transition-colors"
              >
                {testingConnection ? 'Pinging Server...' : 'Test Connection'}
              </button>
            </div>
          </div>

          {/* 3D Viewport Options */}
          <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-3">
            <span className="font-semibold text-white block border-b border-industrial-800 pb-2">
              3D Viewport Render Settings
            </span>

            <div className="space-y-2 font-mono text-[11px]">
              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>Reachable Workspace Cloud</span>
                <input
                  type="checkbox"
                  checked={viewSettings.showWorkspace}
                  onChange={() => toggleViewSetting('showWorkspace')}
                  className="rounded accent-cyan-400"
                />
              </label>

              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>World & Joint Coordinate Axes</span>
                <input
                  type="checkbox"
                  checked={viewSettings.showAxes}
                  onChange={() => toggleViewSetting('showAxes')}
                  className="rounded accent-cyan-400"
                />
              </label>

              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>Wireframe Mode</span>
                <input
                  type="checkbox"
                  checked={viewSettings.showWireframe}
                  onChange={() => toggleViewSetting('showWireframe')}
                  className="rounded accent-cyan-400"
                />
              </label>

              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>Collision Link Capsules</span>
                <input
                  type="checkbox"
                  checked={viewSettings.showCollisionCapsules}
                  onChange={() => toggleViewSetting('showCollisionCapsules')}
                  className="rounded accent-cyan-400"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
