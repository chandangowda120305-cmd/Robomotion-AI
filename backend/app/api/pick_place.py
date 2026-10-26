from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.schemas.models import PickPlaceTask, Obstacle
from app.pick_place.pipeline import PickAndPlacePipeline

router = APIRouter(prefix="/pick_place", tags=["Pick and Place"])
pipeline = PickAndPlacePipeline()


class PickPlacePlanRequest(BaseModel):
    task: PickPlaceTask
    start_angles: List[float] = [0.0, 0.3, -0.6, 0.3, 0.0, 0.0]
    obstacles: List[Obstacle] = []
    speed_factor: float = 1.0
    arm_base_pos: Optional[List[float]] = None
    arm_base_yaw: float = 0.0


@router.post("/plan")
def plan_pick_place(req: PickPlacePlanRequest):
    res = pipeline.plan_pick_and_place(
        task=req.task,
        start_q=req.start_angles,
        obstacles=req.obstacles,
        speed_factor=req.speed_factor,
        arm_base_pos=req.arm_base_pos,
        arm_base_yaw=req.arm_base_yaw
    )
    if not res["success"]:
        return {
            "success": False,
            "error_message": res["error_message"],
            "stages": []
        }
    return res


@router.post("/diagnostics")
def run_task_diagnostics(req: PickPlacePlanRequest):
    res = pipeline.run_diagnostics(
        task=req.task,
        start_q=req.start_angles,
        obstacles=req.obstacles,
        arm_base_pos=req.arm_base_pos,
        arm_base_yaw=req.arm_base_yaw
    )
    return res
