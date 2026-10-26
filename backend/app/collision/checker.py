import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from app.kinematics.dh_model import RobotModel
from app.collision.geometry import (
    capsule_intersects_sphere,
    capsule_intersects_box,
    capsule_intersects_cylinder,
    dist_segment_to_segment
)
from app.schemas.models import Obstacle


class CollisionChecker:
    """
    Evaluates collision conditions between 6-DOF robotic arm links and:
    - Ground plane (table surface)
    - Static and dynamic obstacles (Boxes, Spheres, Cylinders)
    - Carried payload / tool objects
    - Robot self-collision (non-adjacent links)
    - Inter-arm collision between multiple arms in a collaborative workcell
    """

    def __init__(self, robot_model: Optional[RobotModel] = None):
        self.robot = robot_model or RobotModel()

    def check_collision(
        self,
        q: np.ndarray,
        obstacles: List[Obstacle],
        current_time: float = 0.0,
        check_self: bool = True,
        in_world: bool = False
    ) -> Dict[str, Any]:
        """
        Complete collision evaluation for a single arm configuration.
        """
        q = np.asarray(q, dtype=float)

        # 1. Joint limit validation
        if not self.robot.is_within_limits(q):
            return {
                "in_collision": True,
                "colliding_link_index": None,
                "colliding_link_name": "Joint Limits Exceeded",
                "colliding_obstacle_id": None,
                "min_distance": 0.0,
                "details": "Joint configuration violates physical joint angle limits."
            }

        # 2. Extract link segments: (start_pt, end_pt, radius)
        segments = self.robot.get_link_segments(q, in_world=in_world)
        min_overall_dist = float("inf")

        # 3. Ground plane check (links cannot penetrate below table surface Y = 0.02m)
        for i, (seg_a, seg_b, radius) in enumerate(segments):
            min_y = min(seg_a[1], seg_b[1]) - radius
            if min_y < 0.02:
                if i > 0:  # Allow base pedestal mount
                    return {
                        "in_collision": True,
                        "colliding_link_index": i,
                        "colliding_link_name": self._link_name(i),
                        "colliding_obstacle_id": "ground_plane",
                        "min_distance": min_y,
                        "details": f"Link '{self._link_name(i)}' penetrates floor surface (Y = {min_y:.3f}m)."
                    }

        # 4. Robot self-collision check (non-adjacent links)
        if check_self:
            num_links = len(segments)
            for i in range(num_links):
                for j in range(i + 2, num_links):
                    a1, b1, r1 = segments[i]
                    a2, b2, r2 = segments[j]
                    dist, _, _ = dist_segment_to_segment(a1, b1, a2, b2)
                    clearance = dist - (r1 + r2)
                    if clearance < min_overall_dist:
                        min_overall_dist = clearance
                    if clearance < 0.005:  # 5mm safety buffer
                        return {
                            "in_collision": True,
                            "colliding_link_index": i,
                            "colliding_link_name": f"{self._link_name(i)} and {self._link_name(j)}",
                            "colliding_obstacle_id": "self_collision",
                            "min_distance": clearance,
                            "details": f"Self-collision between {self._link_name(i)} and {self._link_name(j)}."
                        }

        # 5. Check against each obstacle
        for obs in obstacles:
            obs_pos = np.array(obs.position, dtype=float)
            if obs.is_moving and obs.velocity:
                obs_pos = obs_pos + np.array(obs.velocity, dtype=float) * current_time

            obs_rot_mat = RobotModel.euler_xyz_to_matrix(*obs.rotation)

            for i, (seg_a, seg_b, radius) in enumerate(segments):
                collided = False
                clearance = float("inf")

                if obs.type == "sphere":
                    sphere_rad = obs.size[0] if obs.size else 0.1
                    collided, clearance = capsule_intersects_sphere(
                        seg_a, seg_b, radius, obs_pos, sphere_rad
                    )
                elif obs.type == "box":
                    box_size = np.array(obs.size if obs.size else [0.2, 0.2, 0.2], dtype=float)
                    collided, clearance = capsule_intersects_box(
                        seg_a, seg_b, radius, obs_pos, box_size, obs_rot_mat
                    )
                elif obs.type == "cylinder":
                    cyl_rad = obs.size[0] if obs.size else 0.1
                    cyl_height = obs.size[1] if len(obs.size) > 1 else 0.3
                    collided, clearance = capsule_intersects_cylinder(
                        seg_a, seg_b, radius, obs_pos, cyl_rad, cyl_height, obs_rot_mat
                    )

                if clearance < min_overall_dist:
                    min_overall_dist = clearance

                if collided:
                    return {
                        "in_collision": True,
                        "colliding_link_index": i,
                        "colliding_link_name": self._link_name(i),
                        "colliding_obstacle_id": obs.id,
                        "min_distance": clearance,
                        "details": f"Collision between {self._link_name(i)} and obstacle '{obs.name}' (id: {obs.id})."
                    }

        return {
            "in_collision": False,
            "colliding_link_index": None,
            "colliding_link_name": None,
            "colliding_obstacle_id": None,
            "min_distance": min_overall_dist if min_overall_dist != float("inf") else 1.0,
            "details": "Configuration is collision-free."
        }

    def check_collision_with_base(
        self,
        q: np.ndarray,
        base_position: np.ndarray,
        base_yaw: float,
        obstacles: List[Obstacle],
        current_time: float = 0.0
    ) -> Dict[str, Any]:
        """Checks collision for an arm situated at arbitrary base coordinates in world frame."""
        temp_robot = RobotModel(base_position=base_position.tolist(), base_yaw=base_yaw)
        temp_checker = CollisionChecker(temp_robot)
        return temp_checker.check_collision(q, obstacles, current_time=current_time, in_world=True)

    def check_inter_arm_collision(
        self,
        arm1_q: np.ndarray,
        arm1_base: np.ndarray,
        arm2_q: np.ndarray,
        arm2_base: np.ndarray,
        arm1_yaw: float = 0.0,
        arm2_yaw: float = 0.0
    ) -> Dict[str, Any]:
        """
        Calculates minimum distance between two robotic arms in the shared workcell.
        Detects inter-arm collisions and deadlock interference.
        """
        r1 = RobotModel(base_position=arm1_base.tolist(), base_yaw=arm1_yaw)
        r2 = RobotModel(base_position=arm2_base.tolist(), base_yaw=arm2_yaw)

        segs1 = r1.get_link_segments(arm1_q, in_world=True)
        segs2 = r2.get_link_segments(arm2_q, in_world=True)

        min_clearance = float("inf")

        for i, (a1, b1, r_rad1) in enumerate(segs1):
            for j, (a2, b2, r_rad2) in enumerate(segs2):
                dist, _, _ = dist_segment_to_segment(a1, b1, a2, b2)
                clearance = dist - (r_rad1 + r_rad2)
                if clearance < min_clearance:
                    min_clearance = clearance
                if clearance < 0.02:  # 2cm interlock threshold
                    return {
                        "in_collision": True,
                        "min_distance": clearance,
                        "details": f"Inter-arm collision between Arm 1 Link {i} and Arm 2 Link {j} (clearance: {clearance*1000:.1f}mm)."
                    }

        return {
            "in_collision": False,
            "min_distance": min_clearance,
            "details": f"Inter-arm clearance safe ({min_clearance:.3f}m)."
        }

    def is_state_valid(
        self,
        q: np.ndarray,
        obstacles: List[Obstacle],
        current_time: float = 0.0,
        check_self: bool = True,
        in_world: bool = False
    ) -> bool:
        res = self.check_collision(q, obstacles, current_time, check_self, in_world=in_world)
        return not res["in_collision"]

    def is_path_segment_valid(
        self,
        q_start: np.ndarray,
        q_end: np.ndarray,
        obstacles: List[Obstacle],
        check_step: float = 0.08,
        in_world: bool = False
    ) -> bool:
        dist = np.linalg.norm(q_end - q_start)
        if dist < 1e-6:
            return self.is_state_valid(q_start, obstacles, in_world=in_world)

        steps = max(2, int(np.ceil(dist / check_step)))
        for alpha in np.linspace(0.0, 1.0, steps):
            q_interp = (1.0 - alpha) * q_start + alpha * q_end
            if not self.is_state_valid(q_interp, obstacles, in_world=in_world):
                return False
        return True

    @staticmethod
    def _link_name(index: int) -> str:
        names = ["Base Link", "Shoulder Link", "Upper Arm", "Forearm", "Wrist Pitch", "Wrist Yaw", "End Effector Tool"]
        return names[index] if 0 <= index < len(names) else f"Link {index}"
