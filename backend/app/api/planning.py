from fastapi import APIRouter, HTTPException
import numpy as np
import time
from typing import List, Dict, Any
from app.schemas.models import (
    PlanRequest, PlanResponse, CollisionCheckRequest,
    CollisionCheckResponse, BenchmarkRequest, BenchmarkMetric
)
from app.kinematics.dh_model import RobotModel
from app.kinematics.inverse_kinematics import InverseKinematicsSolver
from app.collision.checker import CollisionChecker
from app.planning.rrt import RRTPlanner
from app.planning.rrt_star import RRTStarPlanner
from app.planning.trajectory_optimizer import TrajectoryOptimizer
from app.planning.direct_interpolator import DirectInterpolator
from app.database.models import insert_benchmark_experiment

router = APIRouter(prefix="/planning", tags=["Motion Planning"])

robot = RobotModel()
checker = CollisionChecker(robot)
ik_solver = InverseKinematicsSolver(robot)
rrt_planner = RRTPlanner(robot, checker)
rrt_star_planner = RRTStarPlanner(robot, checker)
optimizer = TrajectoryOptimizer(robot, checker)
direct_planner = DirectInterpolator(robot, checker)


@router.post("/collision_check", response_model=CollisionCheckResponse)
def check_collision(req: CollisionCheckRequest):
    q = np.array(req.angles, dtype=float)
    res = checker.check_collision(q, req.obstacles)
    return CollisionCheckResponse(
        in_collision=res["in_collision"],
        colliding_link_index=res.get("colliding_link_index"),
        colliding_link_name=res.get("colliding_link_name"),
        colliding_obstacle_id=res.get("colliding_obstacle_id"),
        min_distance=res.get("min_distance", 1.0),
        details=res.get("details", "")
    )


@router.post("/plan", response_model=PlanResponse)
def plan_motion(req: PlanRequest):
    start_q = np.array(req.start_angles, dtype=float)

    # Determine goal configuration
    if req.goal_angles:
        goal_q = np.array(req.goal_angles, dtype=float)
    elif req.target_pose:
        ik_res = ik_solver.solve(
            target_pos=np.array(req.target_pose.position),
            target_rot_mat=RobotModel.euler_xyz_to_matrix(*req.target_pose.orientation) if req.target_pose.orientation else None,
            initial_q=start_q,
            position_only=(req.target_pose.orientation is None)
        )
        if not ik_res["success"]:
            raise HTTPException(status_code=400, detail=f"Target pose is unreachable: {ik_res['message']}")
        goal_q = np.array(ik_res["angles"])
    else:
        raise HTTPException(status_code=400, detail="Must provide either goal_angles or target_pose.")

    if req.algorithm == "direct":
        result = direct_planner.plan(start_q, goal_q, req.obstacles, step_size=req.step_size)
    elif req.algorithm == "rrt":
        result = rrt_planner.plan(
            start_q, goal_q, req.obstacles,
            max_iterations=req.max_iterations,
            step_size=req.step_size,
            goal_bias=req.goal_bias,
            max_time_s=req.max_time_s,
            random_seed=req.random_seed
        )
    elif req.algorithm == "rrt_star":
        result = rrt_star_planner.plan(
            start_q, goal_q, req.obstacles,
            max_iterations=req.max_iterations,
            step_size=req.step_size,
            goal_bias=req.goal_bias,
            rewire_radius=req.rewire_radius,
            max_time_s=req.max_time_s,
            random_seed=req.random_seed
        )
    elif req.algorithm == "rrt_star_opt":
        raw_result = rrt_star_planner.plan(
            start_q, goal_q, req.obstacles,
            max_iterations=req.max_iterations,
            step_size=req.step_size,
            goal_bias=req.goal_bias,
            rewire_radius=req.rewire_radius,
            max_time_s=req.max_time_s,
            random_seed=req.random_seed
        )
        if raw_result["success"]:
            opt_path = optimizer.optimize_path(raw_result["path"], req.obstacles)
            ee_path = []
            for q in opt_path:
                t = robot.forward_kinematics_transforms(np.array(q))
                ee_path.append(t[-1][:3, 3].tolist())

            # Calculate optimized path cost
            cost = 0.0
            for i in range(len(opt_path) - 1):
                cost += float(np.linalg.norm(np.array(opt_path[i + 1]) - np.array(opt_path[i])))

            result = {
                **raw_result,
                "algorithm": "RRT* + Trajectory Opt",
                "path": opt_path,
                "ee_path": ee_path,
                "path_cost": cost,
                "message": f"Optimized path with {len(opt_path)} waypoints (cost reduced from {raw_result['path_cost']:.3f} to {cost:.3f})."
            }
        else:
            result = raw_result
    else:
        raise HTTPException(status_code=400, detail=f"Unknown algorithm: {req.algorithm}")

    return PlanResponse(
        success=result["success"],
        algorithm=result["algorithm"],
        path=result["path"],
        ee_path=result["ee_path"],
        planning_time_s=result["planning_time_s"],
        iterations=result["iterations"],
        sampled_nodes=result["sampled_nodes"],
        collision_checks=result["collision_checks"],
        valid_nodes=result["valid_nodes"],
        rejected_nodes=result["rejected_nodes"],
        path_cost=result["path_cost"],
        message=result["message"]
    )


