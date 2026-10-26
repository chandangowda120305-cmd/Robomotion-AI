from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class JointConfig(BaseModel):
    angles: List[float] = Field(..., description="6 joint angles in radians")


class JointLimits(BaseModel):
    min_limits: List[float] = Field(default=[-3.14159, -2.356, -2.705, -3.14159, -3.14159, -6.28318])
    max_limits: List[float] = Field(default=[3.14159, 2.356, 2.705, 3.14159, 3.14159, 6.28318])
    max_velocities: List[float] = Field(default=[2.0, 2.0, 2.5, 3.0, 3.0, 4.0])  # rad/s
    max_accelerations: List[float] = Field(default=[5.0, 5.0, 6.0, 8.0, 8.0, 10.0])  # rad/s^2


class Pose(BaseModel):
    position: List[float] = Field(..., description="[x, y, z] in meters")
    orientation: List[float] = Field(default=[0.0, 0.0, 0.0], description="Euler angles [roll, pitch, yaw] in radians")
    quaternion: Optional[List[float]] = Field(default=None, description="[x, y, z, w]")
    matrix: Optional[List[List[float]]] = Field(default=None, description="4x4 homogeneous transformation matrix")


class LinkFrame(BaseModel):
    joint_index: int
    name: str
    position: List[float]
    orientation: List[float]
    matrix: List[List[float]]


class FKRequest(BaseModel):
    angles: List[float] = Field(..., description="6 joint angles in radians")
    arm_base_pos: Optional[List[float]] = None
    arm_base_yaw: float = 0.0


class FKResponse(BaseModel):
    angles: List[float]
    angles_deg: List[float]
    end_effector_pose: Pose
    link_frames: List[LinkFrame]
    transformation_matrix: List[List[float]]


class IKRequest(BaseModel):
    target_position: List[float]
    target_orientation: Optional[List[float]] = None  # roll, pitch, yaw
    target_quaternion: Optional[List[float]] = None
    target_matrix: Optional[List[List[float]]] = None
    initial_guess: Optional[List[float]] = None
    tolerance_pos: float = 0.001  # 1mm
    tolerance_rot: float = 0.02   # ~1 deg
    max_iterations: int = 150
    damping: float = 0.05
    position_only: bool = False
    arm_base_pos: Optional[List[float]] = None
    arm_base_yaw: float = 0.0
    in_world: bool = False


class IKResponse(BaseModel):
    success: bool
    angles: List[float]
    angles_deg: List[float]
    iterations: int
    final_error_pos: float
    final_error_rot: float
    end_effector_pose: Pose
    message: str


class Obstacle(BaseModel):
    id: str
    name: str
    type: Literal["box", "sphere", "cylinder"]
    position: List[float]  # [x, y, z]
    rotation: List[float] = [0.0, 0.0, 0.0]  # [rx, ry, rz]
    size: List[float] = [0.2, 0.2, 0.2]  # [dx, dy, dz] or [radius, height, 0] or [radius, 0, 0]
    velocity: List[float] = [0.0, 0.0, 0.0]  # [vx, vy, vz] for dynamic obstacles
    is_moving: bool = False
    color: Optional[str] = "#f59e0b"


class CollisionCheckRequest(BaseModel):
    angles: List[float]
    obstacles: List[Obstacle]


class CollisionCheckResponse(BaseModel):
    in_collision: bool
    colliding_link_index: Optional[int] = None
    colliding_link_name: Optional[str] = None
    colliding_obstacle_id: Optional[str] = None
    min_distance: float
    details: str


class PlanRequest(BaseModel):
    start_angles: List[float]
    goal_angles: Optional[List[float]] = None
    target_pose: Optional[Pose] = None
    algorithm: Literal["rrt", "rrt_star", "rrt_star_opt", "direct"] = "rrt_star"
    obstacles: List[Obstacle] = []
    max_iterations: int = 1500
    step_size: float = 0.15  # rad
    goal_bias: float = 0.15
    rewire_radius: float = 0.5  # rad for RRT*
    random_seed: Optional[int] = None
    max_time_s: float = 5.0


class TrajectoryPoint(BaseModel):
    time: float
    angles: List[float]
    velocities: List[float]
    accelerations: List[float]
    ee_position: List[float]


class PlanResponse(BaseModel):
    success: bool
    algorithm: str
    path: List[List[float]]  # List of 6-DOF configurations
    ee_path: List[List[float]]  # 3D points
    planning_time_s: float
    iterations: int
    sampled_nodes: int
    collision_checks: int
    valid_nodes: int
    rejected_nodes: int
    path_cost: float
    message: str


class TrajectoryRequest(BaseModel):
    path: List[List[float]]
    method: Literal["cubic_spline", "linear_blend"] = "cubic_spline"
    speed_factor: float = 1.0
    dt: float = 0.02


class TrajectoryResponse(BaseModel):
    success: bool
    total_duration: float
    time_points: List[float]
    positions: List[List[float]]  # [N][6]
    velocities: List[List[float]]  # [N][6]
    accelerations: List[List[float]]  # [N][6]
    ee_positions: List[List[float]]  # [N][3]
    max_velocity: float
    max_acceleration: float


class TelemetryRequest(BaseModel):
    trajectory: TrajectoryResponse
    kp: List[float] = [15.0, 15.0, 18.0, 20.0, 20.0, 25.0]
    ki: List[float] = [1.2, 1.2, 1.5, 2.0, 2.0, 2.5]
    kd: List[float] = [3.0, 3.0, 3.5, 4.0, 4.0, 5.0]
    load_mass: float = 0.2  # kg payload


class TelemetryResponse(BaseModel):
    time_points: List[float]
    target_positions: List[List[float]]
    actual_positions: List[List[float]]
    velocities: List[List[float]]
    accelerations: List[List[float]]
    tracking_errors: List[List[float]]
    control_outputs: List[List[float]]
    ee_positions: List[List[float]]
    max_tracking_error: float
    rms_tracking_error: float


class PickPlaceTask(BaseModel):
    id: str
    name: str
    object_id: str
    object_type: str = "box"
    object_color: str = "#38bdf8"
    object_size: List[float] = [0.06, 0.06, 0.06]
    pick_position: List[float]  # [x, y, z]
    place_position: List[float]  # [x, y, z]
    status: Literal["pending", "planning", "executing", "completed", "failed"] = "pending"
    progress: float = 0.0
    error_message: Optional[str] = None


class AutomationStep(BaseModel):
    id: str
    type: Literal[
        "move_joints",
        "move_pose",
        "open_gripper",
        "close_gripper",
        "wait",
        "pick_object",
        "place_object",
        "home",
        "stop_on_error"
    ]
    name: str
    params: Dict[str, Any] = {}
    status: Literal["idle", "running", "success", "failed"] = "idle"


class AutomationSequence(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    steps: List[AutomationStep]
    status: Literal["idle", "running", "paused", "completed", "failed"] = "idle"


class BenchmarkRequest(BaseModel):
    algorithms: List[str] = ["direct", "rrt", "rrt_star", "rrt_star_opt"]
    start_angles: List[float]
    goal_angles: List[float]
    obstacles: List[Obstacle] = []
    num_trials: int = 5
    step_size: float = 0.15
    max_iterations: int = 1500


class BenchmarkMetric(BaseModel):
    algorithm: str
    success_rate: float
    avg_planning_time_ms: float
    avg_path_length: float
    avg_sampled_nodes: float
    avg_collision_checks: float
    std_planning_time_ms: float
    trials_details: List[Dict[str, Any]]
