# RoboMotion AI — 3-Arm Collaborative Robotic Workcell & Simulation System

A professional, full-featured web application combining Mechatronics, Robotics, Control Systems, Computational Geometry, and AI Motion Planning for a multi-robot collaborative workcell with three 6-DOF industrial articulated robots.

---

## 🌟 Key Features

1. **3-Arm Collaborative Robotic Workcell (Three.js & React Three Fiber)**
   - **Arm 1 (Infeed / Handling)**: Located at $X = -0.75\text{m}$, Cyan accents, handles incoming parts.
   - **Arm 2 (Main Assembly)**: Located at $X = 0.0\text{m}$, Amber accents, precision multi-stage transfer and assembly.
   - **Arm 3 (Palletizer / Inspection)**: Located at $X = +0.75\text{m}$, Emerald accents, quality inspection and palletizing.
   - Light titanium composite chassis (`#e2e8f0` / `#f8fafc`) with dark cast joint housings and studio PBR lighting (hemisphere fill, key/rim lighting, and ground bounce).
   - Independent 6-DOF kinematics and tool transformations for each arm.
   - Real-time interlock management, inter-arm collision checking, deadlock detection, and one-click **Clear Deadlock** resolution.

2. **Rigorous Robotic Kinematics**
   - **Forward Kinematics**: Computes cumulative $4 \times 4$ homogeneous transformation matrices $T_0 \dots T_7$ in both robot local space and unified world cell space, end-effector positions, Euler angles (roll, pitch, yaw), and quaternions.
   - **Analytic Geometric Jacobian**: Computes the full $6 \times 6$ Jacobian matrix $J(q) = \begin{bmatrix} J_v \\ J_\omega \end{bmatrix}$ mapping joint velocities to Cartesian linear and angular velocities.
   - **Numerical Inverse Kinematics (Damped Least Squares)**: Multi-seed posture solver ($\theta_{base} = \arctan2(Z, -X)$, elbow-up/elbow-down branches) with null-space centering and ground clearance ($Y \ge 0.02\text{m}$) validation:
     $$\Delta q = J^T (J J^T + \lambda^2 I)^{-1} e + (I - J^\dagger J) k_{null} (q_{rest} - q)$$

3. **AI Motion Planning in Joint Space**
   - **Bidirectional RRT-Connect**: Stratified goal-bias and upright posture sampling solving 6-DOF transfer trajectories in $<250\text{ms}$ with zero timeouts.
   - **RRT\***: Asymptotically optimal motion planner with dynamic near-neighbor radius search, minimum-cost parent selection, and neighbor rewiring.
   - **Trajectory Optimization**: Path shortcutting removing redundant joint motions while guaranteeing continuous collision avoidance.
   - **Direct Interpolation Baseline**: Straight-line baseline planner used for empirical benchmarking comparisons.

4. **10-Stage Grasp & Pick-and-Place Pipeline with Live Diagnostics**
   - Autonomous multi-stage execution and verification:
     1. Target object & grasp pose identification
     2. Pick-position reachability & IK synthesis
     3. Pre-grasp approach pose check
     4. Collision-free descent trajectory
     5. Gripper closure & kinematic coupling
     6. Vertical lift clearance trajectory
     7. Bidirectional RRT* transfer trajectory
     8. Pre-place destination pose validation
     9. Precision descent & placement
     10. Gripper release & safe home return
   - **Run Diagnostics Modal**: Instant verification across all 10 stages reporting exact solver latencies, clearance metrics, and failure diagnostics.
   - Physical object attachment follows gripper in world coordinates and remains resting at drop target after completion.

5. **3D Collision Detection with Link Capsules**
   - Robot links approximated as geometric capsules (line segments + radius).
   - Inter-arm collision checks between adjacent links across distinct robot bases.
   - Exact continuous mathematical intersection tests for Capsule $\leftrightarrow$ Sphere, Capsule $\leftrightarrow$ Box (OBB), and Capsule $\leftrightarrow$ Cylinder.

6. **Trajectory Generation & Joint PID Control**
   - Time-parameterized cubic spline trajectories respecting joint velocity limits ($\dot{q}_{max}$) and acceleration limits ($\ddot{q}_{max}$).
   - Simulated joint-level closed-loop PID controller modeling drive inertia, viscous damping, payload mass, and saturation torque.
   - Real-time telemetry: Target vs Actual angle, tracking error, control effort torque, and playhead scrubber.

