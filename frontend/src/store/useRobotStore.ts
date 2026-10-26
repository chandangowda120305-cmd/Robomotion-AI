import { create } from 'zustand';
import {
  NavigationTab,
  Pose,
  Obstacle,
  PlanResult,
  TrajectoryData,
  TelemetryData,
  PickPlaceTask,
  AutomationSequence,
  BenchmarkMetric,
  SimulationRunRecord,
  RoboticArmState
} from '../types';
import { ClientRobotKinematics } from '../robot/RobotKinematics';

const defaultHome1 = [-0.2, 0.4, -0.7, 0.3, 0.0, 0.0];
const defaultHome2 = [0.0, 0.3, -0.6, 0.3, 0.0, 0.0];
const defaultHome3 = [0.2, 0.4, -0.7, 0.3, 0.0, 0.0];

const initialFK1 = ClientRobotKinematics.computeFK(defaultHome1);
const initialFK2 = ClientRobotKinematics.computeFK(defaultHome2);
const initialFK3 = ClientRobotKinematics.computeFK(defaultHome3);

interface RobotStoreState {
  // Navigation
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;

  // Backend connection status
  backendConnected: boolean;
  setBackendConnected: (status: boolean) => void;

  // 3 Robotic Arms State
  arms: RoboticArmState[];
  selectedArmId: string;
  setSelectedArmId: (id: string) => void;

  // Convenience getters/setters for active arm
  jointAngles: number[];
  currentPose: Pose;
  targetPose: Pose;
  gripperState: 'open' | 'closed';

  setJointAngles: (angles: number[]) => void;
  setSingleJointAngle: (index: number, angleRad: number) => void;
  setArmJointAngles: (armId: string, angles: number[]) => void;
  setArmSingleJointAngle: (armId: string, index: number, angleRad: number) => void;
  setTargetPose: (pose: Partial<Pose>) => void;
  setGripperState: (state: 'open' | 'closed') => void;
  setArmGripperState: (armId: string, state: 'open' | 'closed') => void;
  resetToHome: () => void;

  // Deadlock & Interlock Management
  isDeadlocked: boolean;
  deadlockReason: string | null;
  setDeadlock: (deadlocked: boolean, reason?: string) => void;
  clearDeadlock: () => void;
  triggerDeadlockDemo: () => void;

  // Obstacles
  obstacles: Obstacle[];
  selectedObstacleId: string | null;
  addObstacle: (obs: Obstacle) => void;
  updateObstacle: (id: string, updates: Partial<Obstacle>) => void;
  removeObstacle: (id: string) => void;
  selectObstacle: (id: string | null) => void;

  // Collision Status
  isColliding: boolean;
  collidingLink: string | null;
  collidingObstacleId: string | null;
  minObstacleDistance: number;
  setCollisionStatus: (status: {
    in_collision: boolean;
    colliding_link_name?: string;
    colliding_obstacle_id?: string;
    min_distance: number;
  }) => void;

  // Motion Planning Configuration & Results
  selectedAlgorithm: 'rrt' | 'rrt_star' | 'rrt_star_opt' | 'direct';
  setSelectedAlgorithm: (alg: 'rrt' | 'rrt_star' | 'rrt_star_opt' | 'direct') => void;
  planningParams: {
    maxIterations: number;
    stepSize: number;
    goalBias: number;
    rewireRadius: number;
    randomSeed: number;
    speedFactor: number;
  };
  setPlanningParams: (params: Partial<RobotStoreState['planningParams']>) => void;

  isPlanning: boolean;
  setIsPlanning: (v: boolean) => void;
  planResult: PlanResult | null;
  setPlanResult: (res: PlanResult | null) => void;

  // Trajectory & Execution
  trajectory: TrajectoryData | null;
  setTrajectory: (traj: TrajectoryData | null) => void;

  isPlaying: boolean;
  isPaused: boolean;
  currentPlayheadTime: number;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
  stopSimulation: () => void;
  setPlayheadTime: (t: number) => void;

  attachedObjectId: string | null;
  setAttachedObjectId: (id: string | null) => void;

