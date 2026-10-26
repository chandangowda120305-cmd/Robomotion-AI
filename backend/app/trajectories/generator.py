import numpy as np
from scipy.interpolate import CubicSpline
from typing import List, Dict, Any, Optional
from app.kinematics.dh_model import RobotModel


class TrajectoryGenerator:
    """
    Time-parameterized trajectory generator with joint velocity and
    acceleration limits, smooth start and stop boundary conditions.
    """

    def __init__(self, robot_model: Optional[RobotModel] = None):
        self.robot = robot_model or RobotModel()
        # Default velocity and acceleration limits in rad/s and rad/s^2
        self.vel_limits = np.array([2.0, 2.0, 2.5, 3.0, 3.0, 4.0])
        self.acc_limits = np.array([5.0, 5.0, 6.0, 8.0, 8.0, 10.0])

    def generate(
        self,
        path: List[List[float]],
        method: str = "cubic_spline",
        speed_factor: float = 1.0,
        dt: float = 0.02
    ) -> Dict[str, Any]:
        """
        Converts discrete waypoint path into continuous time-parameterized trajectory.
        """
        if len(path) < 2:
            raise ValueError("Path must contain at least 2 waypoints.")

        path_arr = np.array(path, dtype=float)  # shape (M, 6)
        num_waypoints = len(path_arr)

        effective_vel_limits = self.vel_limits * np.clip(speed_factor, 0.1, 2.0)
        effective_acc_limits = self.acc_limits * np.clip(speed_factor, 0.1, 2.0)

        # Calculate time intervals for each segment based on dynamic limits
        t_waypoints = [0.0]
        for k in range(num_waypoints - 1):
            dq = np.abs(path_arr[k + 1] - path_arr[k])
            # Minimum time required by velocity limit
            t_vel = np.max(dq / effective_vel_limits)
            # Minimum time required by acceleration limit
            t_acc = np.max(np.sqrt(2.0 * dq / effective_acc_limits))
            # Safe segment duration
            seg_dt = max(0.08, float(max(t_vel, t_acc)))
            t_waypoints.append(t_waypoints[-1] + seg_dt)

        t_waypoints = np.array(t_waypoints)
        total_duration = float(t_waypoints[-1])

        # Generate evaluation sample times (50 Hz = 0.02s dt)
        num_samples = max(2, int(np.ceil(total_duration / dt)) + 1)
        time_points = np.linspace(0.0, total_duration, num_samples)

        if method == "cubic_spline" and num_waypoints >= 3:
            # Clamped cubic spline with zero initial and final velocity
            cs = CubicSpline(t_waypoints, path_arr, bc_type=((1, np.zeros(6)), (1, np.zeros(6))))
            positions = cs(time_points)
            velocities = cs(time_points, 1)
            accelerations = cs(time_points, 2)
        else:
            # Linear interpolation with trapezoidal time mapping
            positions = np.zeros((num_samples, 6))
            velocities = np.zeros((num_samples, 6))
            accelerations = np.zeros((num_samples, 6))

            for j in range(6):
                positions[:, j] = np.interp(time_points, t_waypoints, path_arr[:, j])
                velocities[:, j] = np.gradient(positions[:, j], dt)
                accelerations[:, j] = np.gradient(velocities[:, j], dt)

        # Compute end-effector 3D trajectory positions
        ee_positions = []
        for q in positions:
            transforms = self.robot.forward_kinematics_transforms(q)
            ee_positions.append(transforms[-1][:3, 3].tolist())

        max_vel = float(np.max(np.abs(velocities)))
        max_acc = float(np.max(np.abs(accelerations)))

        return {
            "success": True,
            "total_duration": total_duration,
            "time_points": time_points.tolist(),
            "positions": positions.tolist(),
            "velocities": velocities.tolist(),
            "accelerations": accelerations.tolist(),
            "ee_positions": ee_positions,
            "max_velocity": max_vel,
            "max_acceleration": max_acc
        }
