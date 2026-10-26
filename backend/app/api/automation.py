from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
from app.schemas.models import AutomationSequence, Obstacle
from app.automation.sequence_engine import AutomationEngine
from app.database.models import save_automation_sequence, list_automation_sequences

router = APIRouter(prefix="/automation", tags=["Automation Sequences"])
engine = AutomationEngine()


class ValidateSequenceRequest(BaseModel):
    sequence: AutomationSequence
    initial_angles: List[float] = [0.0, 0.3, -0.6, 0.3, 0.0, 0.0]
    obstacles: List[Obstacle] = []


@router.post("/validate")
def validate_sequence(req: ValidateSequenceRequest):
    res = engine.validate_and_compile(
        sequence=req.sequence,
        initial_q=req.initial_angles,
        obstacles=req.obstacles
    )
    return res


@router.get("/sequences")
def get_sequences():
    return list_automation_sequences()


@router.post("/sequences")
def save_sequence(seq: AutomationSequence):
    seq_id = save_automation_sequence(
        seq_id=seq.id,
        name=seq.name,
        description=seq.description or "",
        steps=[s.model_dump() for s in seq.steps]
    )
    return {"success": True, "id": seq_id}
