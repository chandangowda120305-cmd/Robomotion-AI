export interface Pose {
  position: [number, number, number];
  orientation: [number, number, number]; // roll, pitch, yaw
  quaternion?: [number, number, number, number];
  matrix?: number[][];
}

export interface LinkFrame {
  joint_index: number;
  name: string;
  position: [number, number, number];
  orientation: [number, number, number];
  matrix: number[][];
}

export interface RoboticArmState {
  id: string;
  name: string;
  role: string;
  basePosition: [number, number, number];
  baseRotation: number; // yaw rotation in radians
  jointAngles: number[];
  currentPose: Pose;
  targetPose: Pose;
  color: string;
  accentColor: string;
  gripperState: 'open' | 'closed';
  isDeadlocked: boolean;
  status: 'idle' | 'moving' | 'deadlocked' | 'cleared';
  attachedObjectId?: string | null;
  trajectory?: TrajectoryData | null;
  currentPlayheadTime?: number;
  isPlaying?: boolean;
}

export interface RobotConfig {
  joint_names: string[];
  joint_limits_min: number[];
  joint_limits_max: number[];
  link_dimensions: {
    base_height: number;
    link1_height: number;
    link2_len: number;
    link3_len: number;
    link4_len: number;
    link5_len: number;
    tool_len: number;
  };
  link_radii: number[];
}

export interface Obstacle {
  id: string;
  name: string;
  type: 'box' | 'sphere' | 'cylinder';
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
  velocity?: [number, number, number];
  is_moving?: boolean;
  color?: string;
}

export interface PlanResult {
  success: boolean;
  algorithm: string;
  path: number[][]; // [N][6]
  ee_path: [number, number, number][]; // [N][3]
  planning_time_s: number;
  iterations: number;
  sampled_nodes: number;
  collision_checks: number;
  valid_nodes: number;
  rejected_nodes: number;
  path_cost: number;
  message: string;
}

export interface TrajectoryData {
  success: boolean;
  total_duration: number;
  time_points: number[];
  positions: number[][];
  velocities: number[][];
  accelerations: number[][];
  ee_positions: [number, number, number][];
  max_velocity: number;
  max_acceleration: number;
}

export interface TelemetryData {
  time_points: number[];
  target_positions: number[][];
  actual_positions: number[][];
  velocities: number[][];
  accelerations: number[][];
  tracking_errors: number[][];
  control_outputs: number[][];
  ee_positions: [number, number, number][];
  max_tracking_error: number;
  rms_tracking_error: number;
}

export interface PickPlaceStage {
  stage_id: number;
  name: string;
  action: 'move' | 'gripper_open' | 'gripper_close';
  gripper_state: 'open' | 'closed';
  attach_object: boolean;
  trajectory?: TrajectoryData;
  duration?: number;
}

export interface PickPlaceTask {
  id: string;
  name: string;
  object_id: string;
  object_type: string; // 'box' | 'cylinder' | 'sphere'
  object_color: string;
  object_size: [number, number, number];
  pick_position: [number, number, number];
  place_position: [number, number, number];
  status: 'pending' | 'planning' | 'executing' | 'completed' | 'failed';
  progress: number;
  error_message?: string;
  stages?: PickPlaceStage[];
  assignedArmId?: string;
  mass?: number;
}

export interface AutomationStep {
  id: string;
  type:
    | 'move_joints'
    | 'move_pose'
    | 'open_gripper'
    | 'close_gripper'
    | 'wait'
    | 'pick_object'
    | 'place_object'
    | 'home'
    | 'stop_on_error';
  name: string;
  params: Record<string, any>;
  status?: 'idle' | 'running' | 'success' | 'failed';
}

export interface AutomationSequence {
  id: string;
  name: string;
  description?: string;
  steps: AutomationStep[];
  status?: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
}

export interface BenchmarkTrial {
  trial: number;
  seed: number;
  success: boolean;
  time_ms: number;
  path_cost: number;
  sampled_nodes: number;
  collision_checks: number;
}

export interface BenchmarkMetric {
  algorithm: string;
  success_rate: number;
  avg_planning_time_ms: number;
  avg_path_length: number;
  avg_sampled_nodes: number;
  avg_collision_checks: number;
  std_planning_time_ms: number;
  trials_details: BenchmarkTrial[];
}

export interface SimulationRunRecord {
  id: string;
  name: string;
  algorithm: string;
  success: boolean;
  planning_time_ms: number;
  execution_time_s: number;
  path_length: number;
  sampled_nodes: number;
  collision_checks: number;
  max_velocity: number;
  max_acceleration: number;
  rms_tracking_error: number;
  details?: Record<string, any>;
  created_at: string;
}

export type NavigationTab =
  | 'overview'
  | 'studio'
  | 'planning'
  | 'pick_place'
  | 'automation'
  | 'analytics'
  | 'history'
  | 'settings';
