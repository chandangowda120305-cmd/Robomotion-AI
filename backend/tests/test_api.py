import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"


def test_robot_config_endpoint():
    res = client.get("/api/robot/config")
    assert res.status_code == 200
    data = res.json()
    assert len(data["joint_names"]) == 6
    assert "link_dimensions" in data


def test_robot_fk_endpoint():
    payload = {"angles": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}
    res = client.post("/api/robot/fk", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "end_effector_pose" in data
    assert len(data["link_frames"]) == 8


def test_robot_ik_endpoint():
    payload = {
        "target_position": [0.3, 0.5, 0.2],
        "position_only": True
    }
    res = client.post("/api/robot/ik", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "success" in data
    assert len(data["angles"]) == 6


def test_collision_check_endpoint():
    payload = {
        "angles": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "obstacles": []
    }
    res = client.post("/api/planning/collision_check", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["in_collision"] is False


def test_history_endpoints():
    res_runs = client.get("/api/history/runs")
    assert res_runs.status_code == 200

    res_csv = client.get("/api/history/export_csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
