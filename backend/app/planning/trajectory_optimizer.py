import numpy as np
from typing import List, Optional, Dict, Any
from app.kinematics.dh_model import RobotModel
from app.collision.checker import CollisionChecker
from app.schemas.models import Obstacle


class TrajectoryOptimizer:
    """
    Trajectory Optimizer and Path Shortcutter.
    Reduces path length and eliminates redundant joint motions while
    guaranteeing collision avoidance and joint-limit compliance.
    """

    def __init__(
        self,
        robot_model: Optional[RobotModel] = None,
        collision_checker: Optional[CollisionChecker] = None
    ):
        self.robot = robot_model or RobotModel()
        self.checker = collision_checker or CollisionChecker(self.robot)

    def optimize_path(
        self,
        raw_path: List[List[float]],
        obstacles: List[Obstacle],
        max_shortcut_iterations: int = 80
    ) -> List[List[float]]:
        """
        Applies randomized path shortcutting on joint-space waypoints.
        """
        if len(raw_path) <= 2:
            return raw_path

        path = [np.array(q, dtype=float) for q in raw_path]

        for _ in range(max_shortcut_iterations):
            if len(path) <= 2:
                break

            n = len(path)
            i = np.random.randint(0, n - 2)
            j = np.random.randint(i + 2, n)

            # Check if segment between path[i] and path[j] is collision-free
            if self.checker.is_path_segment_valid(path[i], path[j], obstacles, check_step=0.04):
                # Replace intermediate nodes with shortcut
                path = path[:i + 1] + path[j:]

        # Resample path if consecutive waypoint gaps are too large
        dense_path = []
        max_gap = 0.15  # rad
        for k in range(len(path) - 1):
            q_a = path[k]
            q_b = path[k + 1]
            dist = float(np.linalg.norm(q_b - q_a))
            steps = max(1, int(np.ceil(dist / max_gap)))
            for s in range(steps):
                alpha = s / steps
                dense_path.append((1.0 - alpha) * q_a + alpha * q_b)
        dense_path.append(path[-1])

        return [q.tolist() for q in dense_path]
