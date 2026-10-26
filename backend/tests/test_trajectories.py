import pytest
import numpy as np
from app.trajectories.generator import TrajectoryGenerator
from app.controllers.pid import JointPIDController


def test_trajectory_generator_smoothness():
    traj_gen = TrajectoryGenerator()
    path = [
        [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [0.2, 0.3, -0.2, 0.1, 0.0, 0.0],
        [0.5, 0.6, -0.5, 0.3, 0.2, 0.1]
    ]

    res = traj_gen.generate(path, method="cubic_spline", dt=0.02)
    assert res["success"] is True
    assert res["total_duration"] > 0.0
    assert len(res["time_points"]) == len(res["positions"])
    assert res["max_velocity"] <= 5.0
    assert res["max_acceleration"] <= 15.0

    # Boundary velocities should be zero (or near zero)
    v_start = np.array(res["velocities"][0])
    v_end = np.array(res["velocities"][-1])
    assert np.allclose(v_start, np.zeros(6), atol=1e-2)
    assert np.allclose(v_end, np.zeros(6), atol=1e-2)


def test_pid_controller_tracking():
    traj_gen = TrajectoryGenerator()
    path = [
        [0.0, 0.2, -0.2, 0.0, 0.0, 0.0],
        [0.3, 0.4, -0.4, 0.2, 0.1, 0.0]
    ]
    traj = traj_gen.generate(path, method="cubic_spline", dt=0.02)

    controller = JointPIDController()
    sim_res = controller.simulate_tracking(
        time_points=traj["time_points"],
        target_positions=traj["positions"],
        target_velocities=traj["velocities"],
        target_accelerations=traj["accelerations"],
        payload_mass=0.5
    )

    assert "tracking_errors" in sim_res
    assert "control_outputs" in sim_res
    assert sim_res["rms_tracking_error"] < 0.1  # Less than 0.1 rad RMS error
    assert sim_res["max_tracking_error"] < 0.25
