import pytest
import numpy as np
from app.kinematics.dh_model import RobotModel
from app.kinematics.inverse_kinematics import InverseKinematicsSolver


def test_robot_model_fk_zero_configuration():
    robot = RobotModel()
    q_zero = np.zeros(6)
    fk = robot.forward_kinematics(q_zero)

    # In zero configuration, the arm stands upright along Y axis
    expected_height = (
        robot.base_height +
        robot.link1_height +
        robot.link2_len +
        robot.link3_len +
        robot.link4_len +
        robot.link5_len +
        robot.tool_len
    )
    pos = fk["position"]
    assert pytest.approx(pos[0], abs=1e-3) == 0.0
    assert pytest.approx(pos[1], abs=1e-3) == expected_height
    assert pytest.approx(pos[2], abs=1e-3) == 0.0
    assert len(fk["link_frames"]) == 8


def test_robot_transforms_consistency():
    robot = RobotModel()
    q = np.array([np.pi / 4, -np.pi / 6, np.pi / 3, -np.pi / 4, 0.2, -0.5])
    transforms = robot.forward_kinematics_transforms(q)
    assert len(transforms) == 8

    # Each transform must be a valid 4x4 matrix with bottom row [0, 0, 0, 1]
    for T in transforms:
        assert T.shape == (4, 4)
        assert np.allclose(T[3, :], [0.0, 0.0, 0.0, 1.0])
        # Rotation submatrix must be orthogonal
        R = T[:3, :3]
        assert np.allclose(R.T @ R, np.eye(3), atol=1e-5)


def test_jacobian_shape_and_values():
    robot = RobotModel()
    q = np.array([0.1, 0.2, -0.3, 0.4, -0.2, 0.1])
    J = robot.geometric_jacobian(q)
    assert J.shape == (6, 6)
    # Check that Jacobian is not all zeros
    assert not np.allclose(J, np.zeros((6, 6)))


def test_inverse_kinematics_convergence():
    robot = RobotModel()
    ik_solver = InverseKinematicsSolver(robot)

    # Pick a known reachable pose by running FK on a valid q
    q_target = np.array([0.3, 0.4, -0.6, 0.2, -0.1, 0.5])
    fk_target = robot.forward_kinematics(q_target)
    target_pos = np.array(fk_target["position"])

    res = ik_solver.solve(
        target_pos=target_pos,
        initial_q=np.zeros(6),
        tolerance_pos=0.002,
        max_iterations=150,
        position_only=True
    )

    assert res["success"] is True
    assert res["final_error_pos"] < 0.002
    assert robot.is_within_limits(np.array(res["angles"]))


def test_unreachable_target_detection():
    robot = RobotModel()
    ik_solver = InverseKinematicsSolver(robot)

    # 10 meters away is well beyond robot reach
    unreachable_pos = np.array([10.0, 5.0, 2.0])
    res = ik_solver.solve(unreachable_pos, position_only=True)
    assert res["success"] is False
    assert "out of reachable workspace" in res["message"]
