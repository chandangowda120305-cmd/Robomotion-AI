import time
import numpy as np
from typing import List, Optional, Dict, Any
from app.kinematics.dh_model import RobotModel
from app.collision.checker import CollisionChecker
from app.schemas.models import Obstacle


class DirectInterpolator:
    """
    Direct linear joint-space interpolation planner used as a comparative baseline.
    Checks whether a straight-line joint path is collision-free.
    """

    def __init__(
        self,
        robot_model: Optional[RobotModel] = None,
        collision_checker: Optional[CollisionChecker] = None
    ):
        self.robot = robot_model or RobotModel()
        self.checker = collision_checker or CollisionChecker(self.robot)

    def plan(
        self,
        start_q: np.ndarray,
        goal_q: np.ndarray,
        obstacles: List[Obstacle],
        step_size: float = 0.08
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        start_q = np.asarray(start_q, dtype=float)
        goal_q = np.asarray(goal_q, dtype=float)

        dist = float(np.linalg.norm(goal_q - start_q))
        num_steps = max(5, int(np.ceil(dist / step_size)))

        path = []
        ee_path = []
        collision_checks = 0

        for i in range(num_steps + 1):
            alpha = i / num_steps
            q = (1.0 - alpha) * start_q + alpha * goal_q
            collision_checks += 1
            res = self.checker.check_collision(q, obstacles)
            if res["in_collision"]:
                return {
                    "success": False,
                    "algorithm": "Direct Interpolation",
                    "path": [],
                    "ee_path": [],
                    "planning_time_s": time.perf_counter() - start_time,
                    "iterations": i,
                    "sampled_nodes": num_steps + 1,
                    "collision_checks": collision_checks,
                    "valid_nodes": i,
                    "rejected_nodes": 1,
                    "path_cost": 0.0,
                    "message": f"Direct interpolation collides with {res.get('colliding_obstacle_id') or 'environment'}."
                }

            path.append(q.tolist())
            transforms = self.robot.forward_kinematics_transforms(q)
            ee_path.append(transforms[-1][:3, 3].tolist())

        planning_time = time.perf_counter() - start_time
        return {
            "success": True,
            "algorithm": "Direct Interpolation",
            "path": path,
            "ee_path": ee_path,
            "planning_time_s": planning_time,
            "iterations": num_steps,
            "sampled_nodes": num_steps + 1,
            "collision_checks": collision_checks,
            "valid_nodes": num_steps + 1,
            "rejected_nodes": 0,
            "path_cost": dist,
            "message": f"Direct collision-free path found with {len(path)} waypoints."
        }
