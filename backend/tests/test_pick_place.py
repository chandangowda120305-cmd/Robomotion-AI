import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.models import PickPlaceTask
from app.pick_place.pipeline import PickAndPlacePipeline

client = TestClient(app)


def test_diagnostics_pipeline_success():
    pipeline = PickAndPlacePipeline()
    task = PickPlaceTask(
        id="test-task-1",
        name="Test Block Relocation",
        object_id="test-block",
        object_type="box",
        object_color="#06b6d4",
        object_size=[0.06, 0.06, 0.06],
        pick_position=[0.35, 0.15, 0.25],
        place_position=[-0.35, 0.15, 0.25],
        status="pending",
        progress=0.0
    )

    diag = pipeline.run_diagnostics(task)
    assert diag["all_passed"] is True, f"Diagnostics failed: {diag['overall_message']}"
    assert len(diag["stages"]) == 10
    assert diag["failure_stage"] is None
    for stage in diag["stages"]:
        assert stage["status"] == "passed"


def test_plan_pick_and_place_success():
    pipeline = PickAndPlacePipeline()
    task = PickPlaceTask(
        id="test-task-2",
        name="Test Cylinder Transfer",
        object_id="test-cyl",
        object_type="cylinder",
        object_color="#10b981",
        object_size=[0.04, 0.08, 0],
        pick_position=[0.25, 0.15, -0.25],
        place_position=[-0.25, 0.15, -0.25],
        status="pending",
        progress=0.0
    )

    plan = pipeline.plan_pick_and_place(task)
    assert plan["success"] is True, f"Planning failed: {plan.get('error_message')}"
    assert len(plan["stages"]) >= 6
    stage_names = [s["name"] for s in plan["stages"]]
    assert any("Transfer" in name for name in stage_names)


def test_api_pick_place_endpoints():
    task_payload = {
        "id": "api-task-1",
        "name": "API Pick Place",
        "object_id": "box-api",
        "object_type": "box",
        "object_color": "#38bdf8",
        "object_size": [0.06, 0.06, 0.06],
        "pick_position": [0.35, 0.15, 0.25],
        "place_position": [-0.35, 0.15, 0.25],
        "status": "pending",
        "progress": 0.0
    }

    # Test diagnostics endpoint
    diag_res = client.post("/api/pick_place/diagnostics", json={"task": task_payload})
    assert diag_res.status_code == 200
    diag_data = diag_res.json()
    assert diag_data["all_passed"] is True
    assert len(diag_data["stages"]) == 10

    # Test planning endpoint
    plan_res = client.post("/api/pick_place/plan", json={"task": task_payload})
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert plan_data["success"] is True
    assert len(plan_data["stages"]) >= 6
