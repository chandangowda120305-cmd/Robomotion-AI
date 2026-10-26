import {
  RobotConfig,
  Pose,
  LinkFrame,
  Obstacle,
  PlanResult,
  TrajectoryData,
  TelemetryData,
  PickPlaceTask,
  AutomationSequence,
  BenchmarkMetric,
  SimulationRunRecord
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const API_ROOT = API_BASE.replace(/\/api$/, '');

export const apiClient = {
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_ROOT}/`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getRobotConfig(): Promise<RobotConfig> {
    const res = await fetch(`${API_BASE}/robot/config`);
    if (!res.ok) throw new Error('Failed to fetch robot config');
    return res.json();
  },

  async computeFK(angles: number[], arm_base_pos?: [number, number, number], arm_base_yaw?: number): Promise<{
    end_effector_pose: Pose;
    link_frames: LinkFrame[];
    transformation_matrix: number[][];
  }> {
    const res = await fetch(`${API_BASE}/robot/fk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angles, arm_base_pos, arm_base_yaw })
    });
    if (!res.ok) throw new Error('FK calculation failed');
    return res.json();
  },

  async computeIK(params: {
    target_position: [number, number, number];
    target_orientation?: [number, number, number];
    initial_guess?: number[];
    tolerance_pos?: number;
    position_only?: boolean;
    damping?: number;
    arm_base_pos?: [number, number, number];
    arm_base_yaw?: number;
    in_world?: boolean;
  }): Promise<{
    success: boolean;
    angles: number[];
    angles_deg: number[];
    iterations: number;
    final_error_pos: number;
    final_error_rot: number;
    end_effector_pose: Pose;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/robot/ik`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'IK failed' }));
      throw new Error(err.detail || 'IK request failed');
    }
    return res.json();
  },

  async getWorkspacePoints(samples = 1000): Promise<[number, number, number][]> {
    const res = await fetch(`${API_BASE}/robot/workspace?samples=${samples}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.points;
  },

  async checkCollision(angles: number[], obstacles: Obstacle[]): Promise<{
    in_collision: boolean;
    colliding_link_index?: number;
    colliding_link_name?: string;
    colliding_obstacle_id?: string;
    min_distance: number;
    details: string;
  }> {
    const res = await fetch(`${API_BASE}/planning/collision_check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angles, obstacles })
    });
    if (!res.ok) throw new Error('Collision check failed');
    return res.json();
  },

  async planMotion(params: {
    start_angles: number[];
    goal_angles?: number[];
    target_pose?: Pose;
    algorithm: 'rrt' | 'rrt_star' | 'rrt_star_opt' | 'direct';
    obstacles: Obstacle[];
    max_iterations?: number;
    step_size?: number;
    goal_bias?: number;
    rewire_radius?: number;
    random_seed?: number;
  }): Promise<PlanResult> {
    const res = await fetch(`${API_BASE}/planning/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Planning request error' }));
      throw new Error(err.detail || 'Motion planning failed');
    }
    return res.json();
  },

  async generateTrajectory(params: {
    path: number[][];
    method?: 'cubic_spline' | 'linear_blend';
    speed_factor?: number;
  }): Promise<TrajectoryData> {
    const res = await fetch(`${API_BASE}/simulation/trajectory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Trajectory generation failed');
    return res.json();
  },

  async simulateTelemetry(params: {
    trajectory: TrajectoryData;
    kp?: number[];
    ki?: number[];
    kd?: number[];
    load_mass?: number;
  }): Promise<TelemetryData> {
    const res = await fetch(`${API_BASE}/simulation/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Telemetry simulation failed');
    return res.json();
  },

  async saveSimulationRun(record: {
    name?: string;
    algorithm: string;
    success: boolean;
    planning_time_ms: number;
    execution_time_s: number;
    path_length: number;
    sampled_nodes: number;
    collision_checks: number;
    max_velocity?: number;
    max_acceleration?: number;
    rms_tracking_error?: number;
    details?: Record<string, any>;
  }): Promise<{ success: boolean; run_id: string }> {
    const res = await fetch(`${API_BASE}/simulation/save_run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error('Failed to save run');
    return res.json();
  },

  async planPickPlace(params: {
    task: PickPlaceTask;
    start_angles?: number[];
    obstacles: Obstacle[];
    speed_factor?: number;
    arm_base_pos?: [number, number, number];
    arm_base_yaw?: number;
  }): Promise<{
    success: boolean;
    error_message?: string;
    task_id: string;
    stages: any[];
  }> {
    const res = await fetch(`${API_BASE}/pick_place/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Pick and place planning failed');
    return res.json();
  },

  async runDiagnostics(params: {
    task: PickPlaceTask;
    start_angles?: number[];
    obstacles?: Obstacle[];
    arm_base_pos?: [number, number, number];
    arm_base_yaw?: number;
  }): Promise<{
    task_id: string;
    stages: Array<{
      stage_number: number;
      stage_name: string;
      status: 'passed' | 'failed';
      duration_ms: number;
      details: string;
      data?: Record<string, any>;
    }>;
    all_passed: boolean;
    failure_stage: number | null;
    overall_message: string;
  }> {
    const res = await fetch(`${API_BASE}/pick_place/diagnostics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        obstacles: [],
        ...params
      })
    });
    if (!res.ok) throw new Error('Diagnostics execution failed');
    return res.json();
  },

  async validateAutomationSequence(params: {
    sequence: AutomationSequence;
    initial_angles?: number[];
    obstacles: Obstacle[];
  }): Promise<{
    valid: boolean;
    failing_step_index: number | null;
    failing_step_id: string | null;
    error_message: string | null;
    compiled_steps: any[];
  }> {
    const res = await fetch(`${API_BASE}/automation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Sequence validation failed');
    return res.json();
  },

  async runBenchmark(params: {
    algorithms: string[];
    start_angles: number[];
    goal_angles: number[];
    obstacles: Obstacle[];
    num_trials: number;
    step_size?: number;
  }): Promise<BenchmarkMetric[]> {
    const res = await fetch(`${API_BASE}/planning/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Benchmark execution failed');
    return res.json();
  },

  async getSimulationRuns(): Promise<SimulationRunRecord[]> {
    const res = await fetch(`${API_BASE}/history/runs`);
    if (!res.ok) return [];
    return res.json();
  },

  getExportCsvUrl(): string {
    return `${API_BASE}/history/export_csv`;
  }
};
