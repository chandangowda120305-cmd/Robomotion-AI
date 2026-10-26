import json
import uuid
from typing import List, Dict, Any, Optional
import sqlite3
from app.database.db import get_db, DB_FILE


def insert_simulation_run(
    algorithm: str,
    success: bool,
    planning_time_ms: float,
    execution_time_s: float,
    path_length: float,
    sampled_nodes: int,
    collision_checks: int,
    max_velocity: float = 0.0,
    max_acceleration: float = 0.0,
    rms_tracking_error: float = 0.0,
    details: Optional[Dict[str, Any]] = None,
    name: Optional[str] = None
) -> str:
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO simulation_runs (
            id, name, algorithm, success, planning_time_ms, execution_time_s,
            path_length, sampled_nodes, collision_checks, max_velocity,
            max_acceleration, rms_tracking_error, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        run_id,
        name or f"Sim {run_id}",
        algorithm,
        1 if success else 0,
        planning_time_ms,
        execution_time_s,
        path_length,
        sampled_nodes,
        collision_checks,
        max_velocity,
        max_acceleration,
        rms_tracking_error,
        json.dumps(details or {})
    ))
    conn.commit()
    conn.close()
    return run_id


def list_simulation_runs(limit: int = 50) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM simulation_runs ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "name": r["name"],
            "algorithm": r["algorithm"],
            "success": bool(r["success"]),
            "planning_time_ms": r["planning_time_ms"],
            "execution_time_s": r["execution_time_s"],
            "path_length": r["path_length"],
            "sampled_nodes": r["sampled_nodes"],
            "collision_checks": r["collision_checks"],
            "max_velocity": r["max_velocity"],
            "max_acceleration": r["max_acceleration"],
            "rms_tracking_error": r["rms_tracking_error"],
            "details": json.loads(r["details_json"]) if r["details_json"] else {},
            "created_at": r["created_at"]
        })
    conn.close()
    return results


def insert_benchmark_experiment(name: str, num_trials: int, results: List[Dict[str, Any]]) -> str:
    exp_id = f"exp_{uuid.uuid4().hex[:8]}"
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO benchmark_experiments (id, name, num_trials, results_json)
        VALUES (?, ?, ?, ?)
    """, (exp_id, name, num_trials, json.dumps(results)))
    conn.commit()
    conn.close()
    return exp_id


def list_benchmark_experiments() -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM benchmark_experiments ORDER BY created_at DESC LIMIT 20")
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "name": r["name"],
            "num_trials": r["num_trials"],
            "results": json.loads(r["results_json"]),
            "created_at": r["created_at"]
        })
    conn.close()
    return results


def save_automation_sequence(seq_id: str, name: str, description: str, steps: List[Dict[str, Any]]) -> str:
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO automation_sequences (id, name, description, steps_json)
        VALUES (?, ?, ?, ?)
    """, (seq_id, name, description, json.dumps(steps)))
    conn.commit()
    conn.close()
    return seq_id


def list_automation_sequences() -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM automation_sequences ORDER BY created_at DESC")
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "steps": json.loads(r["steps_json"]),
            "created_at": r["created_at"]
        })
    conn.close()
    return results
