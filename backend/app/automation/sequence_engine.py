import numpy as np
from typing import List, Dict, Any, Optional
from app.kinematics.dh_model import RobotModel
from app.kinematics.inverse_kinematics import InverseKinematicsSolver
from app.collision.checker import CollisionChecker
from app.planning.rrt_star import RRTStarPlanner
from app.planning.trajectory_optimizer import TrajectoryOptimizer
from app.trajectories.generator import TrajectoryGenerator
from app.schemas.models import AutomationSequence, AutomationStep, Obstacle


class AutomationEngine:
    """
    Execution engine and validator for industrial automation sequences.
    """

    def __init__(
        self,
        robot_model: Optional[RobotModel] = None,
        ik_solver: Optional[InverseKinematicsSolver] = None,
        planner: Optional[RRTStarPlanner] = None,
        optimizer: Optional[TrajectoryOptimizer] = None,
        traj_gen: Optional[TrajectoryGenerator] = None,
        collision_checker: Optional[CollisionChecker] = None
    ):
        self.robot = robot_model or RobotModel()
        self.ik = ik_solver or InverseKinematicsSolver(self.robot)
        self.checker = collision_checker or CollisionChecker(self.robot)
        self.planner = planner or RRTStarPlanner(self.robot, self.checker)
        self.optimizer = optimizer or TrajectoryOptimizer(self.robot, self.checker)
        self.traj_gen = traj_gen or TrajectoryGenerator(self.robot)

    def validate_and_compile(
        self,
        sequence: AutomationSequence,
        initial_q: List[float],
        obstacles: List[Obstacle]
    ) -> Dict[str, Any]:
        """
        Validates the sequence step-by-step and compiles executable motion blocks.
        """
        q_current = np.array(initial_q, dtype=float)
        compiled_steps = []

        for idx, step in enumerate(sequence.steps):
            step_res = {
                "step_index": idx,
                "step_id": step.id,
                "step_type": step.type,
                "name": step.name,
                "valid": True,
                "error": None,
                "data": {}
            }

            if step.type == "move_joints":
                target_q = np.array(step.params.get("angles", q_current.tolist()), dtype=float)
                if not self.robot.is_within_limits(target_q):
                    step_res["valid"] = False
                    step_res["error"] = "Target joint angles violate limits."
                else:
                    plan = self.planner.plan(q_current, target_q, obstacles)
                    if not plan["success"]:
                        step_res["valid"] = False
                        step_res["error"] = f"Motion planning failed: {plan['message']}"
                    else:
                        opt_path = self.optimizer.optimize_path(plan["path"], obstacles)
                        traj = self.traj_gen.generate(opt_path)
                        step_res["data"]["trajectory"] = traj
                        q_current = target_q

            elif step.type == "move_pose":
                pos = step.params.get("position", [0.4, 0.4, 0.0])
                orient = step.params.get("orientation", None)
                ik_res = self.ik.solve(pos, target_rot_mat=None, initial_q=q_current, position_only=True)
                if not ik_res["success"]:
                    step_res["valid"] = False
                    step_res["error"] = f"IK failed to find solution: {ik_res['message']}"
                else:
                    target_q = np.array(ik_res["angles"])
                    plan = self.planner.plan(q_current, target_q, obstacles)
                    if not plan["success"]:
                        step_res["valid"] = False
                        step_res["error"] = f"Motion planning to pose failed: {plan['message']}"
                    else:
                        opt_path = self.optimizer.optimize_path(plan["path"], obstacles)
                        traj = self.traj_gen.generate(opt_path)
                        step_res["data"]["trajectory"] = traj
                        q_current = target_q

            elif step.type == "home":
                target_q = np.array([0.0, 0.3, -0.6, 0.3, 0.0, 0.0])
                plan = self.planner.plan(q_current, target_q, obstacles)
                if not plan["success"]:
                    step_res["valid"] = False
                    step_res["error"] = f"Motion planning to home failed: {plan['message']}"
                else:
                    opt_path = self.optimizer.optimize_path(plan["path"], obstacles)
                    traj = self.traj_gen.generate(opt_path)
                    step_res["data"]["trajectory"] = traj
                    q_current = target_q

            elif step.type == "open_gripper":
                step_res["data"]["gripper_action"] = "open"
                step_res["data"]["duration"] = step.params.get("duration", 0.5)

            elif step.type == "close_gripper":
                step_res["data"]["gripper_action"] = "close"
                step_res["data"]["duration"] = step.params.get("duration", 0.5)

            elif step.type == "wait":
                step_res["data"]["duration"] = step.params.get("duration", 1.0)

            elif step.type == "stop_on_error":
                step_res["data"]["stop_on_error"] = True

            compiled_steps.append(step_res)

            if not step_res["valid"]:
                return {
                    "valid": False,
                    "failing_step_index": idx,
                    "failing_step_id": step.id,
                    "error_message": f"Validation failed at Step {idx + 1} ({step.name}): {step_res['error']}",
                    "compiled_steps": compiled_steps
                }

        return {
            "valid": True,
            "failing_step_index": None,
            "failing_step_id": None,
            "error_message": None,
            "compiled_steps": compiled_steps
        }
