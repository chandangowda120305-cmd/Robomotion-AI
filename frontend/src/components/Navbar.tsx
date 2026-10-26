import React from 'react';
import {
  Activity,
  Bot,
  Compass,
  PackageCheck,
  Cpu,
  BarChart3,
  History,
  Settings,
  Play,
  Pause,
  Square,
  Home,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { useRobotStore } from '../store/useRobotStore';
import { NavigationTab } from '../types';

export const Navbar: React.FC = () => {
  const activeTab = useRobotStore((s) => s.activeTab);
  const setActiveTab = useRobotStore((s) => s.setActiveTab);
  const backendConnected = useRobotStore((s) => s.backendConnected);

  const arms = useRobotStore((s) => s.arms);
  const selectedArmId = useRobotStore((s) => s.selectedArmId);
  const setSelectedArmId = useRobotStore((s) => s.setSelectedArmId);

  const isDeadlocked = useRobotStore((s) => s.isDeadlocked);
  const clearDeadlock = useRobotStore((s) => s.clearDeadlock);

  const isPlaying = useRobotStore((s) => s.isPlaying);
  const isPaused = useRobotStore((s) => s.isPaused);
  const trajectory = useRobotStore((s) => s.trajectory);
  const startSimulation = useRobotStore((s) => s.startSimulation);
  const pauseSimulation = useRobotStore((s) => s.pauseSimulation);
  const resumeSimulation = useRobotStore((s) => s.resumeSimulation);
  const stopSimulation = useRobotStore((s) => s.stopSimulation);
  const resetToHome = useRobotStore((s) => s.resetToHome);

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'studio', label: 'Robot Studio', icon: <Bot className="w-4 h-4" /> },
    { id: 'planning', label: 'Motion Planning', icon: <Compass className="w-4 h-4" /> },
    { id: 'pick_place', label: 'Pick & Place', icon: <PackageCheck className="w-4 h-4" /> },
    { id: 'automation', label: 'Automation', icon: <Cpu className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> }
  ];

  const handlePlayToggle = () => {
    if (!trajectory) return;
    if (!isPlaying) {
      startSimulation();
    } else if (isPaused) {
      resumeSimulation();
    } else {
      pauseSimulation();
    }
  };

  return (
    <header className="min-h-14 bg-industrial-900 border-b border-industrial-800 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-2 py-2 z-30 select-none sm:px-4 lg:h-14 lg:flex-nowrap lg:gap-0 lg:py-0">
      {/* Brand & Multi-Arm Workcell Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-glow-cyan">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide text-white">RoboMotion</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyanAccent/20 text-cyanAccent font-semibold border border-cyanAccent/30">
              Tri-Arm AI Cell
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono leading-none">
            3-Arm Collaborative Motion Planning
          </p>
        </div>
      </div>

      {/* 3-Arm Active Focus Switcher */}
      <div className="flex items-center gap-1 bg-industrial-950 p-1 rounded-xl border border-industrial-800 font-mono text-xs">
        <span className="hidden text-[10px] text-slate-500 px-2 font-semibold sm:inline">Active Arm:</span>
        {arms.map((arm, idx) => {
          const isSelected = selectedArmId === arm.id;
          return (
            <button
              key={arm.id}
              onClick={() => setSelectedArmId(arm.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                isSelected
                  ? 'bg-industrial-800 text-white shadow-sm border'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-900 border border-transparent'
              }`}
              style={{
                borderColor: isSelected ? arm.accentColor : 'transparent'
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: arm.accentColor }}
              />
              <span>Arm {idx + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Primary Navigation Tabs */}
      <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1 bg-industrial-950/70 p-1 rounded-xl border border-industrial-800">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-industrial-800 text-cyanAccent shadow-sm border border-industrial-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <nav
        aria-label="Main navigation"
        className="order-last flex w-full gap-1 overflow-x-auto rounded-xl border border-industrial-800 bg-industrial-950/70 p-1 lg:hidden"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-industrial-800 text-cyanAccent shadow-sm border border-industrial-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Status, Clear Deadlock & Quick Simulation Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* CLEAR DEADLOCK BUTTON */}
        <button
          onClick={clearDeadlock}
          title="Clear cell deadlock, release safety interlocks, and yield all arms to safe home postures"
          className={`px-2 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md sm:px-3 ${
            isDeadlocked
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-glow-red'
              : 'bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300'
          }`}
        >
          {isDeadlocked ? <AlertTriangle className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">CLEAR DEADLOCK</span>
        </button>

        {/* Playback Controls */}
        <div className="flex items-center gap-1 bg-industrial-950 p-1 rounded-lg border border-industrial-800">
          <button
            onClick={handlePlayToggle}
            disabled={!trajectory}
            title={isPlaying && !isPaused ? 'Pause Trajectory' : 'Play Trajectory'}
            className={`p-1.5 rounded text-xs transition-colors ${
              !trajectory
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : isPlaying && !isPaused
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`}
          >
            {isPlaying && !isPaused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={stopSimulation}
            disabled={!isPlaying}
            title="Stop Execution"
            className="p-1.5 rounded hover:bg-industrial-800 text-slate-400 hover:text-rose-400 disabled:opacity-40"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetToHome}
            title="Reset Active Arm to Home"
            className="p-1.5 rounded hover:bg-industrial-800 text-slate-400 hover:text-cyanAccent"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Backend Connectivity Status */}
        <div
          title={backendConnected ? 'FastAPI Backend Connected (Port 8000)' : 'Connecting to Python Backend...'}
          className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-industrial-950 border border-industrial-800"
        >
          {backendConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow-cyan" />
              <span className="hidden text-[11px] text-emerald-400 font-medium sm:inline">FastAPI</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="hidden text-[11px] text-amber-400 font-medium sm:inline">Connecting</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
