import * as THREE from 'three';
import { Pose, LinkFrame } from '../types';

export class ClientRobotKinematics {
  // Dimensions in meters (matching backend RobotModel)
  static baseHeight = 0.20;
  static link1Height = 0.15;
  static link2Len = 0.40;
  static link3Len = 0.35;
  static link4Len = 0.12;
  static link5Len = 0.10;
  static toolLen = 0.12;

  // Joint limits in radians
  static jointLimitsMin = [-Math.PI, -2.356, -2.705, -Math.PI, -Math.PI, -2 * Math.PI];
  static jointLimitsMax = [Math.PI, 2.356, 2.705, Math.PI, Math.PI, 2 * Math.PI];

  static jointNames = [
    'Joint 1 (Base Yaw)',
    'Joint 2 (Shoulder Pitch)',
    'Joint 3 (Elbow Pitch)',
    'Joint 4 (Wrist 1 Pitch)',
    'Joint 5 (Wrist 2 Yaw)',
    'Joint 6 (Tool Flange Roll)'
  ];

  /**
   * Computes transformation matrices for all 8 frames:
   * 0: Base Origin
   * 1: Joint 1 (Base Yaw)
   * 2: Joint 2 (Shoulder Pitch)
   * 3: Joint 3 (Elbow Pitch)
   * 4: Joint 4 (Wrist 1 Pitch)
   * 5: Joint 5 (Wrist 2 Yaw)
   * 6: Joint 6 (Tool Flange Roll)
   * 7: End-Effector Tip
   */
  static computeTransforms(q: number[]): THREE.Matrix4[] {
    const transforms: THREE.Matrix4[] = [];

    // T0: Base
    const T0 = new THREE.Matrix4().identity();
    transforms.push(T0.clone());

    // Joint 1: Base Yaw (rotates around Y) at baseHeight
    const T1 = T0.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, this.baseHeight, 0))
      .multiply(new THREE.Matrix4().makeRotationY(q[0]));
    transforms.push(T1);

    // Joint 2: Shoulder Pitch (rotates around Z) at link1Height above J1
    const T2 = T1.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, this.link1Height, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(q[1]));
    transforms.push(T2);

    // Joint 3: Elbow Pitch (rotates around Z) at link2Len along upper arm
    const T3 = T2.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, this.link2Len, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(q[2]));
    transforms.push(T3);

    // Joint 4: Wrist 1 Pitch (rotates around Z) at link3Len along forearm
    const T4 = T3.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, this.link3Len, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(q[3]));
    transforms.push(T4);

    // Joint 5: Wrist 2 Yaw (rotates around Y) at link4Len
    const T5 = T4.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, this.link4Len, 0))
      .multiply(new THREE.Matrix4().makeRotationY(q[4]));
    transforms.push(T5);

    // Joint 6: Tool Flange Roll (rotates around Y) at link5Len
    const T6 = T5.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, this.link5Len, 0))
      .multiply(new THREE.Matrix4().makeRotationY(q[5]));
    transforms.push(T6);

    // End Effector Tip
    const T_ee = T6.clone().multiply(new THREE.Matrix4().makeTranslation(0, this.toolLen, 0));
    transforms.push(T_ee);

    return transforms;
  }

  static computeFK(q: number[]): {
    endEffectorPose: Pose;
    linkFrames: LinkFrame[];
  } {
    const transforms = this.computeTransforms(q);
    const T_ee = transforms[transforms.length - 1];

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    T_ee.decompose(pos, quat, scale);

    const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');

    const linkFrames: LinkFrame[] = transforms.map((T, idx) => {
      const p = new THREE.Vector3();
      const q_rot = new THREE.Quaternion();
      const s = new THREE.Vector3();
      T.decompose(p, q_rot, s);
      const eu = new THREE.Euler().setFromQuaternion(q_rot, 'XYZ');

      const matArray: number[][] = [];
      const el = T.elements;
      for (let r = 0; r < 4; r++) {
        matArray.push([el[r], el[r + 4], el[r + 8], el[r + 12]]);
      }

      return {
        joint_index: idx,
        name: idx === 0 ? 'Base' : idx <= 6 ? `Joint ${idx}` : 'End Effector',
        position: [p.x, p.y, p.z],
        orientation: [eu.x, eu.y, eu.z],
        matrix: matArray
      };
    });

    const matArray: number[][] = [];
    const el = T_ee.elements;
    for (let r = 0; r < 4; r++) {
      matArray.push([el[r], el[r + 4], el[r + 8], el[r + 12]]);
    }

    return {
      endEffectorPose: {
        position: [pos.x, pos.y, pos.z],
        orientation: [euler.x, euler.y, euler.z],
        quaternion: [quat.x, quat.y, quat.z, quat.w],
        matrix: matArray
      },
      linkFrames
    };
  }
}
