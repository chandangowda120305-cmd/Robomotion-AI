import React, { useEffect, useState } from 'react';
import {
  History,
  Download,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar
} from 'lucide-react';
import { apiClient } from '../api/client';
import { SimulationRunRecord } from '../types';
import { useRobotStore } from '../store/useRobotStore';

export const HistoryPage: React.FC = () => {
  const [runs, setRuns] = useState<SimulationRunRecord[]>([]);
  const [filterAlgorithm, setFilterAlgorithm] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRun, setSelectedRun] = useState<SimulationRunRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const addNotification = useRobotStore((s) => s.addNotification);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getSimulationRuns();
      setRuns(data);
    } catch (err: any) {
      addNotification('Failed to load history runs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredRuns = runs.filter((r) => {
    const matchesAlg = filterAlgorithm === 'all' || r.algorithm.toLowerCase().includes(filterAlgorithm.toLowerCase());
    const matchesSearch = searchTerm === '' || r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAlg && matchesSearch;
  });

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs select-none">
      {/* Top Banner */}
      <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-cyanAccent" />
          <div>
            <span className="font-semibold text-white block">Simulation History & SQLite Persistence</span>
            <span className="text-[11px] text-slate-400">
              Audit trails, trajectory performance logs, and empirical telemetry records
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            className="p-1.5 rounded-lg bg-industrial-950 border border-industrial-800 hover:border-cyanAccent text-slate-400 hover:text-cyanAccent"
            title="Refresh history"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <a
            href={apiClient.getExportCsvUrl()}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-cyanAccent hover:bg-cyanAccent-dark text-industrial-950 text-[11px] font-bold flex items-center gap-1.5 shadow-glow-cyan"
          >
            <Download className="w-3.5 h-3.5" /> Export All Records (CSV)
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3 bg-industrial-900 border border-industrial-800 p-2.5 rounded-xl text-xs">
        <div className="flex-1 flex items-center gap-2 bg-industrial-950 px-2.5 py-1.5 rounded-lg border border-industrial-800">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search run ID or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-slate-200 outline-none w-full text-xs font-mono"
          />
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px]">
          {['all', 'RRT', 'RRT*', 'Direct'].map((alg) => (
            <button
              key={alg}
              onClick={() => setFilterAlgorithm(alg)}
              className={`px-2.5 py-1 rounded-lg border transition-colors ${
                filterAlgorithm === alg
                  ? 'bg-cyanAccent/20 border-cyanAccent text-cyanAccent font-semibold'
                  : 'bg-industrial-950 border-industrial-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {alg}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl overflow-hidden">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="bg-industrial-950 border-b border-industrial-800 text-slate-400 text-[10px] uppercase">
            <tr>
              <th className="py-2.5 px-3">Run ID</th>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Algorithm</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Plan Time</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3">Path Cost</th>
              <th className="py-2.5 px-3">Checks</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-850 text-slate-300">
            {filteredRuns.map((r) => (
              <tr key={r.id} className="hover:bg-industrial-850/50 transition-colors">
                <td className="py-2.5 px-3 font-bold text-cyanAccent">{r.id}</td>
                <td className="py-2.5 px-3 max-w-[180px] truncate text-white">{r.name}</td>
                <td className="py-2.5 px-3">{r.algorithm}</td>
                <td className="py-2.5 px-3">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      r.success
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {r.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </td>
                <td className="py-2.5 px-3">{r.planning_time_ms.toFixed(1)} ms</td>
                <td className="py-2.5 px-3">{r.execution_time_s.toFixed(2)} s</td>
                <td className="py-2.5 px-3">{r.path_length.toFixed(3)} rad</td>
                <td className="py-2.5 px-3">{r.collision_checks}</td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => setSelectedRun(r)}
                    className="p-1 rounded bg-industrial-950 border border-industrial-800 hover:border-cyanAccent text-slate-400 hover:text-cyanAccent"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {filteredRuns.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500 font-mono text-[11px]">
                  {loading ? 'Querying SQLite database...' : 'No simulation run records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-industrial-900 border border-industrial-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-bold text-white text-sm">Run Details: {selectedRun.id}</span>
              <button
                onClick={() => setSelectedRun(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                <span className="text-slate-500 block text-[10px]">Algorithm</span>
                <span className="text-white font-bold">{selectedRun.algorithm}</span>
              </div>
              <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                <span className="text-slate-500 block text-[10px]">Planning Latency</span>
                <span className="text-cyanAccent font-bold">{selectedRun.planning_time_ms.toFixed(2)} ms</span>
              </div>
              <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                <span className="text-slate-500 block text-[10px]">Total Path Cost</span>
                <span className="text-white font-bold">{selectedRun.path_length.toFixed(4)} rad</span>
              </div>
              <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                <span className="text-slate-500 block text-[10px]">RMS Tracking Error</span>
                <span className="text-emerald-400 font-bold">{selectedRun.rms_tracking_error.toFixed(4)} rad</span>
              </div>
              <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                <span className="text-slate-500 block text-[10px]">Sampled Configurations</span>
                <span className="text-white">{selectedRun.sampled_nodes}</span>
              </div>
              <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
                <span className="text-slate-500 block text-[10px]">Collision Checks</span>
                <span className="text-white">{selectedRun.collision_checks}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedRun(null)}
                className="px-4 py-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-750 text-slate-200 text-xs font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
