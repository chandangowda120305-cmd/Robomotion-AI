from fastapi import APIRouter, HTTPException
import numpy as np
from app.schemas.models import FKRequest, FKResponse, IKRequest, IKResponse, Pose, LinkFrame
from app.kinematics.dh_model import RobotModel
from app.kinematics.inverse_kinematics import InverseKinematicsSolver

router = APIRouter(prefix="/robot", tags=["Robot Kinematics"])
robot = RobotModel()
ik_solver = InverseKinematicsSolver(robot)


@router.get("/config")
def get_robot_config():
    return {
        "joint_names": robot.joint_names,
        "joint_limits_min": robot.joint_limits_min.tolist(),
        "joint_limits_max": robot.joint_limits_max.tolist(),
        "link_dimensions": {
            "base_height": robot.base_height,
            "link1_height": robot.link1_height,
            "link2_len": robot.link2_len,
            "link3_len": robot.link3_len,
            "link4_len": robot.link4_len,
            "link5_len": robot.link5_len,
            "tool_len": robot.tool_len
        },
        "link_radii": robot.link_radii
    }


@router.post("/fk", response_model=FKResponse)
def compute_forward_kinematics(req: FKRequest):
    if len(req.angles) != 6:
        raise HTTPException(status_code=400, detail="Must provide exactly 6 joint angles.")

    arm_robot = robot
    if req.arm_base_pos is not None or req.arm_base_yaw != 0.0:
        arm_robot = RobotModel(
            base_position=req.arm_base_pos or [0.0, 0.0, 0.0],
            base_yaw=req.arm_base_yaw
        )

    fk_res = arm_robot.forward_kinematics(np.array(req.angles, dtype=float))

    ee_pose = Pose(
        position=fk_res["position"],
        orientation=fk_res["orientation"],
        quaternion=fk_res["quaternion"],
        matrix=fk_res["matrix"]
    )

    link_frames = [
        LinkFrame(
            joint_index=lf["joint_index"],
            name=lf["name"],
            position=lf["position"],
            orientation=lf["orientation"],
            matrix=lf["matrix"]
        ) for lf in fk_res["link_frames"]
    ]

    return FKResponse(
        angles=req.angles,
        angles_deg=np.degrees(req.angles).tolist(),
        end_effector_pose=ee_pose,
        link_frames=link_frames,
        transformation_matrix=fk_res["matrix"]
    )


@router.post("/ik", response_model=IKResponse)
def compute_inverse_kinematics(req: IKRequest):
    target_pos = np.array(req.target_position, dtype=float)

    arm_robot = robot
    solver = ik_solver
    if req.arm_base_pos is not None or req.arm_base_yaw != 0.0:
        arm_robot = RobotModel(
            base_position=req.arm_base_pos or [0.0, 0.0, 0.0],
            base_yaw=req.arm_base_yaw
        )
        solver = InverseKinematicsSolver(arm_robot)

    target_rot_mat = None
    if req.target_matrix:
        target_rot_mat = np.array(req.target_matrix, dtype=float)[:3, :3]
    elif req.target_orientation:
        target_rot_mat = RobotModel.euler_xyz_to_matrix(*req.target_orientation)

    ik_res = solver.solve(
        target_pos=target_pos,
        target_rot_mat=target_rot_mat,
        initial_q=np.array(req.initial_guess, dtype=float) if req.initial_guess else None,
        tolerance_pos=req.tolerance_pos,
        tolerance_rot=req.tolerance_rot,
        max_iterations=req.max_iterations,
        damping=req.damping,
        position_only=req.position_only,
        in_world=req.in_world
    )

    # Compute final EE pose for verification
    fk_res = arm_robot.forward_kinematics(np.array(ik_res["angles"]))
    ee_pose = Pose(
        position=fk_res["position"],
        orientation=fk_res["orientation"],
        quaternion=fk_res["quaternion"],
        matrix=fk_res["matrix"]
    )

    return IKResponse(
        success=ik_res["success"],
        angles=ik_res["angles"],
        angles_deg=ik_res["angles_deg"],
        iterations=ik_res["iterations"],
        final_error_pos=ik_res["final_error_pos"],
        final_error_rot=ik_res["final_error_rot"],
        end_effector_pose=ee_pose,
        message=ik_res["message"]
    )


@router.get("/workspace")
def get_reachable_workspace(samples: int = 1200):
    """
    Generates a point cloud sampling the reachable 3D workspace.
    """
    points = []
    # Monte Carlo sampling across joint limit boundaries and interiors
    for _ in range(samples):
        q = np.random.uniform(robot.joint_limits_min, robot.joint_limits_max)
        transforms = robot.forward_kinematics_transforms(q)
        pos = transforms[-1][:3, 3]
        if pos[1] >= 0.0:  # Above table
            points.append(pos.tolist())

    return {
        "num_points": len(points),
        "points": points
    }
