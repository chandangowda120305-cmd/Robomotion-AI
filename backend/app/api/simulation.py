from fastapi import APIRouter, HTTPException
import numpy as np
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.schemas.models import (
    TrajectoryRequest, TrajectoryResponse,
    TelemetryRequest, TelemetryResponse
)
from app.trajectories.generator import TrajectoryGenerator
from app.controllers.pid import JointPIDController
from app.database.models import insert_simulation_run

router = APIRouter(prefix="/simulation", tags=["Simulation & Control"])
traj_gen = TrajectoryGenerator()


class SaveRunRequest(BaseModel):
    name: Optional[str] = None
    algorithm: str
    success: bool
    planning_time_ms: float
    execution_time_s: float
    path_length: float
    sampled_nodes: int
    collision_checks: int
    max_velocity: float = 0.0
    max_acceleration: float = 0.0
    rms_tracking_error: float = 0.0
    details: Optional[Dict[str, Any]] = None


@router.post("/trajectory", response_model=TrajectoryResponse)
def generate_trajectory(req: TrajectoryRequest):
    if len(req.path) < 2:
        raise HTTPException(status_code=400, detail="Path must contain at least 2 waypoints.")

    res = traj_gen.generate(
        path=req.path,
        method=req.method,
        speed_factor=req.speed_factor,
        dt=req.dt
    )

    return TrajectoryResponse(
        success=res["success"],
        total_duration=res["total_duration"],
        time_points=res["time_points"],
        positions=res["positions"],
        velocities=res["velocities"],
        accelerations=res["accelerations"],
        ee_positions=res["ee_positions"],
        max_velocity=res["max_velocity"],
        max_acceleration=res["max_acceleration"]
    )


@router.post("/telemetry", response_model=TelemetryResponse)
def simulate_control_telemetry(req: TelemetryRequest):
    controller = JointPIDController(
        kp=req.kp,
        ki=req.ki,
        kd=req.kd
    )

    res = controller.simulate_tracking(
        time_points=req.trajectory.time_points,
        target_positions=req.trajectory.positions,
        target_velocities=req.trajectory.velocities,
        target_accelerations=req.trajectory.accelerations,
        payload_mass=req.load_mass
    )

    return TelemetryResponse(
        time_points=res["time_points"],
        target_positions=res["target_positions"],
        actual_positions=res["actual_positions"],
        velocities=res["velocities"],
        accelerations=res["accelerations"],
        tracking_errors=res["tracking_errors"],
        control_outputs=res["control_outputs"],
        ee_positions=res["ee_positions"],
        max_tracking_error=res["max_tracking_error"],
        rms_tracking_error=res["rms_tracking_error"]
    )


@router.post("/save_run")
def save_simulation_run(req: SaveRunRequest):
    run_id = insert_simulation_run(
        algorithm=req.algorithm,
        success=req.success,
        planning_time_ms=req.planning_time_ms,
        execution_time_s=req.execution_time_s,
        path_length=req.path_length,
        sampled_nodes=req.sampled_nodes,
        collision_checks=req.collision_checks,
        max_velocity=req.max_velocity,
        max_acceleration=req.max_acceleration,
        rms_tracking_error=req.rms_tracking_error,
        details=req.details,
        name=req.name
    )
    return {"success": True, "run_id": run_id}