  // Swarm Multi-Arm Coordination
  isSwarmRunning: boolean;
  swarmPhase: string;
  armTrajectories: Record<string, TrajectoryData | null>;
  armPlayheads: Record<string, number>;
  armAttachedObjects: Record<string, string | null>;
  setArmTrajectory: (armId: string, traj: TrajectoryData | null) => void;
  setArmPlayhead: (armId: string, t: number) => void;
  setArmAttachedObject: (armId: string, objectId: string | null) => void;
  startSwarmSimulation: () => void;
  stopSwarmSimulation: () => void;
  setSwarmPhase: (phase: string) => void;

  // Telemetry
  telemetry: TelemetryData | null;
  setTelemetry: (tel: TelemetryData | null) => void;
  pidGains: {
    kp: number[];
    ki: number[];
    kd: number[];
    loadMass: number;
  };
  setPidGains: (gains: Partial<RobotStoreState['pidGains']>) => void;

  // Pick and Place Workspace
  pickPlaceTasks: PickPlaceTask[];
  currentTaskId: string | null;
  addTask: (task: PickPlaceTask) => void;
  updateTask: (id: string, updates: Partial<PickPlaceTask>) => void;
  removeTask: (id: string) => void;
  setCurrentTaskId: (id: string | null) => void;

  // Automation Sequences
  automationSequences: AutomationSequence[];
  activeSequence: AutomationSequence | null;
  currentStepIndex: number;
  setActiveSequence: (seq: AutomationSequence | null) => void;
  setCurrentStepIndex: (idx: number) => void;
  saveSequence: (seq: AutomationSequence) => void;

  // Analytics & History
  benchmarkMetrics: BenchmarkMetric[];
  setBenchmarkMetrics: (metrics: BenchmarkMetric[]) => void;
  simulationHistory: SimulationRunRecord[];
  setSimulationHistory: (history: SimulationRunRecord[]) => void;

  // View & Rendering Options
  viewSettings: {
    showWorkspace: boolean;
    showWireframe: boolean;
    showAxes: boolean;
    showCollisionCapsules: boolean;
    cameraPreset: 'isometric' | 'front' | 'top' | 'side';
  };
  toggleViewSetting: (key: keyof RobotStoreState['viewSettings']) => void;
  setCameraPreset: (preset: 'isometric' | 'front' | 'top' | 'side') => void;

  // Notifications
  notifications: Array<{ id: string; text: string; type: 'info' | 'success' | 'warning' | 'error' }>;
  addNotification: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  removeNotification: (id: string) => void;
}

