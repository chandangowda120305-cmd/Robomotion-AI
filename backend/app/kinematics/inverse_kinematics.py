import numpy as np
from typing import Optional, Dict, Any, List
from app.kinematics.dh_model import RobotModel


class InverseKinematicsSolver:
    """
    Robust Numerical Inverse Kinematics solver using Damped Least Squares (DLS)
    with multi-seed posture generation, joint-limit clamping, null-space optimization,
    and optional collision-awareness.
    """

    def __init__(self, robot_model: Optional[RobotModel] = None, collision_checker: Any = None):
        self.robot = robot_model or RobotModel()
        self.checker = collision_checker

    def solve(
        self,
        target_pos: np.ndarray,
        target_rot_mat: Optional[np.ndarray] = None,
        initial_q: Optional[np.ndarray] = None,
        tolerance_pos: float = 0.002,  # 2 mm
        tolerance_rot: float = 0.03,   # ~1.7 deg
        max_iterations: int = 180,
        damping: float = 0.05,
        position_only: bool = False,
        allow_multistart: bool = True,
        obstacles: Optional[List[Any]] = None,
        in_world: bool = False
    ) -> Dict[str, Any]:
        """
        Solves inverse kinematics for target end-effector pose.
        If in_world is True, target_pos is assumed to be in world coordinates and
        is converted into robot local frame before solving.
        """
        target_pos_in = np.asarray(target_pos, dtype=float)
        if in_world:
            target_pos_local = self.robot.world_to_local_pos(target_pos_in)
        else:
            target_pos_local = target_pos_in

        # Maximum theoretical reach check
        max_reach = (
            self.robot.base_height +
            self.robot.link1_height +
            self.robot.link2_len +
            self.robot.link3_len +
            self.robot.link4_len +
            self.robot.link5_len +
            self.robot.tool_len
        )
        dist_from_shoulder = np.linalg.norm(
            target_pos_local - np.array([0.0, self.robot.base_height + self.robot.link1_height, 0.0])
        )
        if dist_from_shoulder > max_reach:
            return {
                "success": False,
                "angles": (initial_q if initial_q is not None else np.zeros(6)).tolist(),
                "angles_deg": np.degrees(initial_q if initial_q is not None else np.zeros(6)).tolist(),
                "iterations": 0,
                "final_error_pos": float(dist_from_shoulder - max_reach),
                "final_error_rot": 0.0,
                "collision_free": False,
                "message": f"Target is out of reachable workspace (distance {dist_from_shoulder:.3f}m > max reach {max_reach:.3f}m)."
            }

        # Multi-seed posture candidate initialization
        starts = []
        if initial_q is not None:
            starts.append(np.asarray(initial_q, dtype=float))

        if allow_multistart:
            # Base rotation facing target:
            # Under rot_y(q0) and rot_z(q1): X_local = -R * cos(q0), Z_local = R * sin(q0)
            # Therefore: q0 = arctan2(Z, -X)
            tx, tz = target_pos_local[0], target_pos_local[2]
            if abs(tx) > 1e-4 or abs(tz) > 1e-4:
                base_angle1 = np.arctan2(tz, -tx)
                base_angle2 = np.arctan2(-tz, tx)
            else:
                base_angle1, base_angle2 = 0.0, np.pi

            # Diverse realistic elbow & shoulder postures
            candidate_postures = [
                (base_angle1, 0.35, -0.75, 0.35),
                (base_angle1, 0.60, -1.05, 0.45),
                (base_angle1, 0.15, -0.45, 0.25),
                (base_angle1, -0.20, -1.60, -1.00),
                (base_angle2, 0.30, -0.60, 0.30),
                (base_angle2, -0.30, 0.60, -0.30),
                (base_angle1 + 0.3, 0.40, -0.80, 0.35),
                (base_angle1 - 0.3, 0.40, -0.80, 0.35)
            ]

            for b_ang, j2, j3, j4 in candidate_postures:
                starts.append(np.array([b_ang, j2, j3, j4, 0.0, 0.0]))

        # Track results: prefer collision-free solutions with minimum error
        collision_free_results = []
        all_converged_results = []
        closest_attempt = None
        best_error = float("inf")

        for q_init in starts:
            result = self._solve_single(
                target_pos_local,
                target_rot_mat,
                q_init,
                tolerance_pos,
                tolerance_rot,
                max_iterations,
                damping,
                position_only
            )

            q_cand = np.array(result["angles"])
            err_pos = result["final_error_pos"]
            err_rot = result["final_error_rot"]
            total_err = err_pos + 0.1 * err_rot

            if total_err < best_error:
                best_error = total_err
                closest_attempt = result

            if result["success"]:
                # Check collision validity
                is_safe = True
                min_clearance = 1.0

                if self.checker is not None:
                    # Link check in world space
                    if in_world:
                        c_res = self.checker.check_collision_with_base(
                            q_cand,
                            self.robot.base_position,
                            self.robot.base_yaw,
                            obstacles or []
                        )
                    else:
                        c_res = self.checker.check_collision(q_cand, obstacles or [])

                    if c_res["in_collision"]:
                        is_safe = False
                    min_clearance = c_res.get("min_distance", 1.0)
                else:
                    # Basic ground clearance check: link points must be above Y >= 0.02
                    segments = self.robot.get_link_segments(q_cand, in_world=in_world)
                    for seg_a, seg_b, radius in segments[1:]:
                        if min(seg_a[1], seg_b[1]) - radius < 0.02:
                            is_safe = False
                            break

                result["collision_free"] = is_safe
                result["min_clearance"] = min_clearance

                if is_safe:
                    collision_free_results.append(result)
                else:
                    all_converged_results.append(result)

        # 1. Return closest collision-free candidate
        if collision_free_results:
            if initial_q is not None:
                # Pick one closest to initial_q to maintain continuity
                q_init_arr = np.asarray(initial_q)
                collision_free_results.sort(
                    key=lambda r: float(np.linalg.norm(np.array(r["angles"]) - q_init_arr))
                )
            else:
                collision_free_results.sort(key=lambda r: r["final_error_pos"])
            return collision_free_results[0]

        # 2. If converged but had minor collision, return candidate with highest clearance
        if all_converged_results:
            all_converged_results.sort(key=lambda r: -r.get("min_clearance", 0))
            best_c = all_converged_results[0]
            best_c["message"] += f" (Note: clearance warning {best_c.get('min_clearance', 0):.3f}m)"
            return best_c

        # 3. Fallback to closest non-converged attempt
        if closest_attempt is not None:
            closest_attempt["collision_free"] = False
            return closest_attempt

        return {
            "success": False,
            "angles": (initial_q if initial_q is not None else np.zeros(6)).tolist(),
            "angles_deg": np.degrees(initial_q if initial_q is not None else np.zeros(6)).tolist(),
            "iterations": max_iterations,
            "final_error_pos": 999.0,
            "final_error_rot": 999.0,
            "collision_free": False,
            "message": "IK failed to find any solution."
        }

    def _solve_single(
        self,
        target_pos: np.ndarray,
        target_rot_mat: Optional[np.ndarray],
        q_init: np.ndarray,
        tolerance_pos: float,
        tolerance_rot: float,
        max_iterations: int,
        damping: float,
        position_only: bool
    ) -> Dict[str, Any]:
        q = np.copy(q_init)
        q = self.robot.clamp_to_limits(q)
        q_rest = 0.5 * (self.robot.joint_limits_min + self.robot.joint_limits_max)

        for iteration in range(max_iterations):
            transforms = self.robot.forward_kinematics_transforms(q, in_world=False)
            current_pos = transforms[-1][:3, 3]
            current_rot_mat = transforms[-1][:3, :3]

            pos_err = target_pos - current_pos
            pos_err_norm = float(np.linalg.norm(pos_err))

            if position_only or target_rot_mat is None:
                err = pos_err
                if pos_err_norm < tolerance_pos:
                    return {
                        "success": True,
                        "angles": q.tolist(),
                        "angles_deg": np.degrees(q).tolist(),
                        "iterations": iteration + 1,
                        "final_error_pos": pos_err_norm,
                        "final_error_rot": 0.0,
                        "message": f"Converged successfully in {iteration + 1} iterations."
                    }
            else:
                rot_err = self._compute_orientation_error(target_rot_mat, current_rot_mat)
                rot_err_norm = float(np.linalg.norm(rot_err))

                if pos_err_norm < tolerance_pos and rot_err_norm < tolerance_rot:
                    return {
                        "success": True,
                        "angles": q.tolist(),
                        "angles_deg": np.degrees(q).tolist(),
                        "iterations": iteration + 1,
                        "final_error_pos": pos_err_norm,
                        "final_error_rot": rot_err_norm,
                        "message": f"Converged successfully in {iteration + 1} iterations."
                    }

                err = np.concatenate([pos_err, rot_err])

            # Jacobian matrix
            J = self.robot.geometric_jacobian(q, in_world=False)
            J_use = J[:3, :] if (position_only or target_rot_mat is None) else J

            # Damped Least Squares
            m = J_use.shape[0]
            lambda_sq = damping ** 2
            JJt = J_use @ J_use.T
            damping_mat = lambda_sq * np.eye(m)
            inv_part = np.linalg.solve(JJt + damping_mat, err)
            dq = J_use.T @ inv_part

            # Null-space posture centering
            null_space_proj = np.eye(6) - J_use.T @ np.linalg.solve(JJt + damping_mat, J_use)
            k_null = 0.04
            dq_null = null_space_proj @ (k_null * (q_rest - q))

            step = dq + dq_null
            step_norm = float(np.linalg.norm(step))
            max_step = 0.25
            if step_norm > max_step:
                step = step * (max_step / step_norm)

            q_next = q + step
            q = self.robot.clamp_to_limits(q_next)

        transforms = self.robot.forward_kinematics_transforms(q, in_world=False)
        final_pos = transforms[-1][:3, 3]
        final_rot_mat = transforms[-1][:3, :3]
        pos_err_norm = float(np.linalg.norm(target_pos - final_pos))
        rot_err_norm = 0.0
        if not position_only and target_rot_mat is not None:
            rot_err_norm = float(np.linalg.norm(self._compute_orientation_error(target_rot_mat, final_rot_mat)))

        return {
            "success": False,
            "angles": q.tolist(),
            "angles_deg": np.degrees(q).tolist(),
            "iterations": max_iterations,
            "final_error_pos": pos_err_norm,
            "final_error_rot": rot_err_norm,
            "message": f"Failed to converge within {max_iterations} iterations. Pos error: {pos_err_norm * 1000:.1f}mm."
        }

    @staticmethod
    def _compute_orientation_error(R_target: np.ndarray, R_current: np.ndarray) -> np.ndarray:
        R_err = R_target @ R_current.T
        tr = np.clip(np.trace(R_err), -1.0, 3.0)
        theta = np.arccos(np.clip((tr - 1.0) / 2.0, -1.0, 1.0))

        if abs(theta) < 1e-4:
            return 0.5 * np.array([
                R_err[2, 1] - R_err[1, 2],
                R_err[0, 2] - R_err[2, 0],
                R_err[1, 0] - R_err[0, 1]
            ])

        axis = (1.0 / (2.0 * np.sin(theta))) * np.array([
            R_err[2, 1] - R_err[1, 2],
            R_err[0, 2] - R_err[2, 0],
            R_err[1, 0] - R_err[0, 1]
        ])
        return theta * axis