7. **Analytics, Empirical Benchmarking & Persistence**
   - Repeatable benchmark trials across algorithms with seeded runs.
   - Empirical comparison charts (Recharts) for planning latency, path cost, collision checks, and success rates.
   - SQLite persistent database storing simulation runs, benchmark experiments, and automation sequences.
   - Instant CSV export download.

---

## 🏗️ Project Architecture

```
Virtual Robotic Arm/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI server, CORS, Lifespan initialization
│   │   ├── schemas/models.py         # Pydantic schemas
│   │   ├── kinematics/
│   │   │   ├── dh_model.py           # 6-DOF Robot Model, FK, Jacobians, Transforms
│   │   │   └── inverse_kinematics.py # Damped Least Squares IK with Joint Limits
│   │   ├── collision/
│   │   │   ├── geometry.py           # Capsule, Box, Sphere, Cylinder distance tests
│   │   │   └── checker.py            # Collision checker for arm links & obstacles
│   │   ├── planning/
│   │   │   ├── rrt.py                # RRT joint-space tree planner
│   │   │   ├── rrt_star.py           # Optimal RRT* with rewiring
│   │   │   ├── trajectory_optimizer.py # Path shortcutting & refinement
│   │   │   └── direct_interpolator.py  # Baseline linear interpolation
│   │   ├── trajectories/
│   │   │   └── generator.py          # Time-parameterized cubic spline trajectories
│   │   ├── controllers/
│   │   │   └── pid.py                # Joint-level closed loop PID tracking simulation
│   │   ├── pick_place/
│   │   │   └── pipeline.py           # Grasp synthesis & multi-stage pipeline
│   │   ├── automation/
│   │   │   └── sequence_engine.py    # Automation sequence validator and compiler
│   │   ├── database/
│   │   │   ├── db.py                 # SQLite database schema and connection
│   │   │   └── models.py             # CRUD helpers for history, benchmarks, sequences
│   │   └── api/                      # REST endpoints for robot, planning, sim, history
│   ├── tests/                        # 19 automated tests for kinematics, planning, API
│   └── requirements.txt              # FastAPI, NumPy, SciPy, Pytest, Uvicorn
│
├── frontend/
│   ├── src/
│   │   ├── robot/
│   │   │   ├── RobotArm3D.tsx        # 3D robot arm, joints, flange, parallel gripper
│   │   │   ├── WorkspaceGrid.tsx     # Industrial worktable, coordinate axes, point cloud
│   │   │   ├── Obstacles3D.tsx       # 3D boxes, spheres, cylinders, dynamic velocity
│   │   │   ├── TrajectoryPath3D.tsx  # 3D spline trajectory tube, waypoints, playhead
│   │   │   ├── PickPlaceObjects3D.tsx# Pick/place pedestals & dynamic attachment
│   │   │   ├── RobotKinematics.ts    # 60fps local Three.js FK transforms
│   │   │   └── Viewport3D.tsx        # Main 3D viewport canvas & camera presets
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Top industrial navigation & connectivity pill
│   │   │   └── TelemetryTimeline.tsx # Bottom timeline scrubber & PID chart
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx      # System dashboard & interactive quick presets
│   │   │   ├── RobotStudioPage.tsx   # Joint sliders, FK matrix viewer, numerical IK
│   │   │   ├── MotionPlanningPage.tsx# RRT/RRT* controls, obstacles, metrics
│   │   │   ├── PickPlacePage.tsx     # Pick & place workspace & task queue
│   │   │   ├── AutomationPage.tsx    # Visual action block editor & live execution
│   │   │   ├── AnalyticsPage.tsx     # Benchmark comparison charts & CSV export
│   │   │   ├── HistoryPage.tsx       # SQLite persistence records & details modal
│   │   │   └── SettingsPage.tsx      # PID controller gains tuning & API settings
│   │   ├── store/useRobotStore.ts    # Central Zustand state store
│   │   ├── api/client.ts             # Typed API client with fallback capability
│   │   └── types/index.ts            # TypeScript interfaces
│   ├── package.json
│   └── tailwind.config.js
│
├── README.md
└── .env.example
```

