import numpy as np
from typing import Tuple, Optional


def dist_point_to_segment(p: np.ndarray, a: np.ndarray, b: np.ndarray) -> Tuple[float, np.ndarray]:
    """
    Computes minimum distance from point p to line segment [a, b]
    and returns (distance, closest_point_on_segment).
    """
    ab = b - a
    ab_len_sq = np.dot(ab, ab)
    if ab_len_sq < 1e-12:
        return float(np.linalg.norm(p - a)), a

    t = np.clip(np.dot(p - a, ab) / ab_len_sq, 0.0, 1.0)
    closest = a + t * ab
    dist = float(np.linalg.norm(p - closest))
    return dist, closest


def dist_segment_to_segment(
    p1: np.ndarray, p2: np.ndarray,
    q1: np.ndarray, q2: np.ndarray
) -> Tuple[float, np.ndarray, np.ndarray]:
    """
    Computes minimum distance between 3D line segments [p1, p2] and [q1, q2].
    Returns (min_distance, closest_pt_on_p, closest_pt_on_q).
    """
    u = p2 - p1
    v = q2 - q1
    w = p1 - q1

    a = np.dot(u, u)
    b = np.dot(u, v)
    c = np.dot(v, v)
    d = np.dot(u, w)
    e = np.dot(v, w)
    D = a * c - b * b

    sN, sD = D, D
    tN, tD = D, D

    # Almost parallel
    if D < 1e-8:
        sN = 0.0
        sD = 1.0
        tN = e
        tD = c
    else:
        sN = b * e - c * d
        tN = a * e - b * d
        if sN < 0.0:
            sN = 0.0
            tN = e
            tD = c
        elif sN > sD:
            sN = sD
            tN = e + b
            tD = c

    if tN < 0.0:
        tN = 0.0
        if -d < 0.0:
            sN = 0.0
        elif -d > a:
            sN = sD
        else:
            sN = -d
            sD = a
    elif tN > tD:
        tN = tD
        if (-d + b) < 0.0:
            sN = 0.0
        elif (-d + b) > a:
            sN = sD
        else:
            sN = (-d + b)
            sD = a

    sc = 0.0 if abs(sN) < 1e-8 else sN / sD
    tc = 0.0 if abs(tN) < 1e-8 else tN / tD

    closest_p = p1 + sc * u
    closest_q = q1 + tc * v
    dist = float(np.linalg.norm(closest_p - closest_q))
    return dist, closest_p, closest_q


def capsule_intersects_sphere(
    seg_a: np.ndarray, seg_b: np.ndarray, cap_radius: float,
    sphere_center: np.ndarray, sphere_radius: float
) -> Tuple[bool, float]:
    """
    Checks if a capsule intersects a sphere.
    Returns (intersects, distance_between_surfaces).
    """
    center_dist, _ = dist_point_to_segment(sphere_center, seg_a, seg_b)
    clearance = center_dist - (cap_radius + sphere_radius)
    return clearance < 0.0, clearance


def capsule_intersects_box(
    seg_a: np.ndarray, seg_b: np.ndarray, cap_radius: float,
    box_center: np.ndarray, box_size: np.ndarray, box_rot: np.ndarray
) -> Tuple[bool, float]:
    """
    Checks if a capsule intersects an Oriented Bounding Box (OBB).
    box_size is [dx, dy, dz], box_rot is 3x3 rotation matrix.
    """
    # Transform capsule endpoints into box local coordinate frame
    a_local = box_rot.T @ (seg_a - box_center)
    b_local = box_rot.T @ (seg_b - box_center)

    half_size = box_size / 2.0

    # Sample points along the segment to find minimum distance to box
    # Number of samples proportional to segment length
    seg_len = np.linalg.norm(b_local - a_local)
    num_samples = max(8, int(np.ceil(seg_len / 0.03)))
    ts = np.linspace(0.0, 1.0, num_samples)

    min_clearance = float("inf")

    for t in ts:
        pt = a_local + t * (b_local - a_local)
        # Clamped point on box surface / interior
        clamped = np.clip(pt, -half_size, half_size)
        dist = np.linalg.norm(pt - clamped)
        # If point is inside box, dist is 0
        clearance = dist - cap_radius
        if clearance < min_clearance:
            min_clearance = clearance
            if clearance < 0.0:
                return True, clearance

    return min_clearance < 0.0, min_clearance


def capsule_intersects_cylinder(
    seg_a: np.ndarray, seg_b: np.ndarray, cap_radius: float,
    cyl_pos: np.ndarray, cyl_radius: float, cyl_height: float, cyl_rot: np.ndarray
) -> Tuple[bool, float]:
    """
    Checks if capsule intersects cylinder.
    Cylinder axis is along local Y axis: [-cyl_height/2, cyl_height/2].
    """
    cyl_axis_local = np.array([0.0, 1.0, 0.0])
    cyl_axis_world = cyl_rot @ cyl_axis_local

    cyl_top = cyl_pos + 0.5 * cyl_height * cyl_axis_world
    cyl_bot = cyl_pos - 0.5 * cyl_height * cyl_axis_world

    axis_dist, _, _ = dist_segment_to_segment(seg_a, seg_b, cyl_bot, cyl_top)
    clearance = axis_dist - (cap_radius + cyl_radius)
    return clearance < 0.0, clearance
