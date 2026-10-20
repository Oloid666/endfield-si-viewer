import { MathUtils, Vector3 } from 'three';

const MODES = ['idle', 'camera', 'point', 'off'];

// World-space attention targets; eyes move first, then the head catches up.
// Limits are anatomical offsets from the original forward-facing Si pose.
export class GazeController {
  constructor(head, config) {
    this.head = head;
    this.config = config;
    this.mode = 'idle';
    this.point = null;
    this.origin = new Vector3();
    this.direction = new Vector3();
    this.angles = { eyeYaw: 0, eyePitch: 0, headYaw: 0, headPitch: 0 };
  }

  setMode(mode) {
    if (!MODES.includes(mode)) return false;
    this.mode = mode;
    this.point = null;
    return true;
  }

  setPoint(point) {
    if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return false;
    this.point ||= new Vector3();
    this.point.copy(point);
    return true;
  }

  update(delta, cameraPosition) {
    const c = this.config, a = this.angles;
    const target = this.mode === 'point' ? this.point || cameraPosition : this.mode === 'camera' ? cameraPosition : null;
    let yaw = 0, pitch = 0;
    if (target) {
      this.head.getWorldPosition(this.origin);
      this.direction.subVectors(target, this.origin);
      if (this.direction.lengthSq() > 1e-10) {
        yaw = MathUtils.clamp(Math.atan2(this.direction.x, this.direction.z), -c.headYawLimit-c.eyeYawLimit, c.headYawLimit+c.eyeYawLimit);
        pitch = MathUtils.clamp(-Math.atan2(this.direction.y, Math.hypot(this.direction.x, this.direction.z)), -c.headPitchLimit-c.eyePitchLimit, c.headPitchLimit+c.eyePitchLimit);
      }
    }
    const headAlpha = 1 - Math.exp(-Math.max(0, delta) * c.headResponse);
    const eyeAlpha = 1 - Math.exp(-Math.max(0, delta) * c.eyeResponse);
    a.headYaw = MathUtils.lerp(a.headYaw, MathUtils.clamp(yaw*c.headShare, -c.headYawLimit, c.headYawLimit), headAlpha);
    a.headPitch = MathUtils.lerp(a.headPitch, MathUtils.clamp(pitch*c.headShare, -c.headPitchLimit, c.headPitchLimit), headAlpha);
    a.eyeYaw = MathUtils.lerp(a.eyeYaw, MathUtils.clamp(yaw-a.headYaw, -c.eyeYawLimit, c.eyeYawLimit), eyeAlpha);
    a.eyePitch = MathUtils.lerp(a.eyePitch, MathUtils.clamp(pitch-a.headPitch, -c.eyePitchLimit, c.eyePitchLimit), eyeAlpha);
    return a;
  }
}