---

## 🚀 Execution Instructions (Windows PowerShell in VS Code)

### Terminal 1: Backend Server (FastAPI)

```powershell
# Navigate to the backend directory
cd "c:\Virtual Robotic Arm\backend"

# Install dependencies (if not already installed)
py -m pip install -r requirements.txt

# Start the FastAPI server on port 8000
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

*The API documentation is available at `http://localhost:8000/docs`.*

---

### Terminal 2: Frontend Web Application (React + Vite)

```powershell
# Navigate to the frontend directory
cd "c:\Virtual Robotic Arm\frontend"

# Install dependencies (if not already installed)
npm install

# Launch the development server
npm run dev
```

*Open your web browser at `http://localhost:5173` to interact with the system.*

---

## 🚀 Deployment (Vercel + Render)

The frontend is configured for Vercel in `frontend/vercel.json`. The Render Blueprint
in `render.yaml` deploys the FastAPI backend from the `backend` directory.

1. Push this project to a GitHub repository.
2. In Render, create a Blueprint from the repository and deploy the `robomotion-api`
   service defined in `render.yaml`.
3. In Vercel, import the same repository and set the project root directory to
   `frontend`. Set the `VITE_API_BASE_URL` environment variable to
   `https://<your-render-service>.onrender.com/api`, then deploy.
4. In Render, replace `CORS_ORIGINS` with the deployed Vercel origin, for example
   `https://<your-project>.vercel.app`, and redeploy the backend.

The free Render service may spin down while idle, so the first API request after
inactivity can take longer. Its local SQLite database is ephemeral on the free plan;
simulation history may be lost when the service restarts or redeploys.

---

### Running Automated Test Suite

```powershell
cd "c:\Virtual Robotic Arm\backend"
py -m pytest tests -v
```

All 22 test cases validate:
- Forward kinematics at known upright and angled postures across world and local frames.
- Damped Least Squares inverse kinematics convergence with multi-seed candidates and ground clearance filtering.
- Physical joint limit clamping and reachability detection.
- Capsule-to-box, capsule-to-sphere, and capsule-to-cylinder geometric distance equations.
- Inter-arm collision checks between adjacent links across distinct robot bases.
- Bidirectional RRT-Connect and RRT* collision-free path synthesis around obstacles.
- 10-Stage Pick & Place diagnostics suite and multi-stage execution pipeline.
- Trajectory velocity/acceleration boundary limits and PID controller tracking.
- API REST endpoints and SQLite database persistence.

---

## 🔬 Mathematical Formulations

### Forward Kinematics
For joint angle vector $q = [\theta_1, \theta_2, \theta_3, \theta_4, \theta_5, \theta_6]^T$, the cumulative homogeneous transformation matrix from base to link $i$ is:
$$T_i(q) = T_{i-1}(q) \cdot T_{offset, i} \cdot R_i(\theta_i)$$
The end-effector position is $p_{ee} = T_7[0:3, 3]$.

### Inverse Kinematics (Damped Least Squares)
Given target pose $x_{target}$, error $e = [p_{target} - p_{current}; \Delta \omega]$, the joint step is:
$$\Delta q = J^T (J J^T + \lambda^2 I)^{-1} e + (I - J^\dagger J) k_{null} (q_{rest} - q)$$
Where $\lambda = 0.05$ ensures numerical stability near kinematic singularities.

### RRT* Rewiring
For newly generated node $x_{new}$ within near neighborhood radius $r$:
$$cost(x_{new}) = \min_{x_{near} \in X_{near}} \left( cost(x_{near}) + \text{dist}(x_{near}, x_{new}) \right)$$
For each neighbor $x_{near}$, rewire parent to $x_{new}$ if:
$$cost(x_{new}) + \text{dist}(x_{new}, x_{near}) < cost(x_{near})$$

### Joint-Level PID Controller Simulation
$$u(t) = K_p e(t) + K_i \int_0^t e(\tau) d\tau + K_d \dot{e}(t) + I_{eff} \ddot{q}_d(t)$$
$$\ddot{q}_a(t) = \frac{u_{sat}(t) - b \dot{q}_a(t)}{I_{eff} + m_{payload}}$$
Simulated using numerical integration generating real telemetry tracking curves.
