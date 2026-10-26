from fastapi import APIRouter
from fastapi.responses import Response
import csv
import io
from app.database.models import list_simulation_runs, list_benchmark_experiments

router = APIRouter(prefix="/history", tags=["Simulation History & Persistence"])


@router.get("/runs")
def get_runs():
    return list_simulation_runs()


@router.get("/benchmarks")
def get_benchmarks():
    return list_benchmark_experiments()


@router.get("/export_csv")
def export_csv():
    runs = list_simulation_runs(limit=500)
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Run ID", "Name", "Algorithm", "Success", "Planning Time (ms)",
        "Execution Time (s)", "Path Length (rad)", "Sampled Nodes",
        "Collision Checks", "Max Velocity (rad/s)", "Max Accel (rad/s^2)",
        "RMS Tracking Error (rad)", "Created At"
    ])

    for r in runs:
        writer.writerow([
            r["id"],
            r["name"],
            r["algorithm"],
            "Yes" if r["success"] else "No",
            r["planning_time_ms"],
            r["execution_time_s"],
            r["path_length"],
            r["sampled_nodes"],
            r["collision_checks"],
            r.get("max_velocity", 0.0),
            r.get("max_acceleration", 0.0),
            r.get("rms_tracking_error", 0.0),
            r["created_at"]
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=robomotion_simulations.csv"}
    )
