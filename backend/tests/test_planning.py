import pytest
import numpy as np
from app.kinematics.dh_model import RobotModel
from app.collision.checker import CollisionChecker
from app.planning.rrt import RRTPlanner
from app.planning.rrt_star import RRTStarPlanner
from app.planning.trajectory_optimizer import TrajectoryOptimizer
from app.schemas.models import Obstacle


def test_rrt_finds_valid_path():
    robot = RobotModel()
    checker = CollisionChecker(robot)
    planner = RRTPlanner(robot, checker)

    start_q = np.array([0.0, 0.2, -0.4, 0.2, 0.0, 0.0])
    goal_q = np.array([0.5, 0.6, -0.7, 0.3, 0.2, 0.1])

    res = planner.plan(start_q, goal_q, obstacles=[], max_iterations=800, random_seed=42)
    assert res["success"] is True
    assert len(res["path"]) >= 2
    assert res["path_cost"] > 0.0

    # Verify all path points are collision free
    for q in res["path"]:
        assert checker.is_state_valid(np.array(q), obstacles=[])


def test_rrt_star_finds_valid_path_and_optimizes():
    robot = RobotModel()
    checker = CollisionChecker(robot)
    star_planner = RRTStarPlanner(robot, checker)
    optimizer = TrajectoryOptimizer(robot, checker)

    start_q = np.array([0.0, 0.2, -0.4, 0.2, 0.0, 0.0])
    goal_q = np.array([0.5, 0.6, -0.7, 0.3, 0.2, 0.1])

    res = star_planner.plan(start_q, goal_q, obstacles=[], max_iterations=600, random_seed=42)
    assert res["success"] is True

    # Test shortcut optimizer
    opt_path = optimizer.optimize_path(res["path"], obstacles=[])
    assert len(opt_path) >= 2
    for q in opt_path:
        assert checker.is_state_valid(np.array(q), obstacles=[])


def test_rrt_avoids_obstacle():
    robot = RobotModel()
    checker = CollisionChecker(robot)
    planner = RRTPlanner(robot, checker)

    start_q = np.array([-0.6, 0.3, -0.5, 0.2, 0.0, 0.0])
    goal_q = np.array([0.6, 0.3, -0.5, 0.2, 0.0, 0.0])

    # Put an obstacle directly in the center
    obstacle = Obstacle(
        id="mid_obs",
        name="Middle Obstacle",
        type="box",
        position=[0.0, 0.5, 0.4],
        size=[0.25, 0.25, 0.25]
    )

    res = planner.plan(start_q, goal_q, obstacles=[obstacle], max_iterations=1200, random_seed=123)
    if res["success"]:
        # Verify that no point in the planned path collides with the obstacle
        for q in res["path"]:
            assert checker.is_state_valid(np.array(q), obstacles=[obstacle])