export const useRobotStore = create<RobotStoreState>((set, get) => ({
  activeTab: 'studio',
  setActiveTab: (tab) => set({ activeTab: tab }),

  backendConnected: false,
  setBackendConnected: (status) => set({ backendConnected: status }),

  // 3 Robotic Arms
  arms: [
    {
      id: 'arm-1',
      name: 'Arm 1 (Infeed/Handling)',
      role: 'Material Handling Robot',
      basePosition: [-0.75, 0, 0],
      baseRotation: 0,
      jointAngles: defaultHome1,
      currentPose: initialFK1.endEffectorPose,
      targetPose: { position: [-0.4, 0.4, 0.2], orientation: [0, 0, 0] },
      color: '#1e293b',
      accentColor: '#06b6d4',
      gripperState: 'open',
      isDeadlocked: false,
      status: 'idle'
    },
    {
      id: 'arm-2',
      name: 'Arm 2 (Main Assembly)',
      role: 'Precision Assembly Robot',
      basePosition: [0.0, 0, 0],
      baseRotation: 0,
      jointAngles: defaultHome2,
      currentPose: initialFK2.endEffectorPose,
      targetPose: { position: [0.0, 0.45, 0.25], orientation: [0, 0, 0] },
      color: '#1e293b',
      accentColor: '#f59e0b',
      gripperState: 'open',
      isDeadlocked: false,
      status: 'idle'
    },
    {
      id: 'arm-3',
      name: 'Arm 3 (Inspection/Pallet)',
      role: 'Quality & Palletizing Robot',
      basePosition: [0.75, 0, 0],
      baseRotation: 0,
      jointAngles: defaultHome3,
      currentPose: initialFK3.endEffectorPose,
      targetPose: { position: [0.4, 0.4, 0.2], orientation: [0, 0, 0] },
      color: '#1e293b',
      accentColor: '#10b981',
      gripperState: 'open',
      isDeadlocked: false,
      status: 'idle'
    }
  ],
  selectedArmId: 'arm-2',

  setSelectedArmId: (id) => {
    const arm = get().arms.find((a) => a.id === id) || get().arms[0];
    set({
      selectedArmId: id,
      jointAngles: arm.jointAngles,
      currentPose: arm.currentPose,
      targetPose: arm.targetPose,
      gripperState: arm.gripperState
    });
  },

  // Active Arm getters/proxies
  jointAngles: defaultHome2,
  currentPose: initialFK2.endEffectorPose,
  targetPose: { position: [0.0, 0.45, 0.25], orientation: [0, 0, 0] },
  gripperState: 'open',

  setJointAngles: (angles) => {
    const armId = get().selectedArmId;
    get().setArmJointAngles(armId, angles);
  },

  setSingleJointAngle: (index, angleRad) => {
    const armId = get().selectedArmId;
    get().setArmSingleJointAngle(armId, index, angleRad);
  },

  setArmJointAngles: (armId, angles) => {
    const fk = ClientRobotKinematics.computeFK(angles);
    set((s) => ({
      arms: s.arms.map((a) =>
        a.id === armId ? { ...a, jointAngles: angles, currentPose: fk.endEffectorPose } : a
      ),
      ...(s.selectedArmId === armId
        ? { jointAngles: angles, currentPose: fk.endEffectorPose }
        : {})
    }));
  },

  setArmSingleJointAngle: (armId, index, angleRad) => {
    const arm = get().arms.find((a) => a.id === armId);
    if (!arm) return;
    const newAngles = [...arm.jointAngles];
    newAngles[index] = angleRad;
    get().setArmJointAngles(armId, newAngles);
  },

  setTargetPose: (pose) => {
    const armId = get().selectedArmId;
    set((s) => ({
      arms: s.arms.map((a) =>
        a.id === armId ? { ...a, targetPose: { ...a.targetPose, ...pose } } : a
      ),
      targetPose: { ...s.targetPose, ...pose }
    }));
  },

  setGripperState: (state) => {
    const armId = get().selectedArmId;
    get().setArmGripperState(armId, state);
  },

  setArmGripperState: (armId, state) => {
    set((s) => ({
      arms: s.arms.map((a) => (a.id === armId ? { ...a, gripperState: state } : a)),
      ...(s.selectedArmId === armId ? { gripperState: state } : {})
    }));
  },

  resetToHome: () => {
    const armId = get().selectedArmId;
    const homeAngles =
      armId === 'arm-1' ? defaultHome1 : armId === 'arm-3' ? defaultHome3 : defaultHome2;
    get().setArmJointAngles(armId, homeAngles);
    set({
      isPlaying: false,
      isPaused: false,
      currentPlayheadTime: 0
    });
  },

  // Deadlock Management & Clear Deadlock
  isDeadlocked: false,
  deadlockReason: null,

  setDeadlock: (deadlocked, reason) => {
    set((s) => ({
      isDeadlocked: deadlocked,
      deadlockReason: reason || (deadlocked ? 'Interlock triggered: Mutual arm collision zone violation.' : null),
      isColliding: deadlocked ? true : s.isColliding,
      collidingLink: deadlocked ? 'Multi-Arm Interlock Trip' : s.collidingLink,
      arms: s.arms.map((a) => ({ ...a, isDeadlocked: deadlocked }))
    }));
  },

  clearDeadlock: () => {
    // Retract all 3 arms safely to collision-free home positions
    const fk1 = ClientRobotKinematics.computeFK(defaultHome1);
    const fk2 = ClientRobotKinematics.computeFK(defaultHome2);
    const fk3 = ClientRobotKinematics.computeFK(defaultHome3);

    set((s) => ({
      isDeadlocked: false,
      deadlockReason: null,
      isColliding: false,
      collidingLink: null,
      collidingObstacleId: null,
      isPlaying: false,
      isPaused: false,
      currentPlayheadTime: 0,
      arms: [
        { ...s.arms[0], jointAngles: defaultHome1, currentPose: fk1.endEffectorPose, isDeadlocked: false, status: 'cleared' },
        { ...s.arms[1], jointAngles: defaultHome2, currentPose: fk2.endEffectorPose, isDeadlocked: false, status: 'cleared' },
        { ...s.arms[2], jointAngles: defaultHome3, currentPose: fk3.endEffectorPose, isDeadlocked: false, status: 'cleared' }
      ],
      jointAngles: defaultHome2,
      currentPose: fk2.endEffectorPose
    }));

    get().addNotification(
      'DEADLOCK CLEARED: All 3 robotic arms successfully yielded and retracted to safe home postures. Interlock flags reset.',
      'success'
    );
  },

  triggerDeadlockDemo: () => {
    // Force Arm 1 and Arm 2 to reach directly into mutual conflict zone
    const conflict1 = [0.9, 0.7, -0.4, 0.0, 0.0, 0.0];
    const conflict2 = [-0.9, 0.7, -0.4, 0.0, 0.0, 0.0];
    get().setArmJointAngles('arm-1', conflict1);
    get().setArmJointAngles('arm-2', conflict2);
    get().setDeadlock(true, 'Mutual Workspace Deadlock: Arm 1 and Arm 2 interlocked in central envelope!');
    get().addNotification(
      'DEMO DEADLOCK TRIPPED: Arm 1 and Arm 2 entered conflicting collision volume. Click "CLEAR DEADLOCK" to resolve!',
      'error'
    );
  },

  // Obstacles (Clean workspace without default solid obstruction in front of Arm 2)
  obstacles: [],
  selectedObstacleId: null,

  addObstacle: (obs) => set((s) => ({ obstacles: [...s.obstacles, obs] })),
  updateObstacle: (id, updates) =>
    set((s) => ({
      obstacles: s.obstacles.map((o) => (o.id === id ? { ...o, ...updates } : o))
    })),
  removeObstacle: (id) =>
    set((s) => ({
      obstacles: s.obstacles.filter((o) => o.id !== id),
      selectedObstacleId: s.selectedObstacleId === id ? null : s.selectedObstacleId
    })),
  selectObstacle: (id) => set({ selectedObstacleId: id }),

  isColliding: false,
  collidingLink: null,
  collidingObstacleId: null,
  minObstacleDistance: 1.0,
  setCollisionStatus: (status) =>
    set({
      isColliding: status.in_collision,
      collidingLink: status.colliding_link_name || null,
      collidingObstacleId: status.colliding_obstacle_id || null,
      minObstacleDistance: status.min_distance
    }),

  selectedAlgorithm: 'rrt_star_opt',
  setSelectedAlgorithm: (alg) => set({ selectedAlgorithm: alg }),

  planningParams: {
    maxIterations: 1200,
    stepSize: 0.15,
    goalBias: 0.15,
    rewireRadius: 0.45,
    randomSeed: 42,
    speedFactor: 1.0
  },
  setPlanningParams: (params) =>
    set((s) => ({ planningParams: { ...s.planningParams, ...params } })),

  isPlanning: false,
  setIsPlanning: (v) => set({ isPlanning: v }),
  planResult: null,
  setPlanResult: (res) => set({ planResult: res }),

  trajectory: null,
  setTrajectory: (traj) => set({ trajectory: traj, currentPlayheadTime: 0 }),

  isPlaying: false,
  isPaused: false,
  currentPlayheadTime: 0,
  playbackSpeed: 1.0,
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  startSimulation: () => set({ isPlaying: true, isPaused: false, currentPlayheadTime: 0 }),
  pauseSimulation: () => set({ isPaused: true }),
  resumeSimulation: () => set({ isPaused: false }),
  stopSimulation: () => set({ isPlaying: false, isPaused: false, currentPlayheadTime: 0 }),
  setPlayheadTime: (t) => set({ currentPlayheadTime: t }),

  // Swarm Multi-Arm Coordination
  isSwarmRunning: false,
  swarmPhase: 'IDLE',
  armTrajectories: {
    'arm-1': null,
    'arm-2': null,
    'arm-3': null
  },
  armPlayheads: {
    'arm-1': 0,
    'arm-2': 0,
    'arm-3': 0
  },
  armAttachedObjects: {
    'arm-1': null,
    'arm-2': null,
    'arm-3': null
  },
  setArmTrajectory: (armId, traj) =>
    set((s) => ({
      armTrajectories: { ...s.armTrajectories, [armId]: traj },
      armPlayheads: { ...s.armPlayheads, [armId]: 0 }
    })),
  setArmPlayhead: (armId, t) =>
    set((s) => ({
      armPlayheads: { ...s.armPlayheads, [armId]: t }
    })),
  setArmAttachedObject: (armId, objectId) =>
    set((s) => ({
      armAttachedObjects: { ...s.armAttachedObjects, [armId]: objectId },
      ...(s.selectedArmId === armId ? { attachedObjectId: objectId } : {})
    })),
  startSwarmSimulation: () =>
    set(() => ({
      isSwarmRunning: true,
      swarmPhase: 'SWARM_SYNCHRONIZED',
      armPlayheads: { 'arm-1': 0, 'arm-2': 0, 'arm-3': 0 }
    })),
  stopSwarmSimulation: () =>
    set(() => ({
      isSwarmRunning: false,
      swarmPhase: 'IDLE',
      armTrajectories: { 'arm-1': null, 'arm-2': null, 'arm-3': null }
    })),
  setSwarmPhase: (phase) => set({ swarmPhase: phase }),

  attachedObjectId: null,
  setAttachedObjectId: (id) =>
    set((s) => ({
      attachedObjectId: id,
      armAttachedObjects: { ...s.armAttachedObjects, [s.selectedArmId]: id }
    })),

  telemetry: null,
  setTelemetry: (tel) => set({ telemetry: tel }),

  pidGains: {
    kp: [24.0, 26.0, 22.0, 20.0, 18.0, 16.0],
    ki: [1.5, 1.8, 1.2, 1.0, 0.8, 0.6],
    kd: [4.2, 4.5, 3.8, 3.2, 2.8, 2.2],
    loadMass: 0.25
  },
  setPidGains: (gains) => set((s) => ({ pidGains: { ...s.pidGains, ...gains } })),

  // Diverse Industrial Objects for Multi-Arm Swarm Pick & Place
  pickPlaceTasks: [
    {
      id: 'task-1',
      name: 'Arm 1: Intake Machined Block',
      object_id: 'block-cyan',
      object_type: 'box',
      object_color: '#06b6d4',
      object_size: [0.06, 0.06, 0.06],
      pick_position: [-0.95, 0.12, 0.20],
      place_position: [-0.40, 0.12, 0.20],
      status: 'pending',
      progress: 0,
      assignedArmId: 'arm-1',
      mass: 0.25
    },
    {
      id: 'task-2',
      name: 'Arm 2: Assembly Hydraulic Canister',
      object_id: 'cyl-amber',
      object_type: 'cylinder',
      object_color: '#f59e0b',
      object_size: [0.035, 0.075, 0],
      pick_position: [-0.40, 0.12, 0.20],
      place_position: [0.40, 0.12, 0.20],
      status: 'pending',
      progress: 0,
      assignedArmId: 'arm-2',
      mass: 0.32
    },
    {
      id: 'task-3',
      name: 'Arm 3: Palletize Precision Sphere',
      object_id: 'sphere-emerald',
      object_type: 'sphere',
      object_color: '#10b981',
      object_size: [0.038, 0.038, 0.038],
      pick_position: [0.40, 0.12, 0.20],
      place_position: [0.85, 0.12, -0.20],
      status: 'pending',
      progress: 0,
      assignedArmId: 'arm-3',
      mass: 0.20
    },
    {
      id: 'task-4',
      name: 'Arm 2: Micro-Module Assembly',
      object_id: 'module-purple',
      object_type: 'box',
      object_color: '#a855f7',
      object_size: [0.05, 0.04, 0.06],
      pick_position: [0.0, 0.12, 0.28],
      place_position: [0.35, 0.12, 0.15],
      status: 'pending',
      progress: 0,
      assignedArmId: 'arm-2',
      mass: 0.18
    },
    {
      id: 'task-5',
      name: 'Arm 1: Titanium Power Cylinder',
      object_id: 'cyl-crimson',
      object_type: 'cylinder',
      object_color: '#ef4444',
      object_size: [0.03, 0.08, 0],
      pick_position: [-0.75, 0.12, -0.22],
      place_position: [-0.40, 0.12, 0.20],
      status: 'pending',
      progress: 0,
      assignedArmId: 'arm-1',
      mass: 0.30
    }
  ],
  currentTaskId: null,
  addTask: (task) => set((s) => ({ pickPlaceTasks: [...s.pickPlaceTasks, task] })),
  updateTask: (id, updates) =>
    set((s) => ({
      pickPlaceTasks: s.pickPlaceTasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
    })),
  removeTask: (id) =>
    set((s) => ({
      pickPlaceTasks: s.pickPlaceTasks.filter((t) => t.id !== id),
      currentTaskId: s.currentTaskId === id ? null : s.currentTaskId
    })),
  setCurrentTaskId: (id) => set({ currentTaskId: id }),

  automationSequences: [
    {
      id: 'seq-standard-inspection',
      name: 'Quality Inspection Sequence',
      description: 'Routine 4-point robotic inspection and return home',
      steps: [
        { id: 'step-1', type: 'home', name: 'Initialize Robot Home Pose', params: {} },
        { id: 'step-2', type: 'move_pose', name: 'Approach Inspection Station A', params: { position: [0.35, 0.45, 0.2] } },
        { id: 'step-3', type: 'wait', name: 'Optical Sensor Scan (1.5s)', params: { duration: 1.5 } },
        { id: 'step-4', type: 'move_pose', name: 'Shift to Inspection Station B', params: { position: [-0.3, 0.4, 0.25] } },
        { id: 'step-5', type: 'wait', name: 'Laser Profiler Scan (1.0s)', params: { duration: 1.0 } },
        { id: 'step-6', type: 'home', name: 'Safely Return Home', params: {} }
      ],
      status: 'idle'
    }
  ],
  activeSequence: null,
  currentStepIndex: 0,
  setActiveSequence: (seq) => set({ activeSequence: seq, currentStepIndex: 0 }),
  setCurrentStepIndex: (idx) => set({ currentStepIndex: idx }),
  saveSequence: (seq) =>
    set((s) => {
      const exists = s.automationSequences.some((item) => item.id === seq.id);
      return {
        automationSequences: exists
          ? s.automationSequences.map((item) => (item.id === seq.id ? seq : item))
          : [...s.automationSequences, seq]
      };
    }),

  benchmarkMetrics: [],
  setBenchmarkMetrics: (metrics) => set({ benchmarkMetrics: metrics }),
  simulationHistory: [],
  setSimulationHistory: (history) => set({ simulationHistory: history }),

  viewSettings: {
    showWorkspace: false,
    showWireframe: false,
    showAxes: true,
    showCollisionCapsules: false,
    cameraPreset: 'isometric'
  },
  toggleViewSetting: (key) =>
    set((s) => ({
      viewSettings: { ...s.viewSettings, [key]: !s.viewSettings[key] }
    })),
  setCameraPreset: (preset) =>
    set((s) => ({
      viewSettings: { ...s.viewSettings, cameraPreset: preset }
    })),

  notifications: [],
  addNotification: (text, type = 'info') => {
    const id = `notif-${Date.now()}-${Math.random()}`;
    set((s) => ({ notifications: [...s.notifications, { id, text, type }] }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 4500);
  },
  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
}));