@router.post("/benchmark", response_model=List[BenchmarkMetric])
def run_benchmark(req: BenchmarkRequest):
    """
    Executes multiple trials of motion planners on identical configurations
    to produce real empirical comparison statistics.
    """
    start_q = np.array(req.start_angles, dtype=float)
    goal_q = np.array(req.goal_angles, dtype=float)

    metrics_list = []

    for alg in req.algorithms:
        trial_results = []
        times = []
        lengths = []
        samples = []
        checks = []
        successes = 0

        for trial_idx in range(req.num_trials):
            seed = 42 + trial_idx * 17
            if alg == "direct":
                res = direct_planner.plan(start_q, goal_q, req.obstacles, step_size=req.step_size)
            elif alg == "rrt":
                res = rrt_planner.plan(start_q, goal_q, req.obstacles, max_iterations=req.max_iterations, step_size=req.step_size, random_seed=seed)
            elif alg == "rrt_star":
                res = rrt_star_planner.plan(start_q, goal_q, req.obstacles, max_iterations=req.max_iterations, step_size=req.step_size, random_seed=seed)
            elif alg == "rrt_star_opt":
                raw = rrt_star_planner.plan(start_q, goal_q, req.obstacles, max_iterations=req.max_iterations, step_size=req.step_size, random_seed=seed)
                if raw["success"]:
                    opt = optimizer.optimize_path(raw["path"], req.obstacles)
                    cost = sum(float(np.linalg.norm(np.array(opt[i+1]) - np.array(opt[i]))) for i in range(len(opt)-1))
                    res = {**raw, "path": opt, "path_cost": cost}
                else:
                    res = raw

            t_ms = res["planning_time_s"] * 1000.0
            times.append(t_ms)
            samples.append(res["sampled_nodes"])
            checks.append(res["collision_checks"])

            if res["success"]:
                successes += 1
                lengths.append(res["path_cost"])
            else:
                lengths.append(0.0)

            trial_results.append({
                "trial": trial_idx + 1,
                "seed": seed,
                "success": res["success"],
                "time_ms": round(t_ms, 2),
                "path_cost": round(res["path_cost"], 3),
                "sampled_nodes": res["sampled_nodes"],
                "collision_checks": res["collision_checks"]
            })

        avg_time = float(np.mean(times))
        std_time = float(np.std(times))
        succ_lengths = [l for l in lengths if l > 0.0]
        avg_len = float(np.mean(succ_lengths)) if succ_lengths else 0.0
        avg_samples = float(np.mean(samples))
        avg_checks = float(np.mean(checks))
        success_rate = float(successes / req.num_trials)

        metrics_list.append(BenchmarkMetric(
            algorithm=alg.upper(),
            success_rate=success_rate,
            avg_planning_time_ms=round(avg_time, 2),
            avg_path_length=round(avg_len, 3),
            avg_sampled_nodes=round(avg_samples, 1),
            avg_collision_checks=round(avg_checks, 1),
            std_planning_time_ms=round(std_time, 2),
            trials_details=trial_results
        ))

    insert_benchmark_experiment(
        name=f"Benchmark {len(req.algorithms)} planners ({req.num_trials} trials)",
        num_trials=req.num_trials,
        results=[m.model_dump() for m in metrics_list]
    )

    return metrics_list
