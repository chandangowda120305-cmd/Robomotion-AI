import React, { useState } from 'react';
import {
  BarChart3,
  Play,
  Download,
  Activity,
  Layers,
  CheckCircle2,
  Zap,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { useRobotStore } from '../store/useRobotStore';
import { apiClient } from '../api/client';
import { BenchmarkMetric } from '../types';

export const AnalyticsPage: React.FC = () => {
  const obstacles = useRobotStore((s) => s.obstacles);
  const jointAngles = useRobotStore((s) => s.jointAngles);
  const benchmarkMetrics = useRobotStore((s) => s.benchmarkMetrics);
  const setBenchmarkMetrics = useRobotStore((s) => s.setBenchmarkMetrics);
  const addNotification = useRobotStore((s) => s.addNotification);

  const [numTrials, setNumTrials] = useState<number>(3);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState<boolean>(false);

  // Goal configuration for benchmarking
  const goalConfig = [0.8, 0.45, -0.7, 0.2, 0.1, 0.0];

  const handleRunBenchmark = async () => {
    setIsRunningBenchmark(true);
    addNotification(`Executing ${numTrials} empirical trials per algorithm...`, 'info');
    try {
      const res = await apiClient.runBenchmark({
        algorithms: ['direct', 'rrt', 'rrt_star', 'rrt_star_opt'],
        start_angles: jointAngles,
        goal_angles: goalConfig,
        obstacles: obstacles,
        num_trials: numTrials,
        step_size: 0.15
      });
      setBenchmarkMetrics(res);
      addNotification('Benchmark trials completed successfully!', 'success');
    } catch (err: any) {
      addNotification(`Benchmark failed: ${err.message}`, 'error');
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  const handleExportCsv = () => {
    window.open(apiClient.getExportCsvUrl(), '_blank');
  };

  // Prepare chart datasets
  const chartData = benchmarkMetrics.map((m) => ({
    algorithm: m.algorithm,
    'Planning Time (ms)': m.avg_planning_time_ms,
    'Path Length (rad)': m.avg_path_length,
    'Sampled Nodes': m.avg_sampled_nodes,
    'Collision Checks': m.avg_collision_checks,
    'Success Rate (%)': Math.round(m.success_rate * 100)
  }));

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs select-none">
      {/* Top Banner & Benchmark Controls */}
      <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyanAccent" />
          <div>
            <span className="font-semibold text-white block">
              Empirical Motion Planning Benchmark & Analytics
            </span>
            <span className="text-[11px] text-slate-400">
              Rigorous comparative evaluation across RRT, RRT*, RRT*+Opt, and baseline
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
            <span className="text-slate-500">Trials:</span>
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setNumTrials(n)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  numTrials === n
                    ? 'bg-cyanAccent/20 border-cyanAccent text-cyanAccent font-bold'
                    : 'bg-industrial-950 border-industrial-800 text-slate-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={handleRunBenchmark}
            disabled={isRunningBenchmark}
            className="px-4 py-1.5 rounded-lg bg-cyanAccent hover:bg-cyanAccent-dark text-industrial-950 text-[11px] font-bold flex items-center gap-1.5 shadow-glow-cyan disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {isRunningBenchmark ? 'Running Benchmark...' : 'Run Benchmark Trials'}
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg bg-industrial-950 border border-industrial-800 hover:border-slate-600 text-slate-300 text-[11px] font-mono flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {benchmarkMetrics.map((m) => (
          <div
            key={m.algorithm}
            className="bg-industrial-900 border border-industrial-800 p-3.5 rounded-xl space-y-2"
          >
            <div className="flex items-center justify-between border-b border-industrial-800 pb-1.5">
              <span className="font-bold text-white font-mono text-xs">{m.algorithm}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                {(m.success_rate * 100).toFixed(0)}% Succ
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Avg Plan Time:</span>
                <span className="text-cyanAccent font-semibold">{m.avg_planning_time_ms} ms</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Avg Path Length:</span>
                <span className="text-white font-semibold">{m.avg_path_length} rad</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Sampled Nodes:</span>
                <span className="text-slate-300">{m.avg_sampled_nodes}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Collision Checks:</span>
                <span className="text-slate-300">{m.avg_collision_checks}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recharts Comparison Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Planning Time & Path Length */}
        <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-2">
          <span className="font-semibold text-white block">Planning Latency & Path Length</span>
          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="algorithm" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Planning Time (ms)" fill="#06b6d4" />
                  <Bar dataKey="Path Length (rad)" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-[11px]">
                Click 'Run Benchmark Trials' to populate empirical charts.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Sampled Nodes & Collision Checks */}
        <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-xl space-y-2">
          <span className="font-semibold text-white block">Sampled Nodes & Collision Complexity</span>
          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="algorithm" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Sampled Nodes" fill="#3b82f6" />
                  <Bar dataKey="Collision Checks" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-[11px]">
                Click 'Run Benchmark Trials' to populate empirical charts.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
