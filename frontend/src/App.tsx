import React, { useEffect } from 'react';
import { useRobotStore } from './store/useRobotStore';
import { apiClient } from './api/client';
import { Navbar } from './components/Navbar';
import { Viewport3D } from './robot/Viewport3D';
import { TelemetryTimeline } from './components/TelemetryTimeline';
import { OverviewPage } from './pages/OverviewPage';
import { RobotStudioPage } from './pages/RobotStudioPage';
import { MotionPlanningPage } from './pages/MotionPlanningPage';
import { PickPlacePage } from './pages/PickPlacePage';
import { AutomationPage } from './pages/AutomationPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const activeTab = useRobotStore((s) => s.activeTab);
  const setBackendConnected = useRobotStore((s) => s.setBackendConnected);
  const notifications = useRobotStore((s) => s.notifications);
  const removeNotification = useRobotStore((s) => s.removeNotification);

  // Poll backend health on startup and periodically
  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const ok = await apiClient.checkHealth();
      if (isMounted) setBackendConnected(ok);
    };

    check();
    const interval = setInterval(check, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [setBackendConnected]);

  // Determine whether to show 3D viewport side-by-side or full-width page
  const isSimulationSplitView =
    activeTab === 'studio' || activeTab === 'planning' || activeTab === 'pick_place';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-industrial-950 text-slate-200">
      {/* Top Industrial Navigation Bar */}
      <Navbar />

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden relative">
        {isSimulationSplitView ? (
          /* Split Workspace Layout for CAD / Simulation Studio */
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full h-full overflow-hidden">
            {/* Left 3D Interactive Viewport */}
            <div className="flex-1 h-[42%] min-h-0 w-full relative border-b border-industrial-800 lg:h-full lg:border-b-0 lg:border-r">
              <Viewport3D />
            </div>

            {/* Right Collapsible Control Panel */}
            <div className="h-[58%] min-h-0 w-full bg-industrial-950 overflow-hidden flex flex-col shrink-0 lg:h-full lg:w-[480px] xl:w-[540px]">
              {activeTab === 'studio' && <RobotStudioPage />}
              {activeTab === 'planning' && <MotionPlanningPage />}
              {activeTab === 'pick_place' && <PickPlacePage />}
            </div>
          </div>
        ) : (
          /* Dedicated Full-Width Pages */
          <div className="flex-1 h-full overflow-hidden bg-industrial-950">
            {activeTab === 'overview' && <OverviewPage />}
            {activeTab === 'automation' && <AutomationPage />}
            {activeTab === 'analytics' && <AnalyticsPage />}
            {activeTab === 'history' && <HistoryPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </div>
        )}

        {/* Floating Notification Toasts */}
        <div className="fixed bottom-16 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => removeNotification(n.id)}
              className={`pointer-events-auto p-3 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-mono max-w-sm backdrop-blur-md transition-all cursor-pointer ${
                n.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-glow-amber'
                  : n.type === 'error'
                  ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-glow-red'
                  : n.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/50 text-amber-200 shadow-glow-amber'
                  : 'bg-industrial-900/90 border-cyanAccent/40 text-cyan-200 shadow-glow-cyan'
              }`}
            >
              {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {n.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
              {n.type === 'info' && <Info className="w-4 h-4 text-cyanAccent shrink-0" />}
              <span className="leading-snug">{n.text}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Timeline & Telemetry Panel */}
      <TelemetryTimeline />
    </div>
  );
};

export default App;
