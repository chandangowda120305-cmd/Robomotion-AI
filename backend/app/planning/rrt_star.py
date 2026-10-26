import time
import numpy as np
from typing import List, Optional, Dict, Any
from app.kinematics.dh_model import RobotModel
from app.collision.checker import CollisionChecker
from app.schemas.models import Obstacle


class RRTStarNode:
    def __init__(self, q: np.ndarray, parent: Optional['RRTStarNode'] = None, cost: float = 0.0):
        self.q = q
        self.parent = parent
        self.cost = cost
        self.children: List['RRTStarNode'] = []

    def add_child(self, child: 'RRTStarNode'):
        self.children.append(child)

    def remove_child(self, child: 'RRTStarNode'):
        if child in self.children:
            self.children.remove(child)

    def update_costs(self):
        for child in self.children:
            dist = float(np.linalg.norm(child.q - self.q))
            child.cost = self.cost + dist
            child.update_costs()


class RRTStarPlanner:
    """
    Asymptotically Optimal Rapidly-exploring Random Tree (RRT*) Motion Planner.
    Features neighborhood search, parent rewiring, and stratified configuration sampling.
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
        rewire_radius: float = 0.45,
        max_time_s: float = 5.0,
        random_seed: Optional[int] = None,
        in_world: bool = False
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        if random_seed is not None:
            np.random.seed(random_seed)

        start_q = np.asarray(start_q, dtype=float)
        goal_q = np.asarray(goal_q, dtype=float)

        if not self.checker.is_state_valid(start_q, obstacles, in_world=in_world):
            return {
                "success": False,
                "algorithm": "RRT*",
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
                "algorithm": "RRT*",
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

        root = RRTStarNode(start_q, None, 0.0)
        tree: List[RRTStarNode] = [root]

        collision_checks = 2
        valid_nodes = 1
        rejected_nodes = 0
        sampled_nodes = 0

        best_goal_node: Optional[RRTStarNode] = None

        for iteration in range(1, max_iterations + 1):
            if (time.perf_counter() - start_time) > max_time_s:
                break

            sampled_nodes += 1
            # Stratified sampling
            rnd = np.random.rand()
            if rnd < goal_bias:
                q_rand = np.copy(goal_q)
            elif rnd < goal_bias + 0.25:
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

            # Nearest neighbor
            tree_qs = np.array([node.q for node in tree])
            dists = np.linalg.norm(tree_qs - q_rand, axis=1)
            nearest_idx = int(np.argmin(dists))
            nearest_node = tree[nearest_idx]

            # Steer
            direction = q_rand - nearest_node.q
            dist = float(dists[nearest_idx])
            step = step_size if dist > step_size else dist
            q_new = nearest_node.q + (direction / (dist + 1e-12)) * step

            collision_checks += 1
            if not self.checker.is_path_segment_valid(nearest_node.q, q_new, obstacles, check_step=0.05, in_world=in_world):
                rejected_nodes += 1
                continue

            # Near neighbors
            dists_to_new = np.linalg.norm(tree_qs - q_new, axis=1)
            n_nodes = len(tree)
            gamma_rrt = rewire_radius * (np.log(n_nodes + 1) / (n_nodes + 1)) ** (1.0 / 6.0)
            radius = min(rewire_radius, max(step_size * 1.5, gamma_rrt * 3.0))

            near_indices = np.where(dists_to_new <= radius)[0]

            # Choose best parent among near neighbors
            min_cost = nearest_node.cost + float(np.linalg.norm(q_new - nearest_node.q))
            best_parent = nearest_node

            for idx in near_indices:
                cand_node = tree[idx]
                cand_dist = float(dists_to_new[idx])
                cand_cost = cand_node.cost + cand_dist
                if cand_cost < min_cost:
                    collision_checks += 1
                    if self.checker.is_path_segment_valid(cand_node.q, q_new, obstacles, check_step=0.05, in_world=in_world):
                        min_cost = cand_cost
                        best_parent = cand_node

            new_node = RRTStarNode(q_new, best_parent, min_cost)
            best_parent.add_child(new_node)
            tree.append(new_node)
            valid_nodes += 1

            # Rewire near neighbors
            for idx in near_indices:
                near_node = tree[idx]
                if near_node is best_parent:
                    continue
                cand_dist = float(dists_to_new[idx])
                cand_cost = new_node.cost + cand_dist
                if cand_cost < near_node.cost:
                    collision_checks += 1
                    if self.checker.is_path_segment_valid(new_node.q, near_node.q, obstacles, check_step=0.05, in_world=in_world):
                        if near_node.parent is not None:
                            near_node.parent.remove_child(near_node)
                        near_node.parent = new_node
                        new_node.add_child(near_node)
                        near_node.cost = cand_cost
                        near_node.update_costs()

            # Connect to goal if within range
            goal_dist = float(np.linalg.norm(q_new - goal_q))
            if goal_dist <= max(step_size * 1.5, 0.35):
                cand_goal_cost = new_node.cost + goal_dist
                if best_goal_node is None or cand_goal_cost < best_goal_node.cost:
                    collision_checks += 1
                    if self.checker.is_path_segment_valid(q_new, goal_q, obstacles, check_step=0.05, in_world=in_world):
                        if best_goal_node is None:
                            best_goal_node = RRTStarNode(goal_q, new_node, cand_goal_cost)
                            new_node.add_child(best_goal_node)
                        else:
                            if best_goal_node.parent is not None:
                                best_goal_node.parent.remove_child(best_goal_node)
                            best_goal_node.parent = new_node
                            new_node.add_child(best_goal_node)
                            best_goal_node.cost = cand_goal_cost
                            best_goal_node.update_costs()

        planning_time = time.perf_counter() - start_time

        if best_goal_node is None:
            return {
                "success": False,
                "algorithm": "RRT*",
                "path": [],
                "ee_path": [],
                "planning_time_s": planning_time,
                "iterations": iteration,
                "sampled_nodes": sampled_nodes,
                "collision_checks": collision_checks,
                "valid_nodes": valid_nodes,
                "rejected_nodes": rejected_nodes,
                "path_cost": 0.0,
                "message": f"RRT* finished {max_iterations} iterations without connecting to goal."
            }

        path_nodes = []
        curr = best_goal_node
        while curr is not None:
            path_nodes.append(curr.q.tolist())
            curr = curr.parent
        path_nodes.reverse()

        ee_path = []
        for q in path_nodes:
            t = self.robot.forward_kinematics_transforms(np.array(q), in_world=in_world)
            ee_path.append(t[-1][:3, 3].tolist())

        return {
            "success": True,
            "algorithm": "RRT*",
            "path": path_nodes,
            "ee_path": ee_path,
            "planning_time_s": planning_time,
            "iterations": iteration,
            "sampled_nodes": sampled_nodes,
            "collision_checks": collision_checks,
            "valid_nodes": valid_nodes,
            "rejected_nodes": rejected_nodes,
            "path_cost": float(best_goal_node.cost),
            "message": f"Optimal collision-free path found with {len(path_nodes)} waypoints (cost: {best_goal_node.cost:.3f})."
        }
