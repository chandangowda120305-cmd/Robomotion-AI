import numpy as np
from typing import List, Dict, Any, Optional
from app.kinematics.dh_model import RobotModel


class JointPIDController:
    """
    Joint-level closed-loop PID trajectory tracking controller simulation.
    Models actuator dynamics, joint inertia, damping, and payload effects.
    """

    def __init__(
        self,
        robot_model: Optional[RobotModel] = None,
        kp: Optional[List[float]] = None,
        ki: Optional[List[float]] = None,
        kd: Optional[List[float]] = None
    ):
        self.robot = robot_model or RobotModel()
        # Default PID gains tuned for industrial cobot joints
        self.kp = np.array(kp if kp is not None else [24.0, 26.0, 22.0, 20.0, 18.0, 16.0], dtype=float)
        self.ki = np.array(ki if ki is not None else [1.5, 1.8, 1.2, 1.0, 0.8, 0.6], dtype=float)
        self.kd = np.array(kd if kd is not None else [4.2, 4.5, 3.8, 3.2, 2.8, 2.2], dtype=float)

        # Joint effective inertia (kg*m^2)
        self.inertia = np.array([0.45, 0.65, 0.40, 0.15, 0.08, 0.04], dtype=float)
        # Viscous joint damping coefficient
        self.damping = np.array([1.2, 1.5, 1.0, 0.6, 0.4, 0.2], dtype=float)

    def simulate_tracking(
        self,
        time_points: List[float],
        target_positions: List[List[float]],
        target_velocities: List[List[float]],
        target_accelerations: List[List[float]],
        payload_mass: float = 0.0
    ) -> Dict[str, Any]:
        """
        Simulates closed-loop tracking along the desired trajectory.
        """
        t_arr = np.array(time_points, dtype=float)
        q_d = np.array(target_positions, dtype=float)
        qd_d = np.array(target_velocities, dtype=float)
        qdd_d = np.array(target_accelerations, dtype=float)

        num_steps = len(t_arr)
        dt = t_arr[1] - t_arr[0] if num_steps > 1 else 0.02

        # Actual simulated states
        q_act = np.zeros_like(q_d)
        qd_act = np.zeros_like(qd_d)
        qdd_act = np.zeros_like(qdd_d)
        tracking_errors = np.zeros_like(q_d)
        control_outputs = np.zeros_like(q_d)

        # Initial state begins at target with minor disturbance
        q_act[0] = q_d[0]
        qd_act[0] = qd_d[0]

        integral_error = np.zeros(6, dtype=float)

        effective_inertia = self.inertia + 0.05 * payload_mass

        for k in range(num_steps - 1):
            e = q_d[k] - q_act[k]
            ed = qd_d[k] - qd_act[k]

            integral_error += e * dt
            # Anti-windup clamping
            integral_error = np.clip(integral_error, -2.0, 2.0)

            # PID torque command with feedforward acceleration
            u = (
                self.kp * e +
                self.ki * integral_error +
                self.kd * ed +
                effective_inertia * qdd_d[k]
            )

            # Actuator saturation limits
            max_torque = np.array([120.0, 150.0, 100.0, 50.0, 30.0, 20.0])
            u_saturated = np.clip(u, -max_torque, max_torque)

            # Joint acceleration from dynamics: I * qdd + b * qd = u
            acc = (u_saturated - self.damping * qd_act[k]) / effective_inertia

            # Numerical integration (Semi-implicit Euler)
            qd_next = qd_act[k] + acc * dt
            q_next = q_act[k] + qd_next * dt

            q_act[k + 1] = q_next
            qd_act[k + 1] = qd_next
            qdd_act[k] = acc
            tracking_errors[k] = e
            control_outputs[k] = u_saturated

        # Final step telemetry
        e_final = q_d[-1] - q_act[-1]
        tracking_errors[-1] = e_final
        control_outputs[-1] = control_outputs[-2] if num_steps > 1 else np.zeros(6)
        qdd_act[-1] = qdd_act[-2] if num_steps > 1 else np.zeros(6)

        # Compute actual end-effector positions along trajectory
        ee_actual = []
        for q in q_act:
            transforms = self.robot.forward_kinematics_transforms(q)
            ee_actual.append(transforms[-1][:3, 3].tolist())

        max_err = float(np.max(np.abs(tracking_errors)))
        rms_err = float(np.sqrt(np.mean(tracking_errors ** 2)))

        return {
            "time_points": t_arr.tolist(),
            "target_positions": q_d.tolist(),
            "actual_positions": q_act.tolist(),
            "velocities": qd_act.tolist(),
            "accelerations": qdd_act.tolist(),
            "tracking_errors": tracking_errors.tolist(),
            "control_outputs": control_outputs.tolist(),
            "ee_positions": ee_actual,
            "max_tracking_error": max_err,
            "rms_tracking_error": rms_err
        }
