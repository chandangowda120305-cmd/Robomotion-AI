import pytest
import numpy as np
from app.kinematics.dh_model import RobotModel
from app.collision.geometry import (
    dist_point_to_segment,
    dist_segment_to_segment,
    capsule_intersects_sphere,
    capsule_intersects_box
)
from app.collision.checker import CollisionChecker
from app.schemas.models import Obstacle


def test_distance_point_to_segment():
    a = np.array([0.0, 0.0, 0.0])
    b = np.array([1.0, 0.0, 0.0])
    p = np.array([0.5, 1.0, 0.0])

    dist, closest = dist_point_to_segment(p, a, b)
    assert pytest.approx(dist, abs=1e-5) == 1.0
    assert np.allclose(closest, [0.5, 0.0, 0.0])


def test_capsule_sphere_intersection():
    seg_a = np.array([0.0, 0.0, 0.0])
    seg_b = np.array([1.0, 0.0, 0.0])
    cap_radius = 0.05

    # Case 1: Intersecting sphere
    sphere_center = np.array([0.5, 0.08, 0.0])
    sphere_radius = 0.05
    collides, clearance = capsule_intersects_sphere(seg_a, seg_b, cap_radius, sphere_center, sphere_radius)
    assert collides is True
    assert clearance < 0.0

    # Case 2: Distant sphere
    distant_center = np.array([0.5, 0.5, 0.0])
    collides2, clearance2 = capsule_intersects_sphere(seg_a, seg_b, cap_radius, distant_center, sphere_radius)
    assert collides2 is False
    assert clearance2 > 0.0


def test_robot_obstacle_collision_detection():
    robot = RobotModel()
    checker = CollisionChecker(robot)

    # In zero configuration, arm is vertical between Y=0.2 and Y=1.4 at X=0, Z=0
    q_zero = np.zeros(6)

    # Place an obstacle directly across the upper arm (Y=0.55)
    colliding_box = Obstacle(
        id="box1",
        name="Interfering Box",
        type="box",
        position=[0.0, 0.55, 0.0],
        rotation=[0.0, 0.0, 0.0],
        size=[0.2, 0.2, 0.2]
    )

    res = checker.check_collision(q_zero, [colliding_box])
    assert res["in_collision"] is True
    assert res["colliding_obstacle_id"] == "box1"

    # Distant box
    safe_box = Obstacle(
        id="box2",
        name="Safe Box",
        type="box",
        position=[2.0, 0.5, 2.0],
        rotation=[0.0, 0.0, 0.0],
        size=[0.2, 0.2, 0.2]
    )
    res_safe = checker.check_collision(q_zero, [safe_box])
    assert res_safe["in_collision"] is False
