import time
import numpy as np
from typing import List, Optional, Dict, Any
from app.kinematics.dh_model import RobotModel
from app.collision.checker import CollisionChecker
from app.schemas.models import Obstacle


class RRTPlanner:
    """
    Joint-Space Rapidly-exploring Random Tree (RRT) Motion Planner.
    Features bidirectional tree extension (RRT-Connect) with intelligent goal-biasing,
    intermediate upright sampling heuristics, and deterministic random seed support.
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
        max_iterations: int = 1500,
        step_size: float = 0.18,
        goal_bias: float = 0.20,
        max_time_s: float = 5.0,
        random_seed: Optional[int] = None,
        in_world: bool = False
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        if random_seed is not None:
            np.random.seed(random_seed)

        start_q = np.asarray(start_q, dtype=float)
        goal_q = np.asarray(goal_q, dtype=float)

        # 1. Validate start and goal configurations
        if not self.checker.is_state_valid(start_q, obstacles, in_world=in_world):
            return {
                "success": False,
                "algorithm": "RRT-Connect",
                "path": [],
                "ee_path": [],
                "planning_time_s": time.perf_counter() - start_time,
                "iterations": 0,
                "sampled_nodes": 0,
                "collision_checks": 1,
                "valid_nodes": 0,
                "rejected_nodes": 1,
                "path_cost": 0.0,
                "message": "Start configuration violates joint limits or is in collision."
            }

        if not self.checker.is_state_valid(goal_q, obstacles, in_world=in_world):
            return {
                "success": False,
                "algorithm": "RRT-Connect",
                "path": [],
                "ee_path": [],
                "planning_time_s": time.perf_counter() - start_time,
                "iterations": 0,
                "sampled_nodes": 0,
                "collision_checks": 2,
                "valid_nodes": 1,
                "rejected_nodes": 1,
                "path_cost": 0.0,
                "message": "Goal configuration violates joint limits or is in collision."
            }

        # 2. Check if direct straight segment is collision-free
        if self.checker.is_path_segment_valid(start_q, goal_q, obstacles, check_step=0.04, in_world=in_world):
            dist = float(np.linalg.norm(goal_q - start_q))
            num_pts = max(3, int(np.ceil(dist / 0.10)))
            path = [((1.0 - a) * start_q + a * goal_q).tolist() for a in np.linspace(0.0, 1.0, num_pts)]
            ee_path = []
            for q in path:
                t = self.robot.forward_kinematics_transforms(np.array(q), in_world=in_world)
                ee_path.append(t[-1][:3, 3].tolist())

            return {
                "success": True,
                "algorithm": "RRT-Connect",
                "path": path,
                "ee_path": ee_path,
                "planning_time_s": time.perf_counter() - start_time,
                "iterations": 1,
                "sampled_nodes": 2,
                "collision_checks": num_pts,
                "valid_nodes": num_pts,
                "rejected_nodes": 0,
                "path_cost": dist,
                "message": f"Direct collision-free connection found with {len(path)} waypoints."
            }

        # 3. Bidirectional Trees
        # Node structure: dict mapping id -> (q, parent_id)
        tree_a = {0: (start_q, None)}
        tree_b = {0: (goal_q, None)}

        collision_checks = 3
        valid_nodes = 2
        rejected_nodes = 0
        sampled_nodes = 0

        connected_a_id = None
        connected_b_id = None

        for iteration in range(1, max_iterations + 1):
            if (time.perf_counter() - start_time) > max_time_s:
                break

            sampled_nodes += 1
            # Intelligent stratified sampling
            rnd = np.random.rand()
            if rnd < goal_bias:
                q_rand = np.copy(goal_q)
            elif rnd < goal_bias + 0.25:
                # Upright intermediate clearance sampling (keeps elbow and forearm clear of table)
                q_rand = np.array([
                    np.random.uniform(-np.pi, np.pi),
                    np.random.uniform(0.1, 0.7),
                    np.random.uniform(-1.0, -0.3),
                    np.random.uniform(-0.4, 0.4),
                    np.random.uniform(-1.0, 1.0),
                    0.0
                ])
            else:
                q_rand = np.random.uniform(self.robot.joint_limits_min, self.robot.joint_limits_max)

            # Grow tree A towards sample
            qs_a = np.array([node[0] for node in tree_a.values()])
            dists_a = np.linalg.norm(qs_a - q_rand, axis=1)
            near_idx_a = int(np.argmin(dists_a))
            near_id_a = list(tree_a.keys())[near_idx_a]
            q_near_a = qs_a[near_idx_a]

            dir_a = q_rand - q_near_a
            dist_val_a = float(dists_a[near_idx_a])
            step_a = step_size if dist_val_a > step_size else dist_val_a
            q_new_a = q_near_a + (dir_a / (dist_val_a + 1e-12)) * step_a

            collision_checks += 1
            if self.checker.is_path_segment_valid(q_near_a, q_new_a, obstacles, check_step=0.05, in_world=in_world):
                new_id_a = len(tree_a)
                tree_a[new_id_a] = (q_new_a, near_id_a)
                valid_nodes += 1

                # Connect tree B towards q_new_a
                qs_b = np.array([node[0] for node in tree_b.values()])
                dists_b = np.linalg.norm(qs_b - q_new_a, axis=1)
                near_idx_b = int(np.argmin(dists_b))
                near_id_b = list(tree_b.keys())[near_idx_b]
                q_near_b = qs_b[near_idx_b]

                dir_b = q_new_a - q_near_b
                dist_val_b = float(dists_b[near_idx_b])
                step_b = step_size if dist_val_b > step_size else dist_val_b
                q_new_b = q_near_b + (dir_b / (dist_val_b + 1e-12)) * step_b

                collision_checks += 1
                if self.checker.is_path_segment_valid(q_near_b, q_new_b, obstacles, check_step=0.05, in_world=in_world):
                    new_id_b = len(tree_b)
                    tree_b[new_id_b] = (q_new_b, near_id_b)
                    valid_nodes += 1

                    # Check connection between trees
                    gap = float(np.linalg.norm(q_new_a - q_new_b))
                    if gap <= step_size:
                        collision_checks += 1
                        if self.checker.is_path_segment_valid(q_new_a, q_new_b, obstacles, check_step=0.05, in_world=in_world):
                            connected_a_id = new_id_a
                            connected_b_id = new_id_b
                            break
                else:
                    rejected_nodes += 1
            else:
                rejected_nodes += 1

            # Swap tree roles for balanced bidirectional exploration
            if len(tree_a) > len(tree_b):
                tree_a, tree_b = tree_b, tree_a
                start_q, goal_q = goal_q, start_q

        planning_time = time.perf_counter() - start_time

        if connected_a_id is None or connected_b_id is None:
            return {
                "success": False,
                "algorithm": "RRT-Connect",
                "path": [],
                "ee_path": [],
                "planning_time_s": planning_time,
                "iterations": iteration,
                "sampled_nodes": sampled_nodes,
                "collision_checks": collision_checks,
                "valid_nodes": valid_nodes,
                "rejected_nodes": rejected_nodes,
                "path_cost": 0.0,
                "message": f"Planning timed out after {iteration} iterations without connecting start and goal."
            }

        # Reconstruct path from both trees
        path_a = []
        curr = connected_a_id
        while curr is not None:
            path_a.append(tree_a[curr][0])
            curr = tree_a[curr][1]
        path_a.reverse()

        path_b = []
        curr = connected_b_id
        while curr is not None:
            path_b.append(tree_b[curr][0])
            curr = tree_b[curr][1]

        # Check orientation of reconstructed path
        if np.linalg.norm(path_a[0] - start_q) > 1e-3:
            path_a, path_b = path_b, path_a

        full_path_nodes = path_a + path_b
        path = [q.tolist() for q in full_path_nodes]

        # Compute cost
        cost = sum(
            float(np.linalg.norm(np.array(path[i + 1]) - np.array(path[i])))
            for i in range(len(path) - 1)
        )

        ee_path = []
        for q in path:
            t = self.robot.forward_kinematics_transforms(np.array(q), in_world=in_world)
            ee_path.append(t[-1][:3, 3].tolist())

        return {
            "success": True,
            "algorithm": "RRT-Connect",
            "path": path,
            "ee_path": ee_path,
            "planning_time_s": planning_time,
            "iterations": iteration,
            "sampled_nodes": sampled_nodes,
            "collision_checks": collision_checks,
            "valid_nodes": valid_nodes,
            "rejected_nodes": rejected_nodes,
            "path_cost": cost,
            "message": f"Collision-free path connected with {len(path)} waypoints (cost: {cost:.3f})."
        }
