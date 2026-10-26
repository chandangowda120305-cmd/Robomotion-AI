import numpy as np
from typing import List, Tuple, Dict, Any, Optional


class RobotModel:
    """
    6-DOF Articulated Industrial Robotic Arm Model.
    Supports arbitrary world base position [bx, by, bz] and base yaw rotation.
    Coordinate system:
      - World Up: +Y
      - Ground plane: X-Z (floor at Y=0)
    Joints:
      - J1: Base Yaw (rotates around local Y)
      - J2: Shoulder Pitch (rotates around local Z)
      - J3: Elbow Pitch (rotates around local Z)
      - J4: Wrist Pitch (rotates around local Z)
      - J5: Wrist Yaw (rotates around local Y)
      - J6: Tool Roll (rotates around local Y / tool axis)
    """

    def __init__(self, base_position: Optional[List[float]] = None, base_yaw: float = 0.0):
        # Base offset in world coordinates
        self.base_position = np.array(base_position if base_position is not None else [0.0, 0.0, 0.0], dtype=float)
        self.base_yaw = float(base_yaw)

        # Link dimensions in meters
        self.base_height = 0.20
        self.link1_height = 0.15  # shoulder offset
        self.link2_len = 0.40     # upper arm
        self.link3_len = 0.35     # forearm
        self.link4_len = 0.12     # wrist 1
        self.link5_len = 0.10     # wrist 2
        self.tool_len = 0.12      # flange + gripper center

        # Joint limits in radians
        self.joint_limits_min = np.array([-np.pi, -2.356, -2.705, -np.pi, -np.pi, -2 * np.pi])
        self.joint_limits_max = np.array([np.pi, 2.356, 2.705, np.pi, np.pi, 2 * np.pi])

        # Joint names
        self.joint_names = [
            "Joint 1 (Base Yaw)",
            "Joint 2 (Shoulder Pitch)",
            "Joint 3 (Elbow Pitch)",
            "Joint 4 (Wrist 1 Pitch)",
            "Joint 5 (Wrist 2 Yaw)",
            "Joint 6 (Tool Flange Roll)"
        ]

        # Link capsule radii for collision geometry
        self.link_radii = [0.08, 0.07, 0.06, 0.05, 0.045, 0.04, 0.035]

    @staticmethod
    def rot_x(theta: float) -> np.ndarray:
        c, s = np.cos(theta), np.sin(theta)
        return np.array([
            [1.0, 0.0, 0.0, 0.0],
            [0.0, c,   -s,  0.0],
            [0.0, s,    c,  0.0],
            [0.0, 0.0, 0.0, 1.0]
        ], dtype=float)

    @staticmethod
    def rot_y(theta: float) -> np.ndarray:
        c, s = np.cos(theta), np.sin(theta)
        return np.array([
            [c,   0.0, s,   0.0],
            [0.0, 1.0, 0.0, 0.0],
            [-s,  0.0, c,   0.0],
            [0.0, 0.0, 0.0, 1.0]
        ], dtype=float)

    @staticmethod
    def rot_z(theta: float) -> np.ndarray:
        c, s = np.cos(theta), np.sin(theta)
        return np.array([
            [c,   -s,  0.0, 0.0],
            [s,    c,  0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ], dtype=float)

    @staticmethod
    def trans(x: float, y: float, z: float) -> np.ndarray:
        return np.array([
            [1.0, 0.0, 0.0, x],
            [0.0, 1.0, 0.0, y],
            [0.0, 0.0, 1.0, z],
            [0.0, 0.0, 0.0, 1.0]
        ], dtype=float)

    def forward_kinematics_transforms(self, q: np.ndarray, in_world: bool = False) -> List[np.ndarray]:
        """
        Calculates cumulative 4x4 transformation matrices for each joint and end-effector.
        Returns list of 8 matrices:
          0: Base Origin
          1: Joint 1 (Base Yaw)
          2: Joint 2 (Shoulder Pitch)
          3: Joint 3 (Elbow Pitch)
          4: Joint 4 (Wrist 1 Pitch)
          5: Joint 5 (Wrist 2 Yaw)
          6: Joint 6 (Tool Flange Roll)
          7: End-Effector / Gripper Tip
        """
        q = np.asarray(q, dtype=float)
        transforms = []

        # T0: Base origin
        if in_world:
            T0 = self.trans(*self.base_position) @ self.rot_y(self.base_yaw)
        else:
            T0 = np.eye(4, dtype=float)
        transforms.append(T0)

        # Joint 1: Base Yaw at height base_height
        T1 = T0 @ self.trans(0.0, self.base_height, 0.0) @ self.rot_y(q[0])
        transforms.append(T1)

        # Joint 2: Shoulder Pitch at height link1_height above J1
        T2 = T1 @ self.trans(0.0, self.link1_height, 0.0) @ self.rot_z(q[1])
        transforms.append(T2)

        # Joint 3: Elbow Pitch at distance link2_len along upper arm
        T3 = T2 @ self.trans(0.0, self.link2_len, 0.0) @ self.rot_z(q[2])
        transforms.append(T3)

        # Joint 4: Wrist 1 Pitch at distance link3_len along forearm
        T4 = T3 @ self.trans(0.0, self.link3_len, 0.0) @ self.rot_z(q[3])
        transforms.append(T4)

        # Joint 5: Wrist 2 Yaw at distance link4_len
        T5 = T4 @ self.trans(0.0, self.link4_len, 0.0) @ self.rot_y(q[4])
        transforms.append(T5)

        # Joint 6: Tool Flange Roll at distance link5_len
        T6 = T5 @ self.trans(0.0, self.link5_len, 0.0) @ self.rot_y(q[5])
        transforms.append(T6)

        # End Effector Tip at tool_len distance
        T_ee = T6 @ self.trans(0.0, self.tool_len, 0.0)
        transforms.append(T_ee)

        return transforms

    def forward_kinematics(self, q: np.ndarray, in_world: bool = False) -> Dict[str, Any]:
        """
        Computes forward kinematics returning EE position, orientation, and link frames.
        """
        transforms = self.forward_kinematics_transforms(q, in_world=in_world)
        T_ee = transforms[-1]

        pos_ee = T_ee[:3, 3].tolist()
        R_ee = T_ee[:3, :3]

        roll, pitch, yaw = self.matrix_to_euler_xyz(R_ee)
        quat = self.matrix_to_quaternion(R_ee)

        link_frames = []
        for i, T in enumerate(transforms):
            pos = T[:3, 3].tolist()
            R = T[:3, :3]
            r, p, y = self.matrix_to_euler_xyz(R)
            name = "Base" if i == 0 else (f"Joint {i}" if i <= 6 else "End Effector")
            link_frames.append({
                "joint_index": i,
                "name": name,
                "position": pos,
                "orientation": [r, p, y],
                "matrix": T.tolist()
            })

        return {
            "position": pos_ee,
            "orientation": [roll, pitch, yaw],
            "quaternion": quat.tolist(),
            "matrix": T_ee.tolist(),
            "link_frames": link_frames
        }

    def geometric_jacobian(self, q: np.ndarray, in_world: bool = False) -> np.ndarray:
        """
        Calculates 6x6 Geometric Jacobian matrix J(q) = [Jv; Jw].
        """
        transforms = self.forward_kinematics_transforms(q, in_world=in_world)
        p_ee = transforms[-1][:3, 3]

        J = np.zeros((6, 6), dtype=float)

        local_axes = [
            np.array([0.0, 1.0, 0.0]),
            np.array([0.0, 0.0, 1.0]),
            np.array([0.0, 0.0, 1.0]),
            np.array([0.0, 0.0, 1.0]),
            np.array([0.0, 1.0, 0.0]),
            np.array([0.0, 1.0, 0.0])
        ]

        for i in range(6):
            T_i = transforms[i + 1]
            p_i = T_i[:3, 3]
            R_i = T_i[:3, :3]
            z_i = R_i @ local_axes[i]
            z_i = z_i / (np.linalg.norm(z_i) + 1e-12)

            J[:3, i] = np.cross(z_i, p_ee - p_i)
            J[3:, i] = z_i

        return J

    @staticmethod
    def matrix_to_euler_xyz(R: np.ndarray) -> Tuple[float, float, float]:
        sy = np.sqrt(R[0, 0] * R[0, 0] + R[1, 0] * R[1, 0])
        singular = sy < 1e-6
        if not singular:
            x = np.arctan2(R[2, 1], R[2, 2])
            y = np.arctan2(-R[2, 0], sy)
            z = np.arctan2(R[1, 0], R[0, 0])
        else:
            x = np.arctan2(-R[1, 2], R[1, 1])
            y = np.arctan2(-R[2, 0], sy)
            z = 0.0
        return float(x), float(y), float(z)

    @staticmethod
    def euler_xyz_to_matrix(roll: float, pitch: float, yaw: float) -> np.ndarray:
        Rx = np.array([
            [1.0, 0.0, 0.0],
            [0.0, np.cos(roll), -np.sin(roll)],
            [0.0, np.sin(roll), np.cos(roll)]
        ])
        Ry = np.array([
            [np.cos(pitch), 0.0, np.sin(pitch)],
            [0.0, 1.0, 0.0],
            [-np.sin(pitch), 0.0, np.cos(pitch)]
        ])
        Rz = np.array([
            [np.cos(yaw), -np.sin(yaw), 0.0],
            [np.sin(yaw), np.cos(yaw), 0.0],
            [0.0, 0.0, 1.0]
        ])
        return Rz @ Ry @ Rx

    @staticmethod
    def matrix_to_quaternion(R: np.ndarray) -> np.ndarray:
        tr = R[0, 0] + R[1, 1] + R[2, 2]
        if tr > 0:
            S = np.sqrt(tr + 1.0) * 2
            w = 0.25 * S
            x = (R[2, 1] - R[1, 2]) / S
            y = (R[0, 2] - R[2, 0]) / S
            z = (R[1, 0] - R[0, 1]) / S
        elif (R[0, 0] > R[1, 1]) and (R[0, 0] > R[2, 2]):
            S = np.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2
            w = (R[2, 1] - R[1, 2]) / S
            x = 0.25 * S
            y = (R[0, 1] + R[1, 0]) / S
            z = (R[0, 2] + R[2, 0]) / S
        elif R[1, 1] > R[2, 2]:
            S = np.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2
            w = (R[0, 2] - R[2, 0]) / S
            x = (R[0, 1] + R[1, 0]) / S
            y = 0.25 * S
            z = (R[1, 2] + R[2, 1]) / S
        else:
            S = np.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2
            w = (R[1, 0] - R[0, 1]) / S
            x = (R[0, 2] + R[2, 0]) / S
            y = (R[1, 2] + R[2, 1]) / S
            z = 0.25 * S
        return np.array([x, y, z, w], dtype=float)

    def is_within_limits(self, q: np.ndarray) -> bool:
        return bool(np.all(q >= self.joint_limits_min - 1e-4) and np.all(q <= self.joint_limits_max + 1e-4))

    def clamp_to_limits(self, q: np.ndarray) -> np.ndarray:
        return np.clip(q, self.joint_limits_min, self.joint_limits_max)

    def get_link_segments(self, q: np.ndarray, in_world: bool = False) -> List[Tuple[np.ndarray, np.ndarray, float]]:
        """
        Returns line segments and capsule radii for all arm links in either local or world space.
        Each element is: (start_pt, end_pt, radius).
        """
        transforms = self.forward_kinematics_transforms(q, in_world=in_world)
        points = [T[:3, 3] for T in transforms]

        segments = [
            (points[0], points[1], self.link_radii[0]),
            (points[1], points[2], self.link_radii[1]),
            (points[2], points[3], self.link_radii[2]),
            (points[3], points[4], self.link_radii[3]),
            (points[4], points[5], self.link_radii[4]),
            (points[5], points[6], self.link_radii[5]),
            (points[6], points[7], self.link_radii[6])
        ]
        return segments

    def world_to_local_pos(self, p_world: np.ndarray) -> np.ndarray:
        """Transforms world position into robot local base coordinates."""
        p_world = np.asarray(p_world, dtype=float)
        p_rel = p_world - self.base_position
        if abs(self.base_yaw) > 1e-6:
            R_base = self.rot_y(self.base_yaw)[:3, :3]
            return R_base.T @ p_rel
        return p_rel

    def local_to_world_pos(self, p_local: np.ndarray) -> np.ndarray:
        """Transforms local robot base position into world coordinates."""
        p_local = np.asarray(p_local, dtype=float)
        if abs(self.base_yaw) > 1e-6:
            R_base = self.rot_y(self.base_yaw)[:3, :3]
            return self.base_position + (R_base @ p_local)
        return self.base_position + p_local
