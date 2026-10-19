import { MathUtils, Quaternion, Vector3 } from 'three';

const ease = (value) => MathUtils.smoothstep(value, 0, 1);

// Runtime pose offsets only: never edit the GLB or rebuild its skeleton.
export class IdleController {
  constructor(gltf, config) {
    this.config = config;
    this.time = 0;
    this.playing = true;
    this.nextBlink = config.blinkIntervalMin;
    this.blinkTime = null;
    this.gestureTime = null;
    this.gaze = { targetX: 0, targetY: 0, eyeX: 0, eyeY: 0, headX: 0, headY: 0 };
    this.nextGaze = config.gazeIntervalMin;
    this.eyes = [];
    this.eyelids = [];
    const bones = [];
    gltf.scene.traverse((node) => { if (node.isBone) bones.push(node); });
    const find = (prefix) => bones.find((bone) => bone.name.startsWith(prefix));
    // This profile is enabled only for the supplied Si rig, with matching eyelids.
    for (const side of ['Lf', 'Rt']) {
      for (const [upperIndex, lowerIndex] of [['02', '08'], ['03', '07'], ['04', '06']]) {
        const upper = find(`eye${side}${upperIndex}Joint_`);
        const lower = find(`eye${side}${lowerIndex}Joint_`);
        if (!upper || !lower || upper.parent !== lower.parent) continue;
        const upperRest = upper.position.clone();
        const lowerRest = lower.position.clone();
        const meeting = upperRest.clone().lerp(lowerRest, config.upperLidShare);
        // Preserve the horizontal spacing; close along the face's local Y/Z plane.
        this.eyelids.push({ bone: upper, rest: upperRest, target: new Vector3(upperRest.x, meeting.y, meeting.z) });
        this.eyelids.push({ bone: lower, rest: lowerRest, target: new Vector3(lowerRest.x, meeting.y, meeting.z) });
      }
    }
    this.supported = this.eyelids.length === 12 && !!find('faceLfIrisJoint_') && !!find('faceRtIrisJoint_');
    if (!this.supported) { this.eyelids = []; return; }
    // The FBX export lost several bone labels; resolve these through glTF node IDs,
    // then validate the known Si hierarchy rather than guessing on uploaded rigs.
    const byNode = (id) => bones.find((bone) => gltf.parser.associations.get(bone)?.nodes === id);
    const spine = byNode(config.spineNode);
    const head = byNode(config.headNode);
    if (spine && head && head.children.some((node) => node.name.startsWith('faceLfIrisJoint_') || node.children.some((child) => child.name.startsWith('faceLfIrisJoint_')))) {
      this.spine = { bone: spine, scale: spine.scale.clone() };
      this.head = this.createPose(head);
      this.eyes = [find('faceLfIrisJoint_').parent, find('faceRtIrisJoint_').parent].map((bone) => this.createPose(bone));
    }
    this.offset = new Quaternion();
    this.axisOffset = new Quaternion();
    this.lookDirection = new Vector3();
  }

  setBlink(amount) {
    for (const { bone, rest, target } of this.eyelids) bone.position.lerpVectors(rest, target, amount);
  }

  createPose(bone) {
    const inverse = bone.getWorldQuaternion(new Quaternion()).invert();
    return {
      bone, quaternion: bone.quaternion.clone(),
      x: new Vector3(1, 0, 0).applyQuaternion(inverse),
      y: new Vector3(0, 1, 0).applyQuaternion(inverse),
      z: new Vector3(0, 0, 1).applyQuaternion(inverse),
    };
  }

  applyPose(pose, pitch, yaw, roll = 0) {
    if (!pose) return;
    this.offset.setFromAxisAngle(pose.x, pitch);
    this.offset.multiply(this.axisOffset.setFromAxisAngle(pose.y, yaw));
    this.offset.multiply(this.axisOffset.setFromAxisAngle(pose.z, roll));
    pose.bone.quaternion.copy(pose.quaternion).multiply(this.offset);
  }

  playGesture(cameraPosition) {
    if (!this.head || this.gestureTime !== null) return false;
    this.head.bone.getWorldPosition(this.lookDirection);
    this.lookDirection.subVectors(cameraPosition, this.lookDirection);
    this.gestureYaw = MathUtils.clamp(Math.atan2(this.lookDirection.x, this.lookDirection.z), -this.config.gestureYawLimit, this.config.gestureYawLimit);
    this.gesturePitch = MathUtils.clamp(-Math.atan2(this.lookDirection.y, Math.hypot(this.lookDirection.x, this.lookDirection.z)), -this.config.gesturePitchLimit, this.config.gesturePitchLimit);
    this.gestureTime = 0;
    return true;
  }

  update(delta) {
    if (!this.supported || (!this.playing && this.gestureTime === null)) return;
    const c = this.config;
    if (this.playing) {
      this.time += delta;
      if (this.time >= this.nextGaze) {
        // A glance, a pause, then return to center; avoid perpetual oscillation.
        const returning = this.gaze.targetX !== 0 || this.gaze.targetY !== 0;
        this.gaze.targetX = returning ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6);
        this.gaze.targetY = returning ? 0 : Math.random() * 0.6 - 0.3;
        this.nextGaze = this.time + c.gazeIntervalMin + Math.random() * (c.gazeIntervalMax - c.gazeIntervalMin);
      }
    }
    const gaze = this.gaze;
    const eyeAlpha = 1 - Math.exp(-delta * c.eyeResponse);
    const headAlpha = 1 - Math.exp(-delta * c.headResponse);
    gaze.eyeX = MathUtils.lerp(gaze.eyeX, gaze.targetX, eyeAlpha);
    gaze.eyeY = MathUtils.lerp(gaze.eyeY, gaze.targetY, eyeAlpha);
    gaze.headX = MathUtils.lerp(gaze.headX, gaze.targetX, headAlpha);
    gaze.headY = MathUtils.lerp(gaze.headY, gaze.targetY, headAlpha);
    const breath = this.playing ? Math.sin(this.time * Math.PI * 2 / c.breathPeriod) : 0;
    if (this.spine) {
      this.spine.bone.scale.copy(this.spine.scale);
      this.spine.bone.scale.y *= 1 + breath * c.breathAmount;
    }
    let envelope = 0;
    let nod = 0;
    let gestureBlink = 0;
    if (this.gestureTime !== null) {
      this.gestureTime += delta;
      const t = this.gestureTime / c.gestureDuration;
      envelope = ease(t / 0.22) * ease((1 - t) / 0.25);
      if (t > 0.38 && t < 0.75) nod = Math.sin(Math.PI * (t - 0.38) / 0.37) * c.gestureNod;
      if (t > 0.25 && t < 0.33) gestureBlink = Math.sin(Math.PI * (t - 0.25) / 0.08) ** 2;
      if (t >= 1) this.gestureTime = null;
    }
    this.applyPose(this.head,
      gaze.headY * c.headPitch * (1 - envelope) + (this.gesturePitch || 0) * envelope + nod,
      gaze.headX * c.headYaw * (1 - envelope) + (this.gestureYaw || 0) * envelope,
      -gaze.headX * c.headTilt * (1 - envelope) + c.gestureTilt * envelope);
    for (const eye of this.eyes) this.applyPose(eye, gaze.eyeY * c.eyePitch * (1 - envelope), gaze.eyeX * c.eyeYaw * (1 - envelope));
    if (this.playing && this.blinkTime === null && this.time >= this.nextBlink) this.blinkTime = 0;
    let blink = 0;
    if (this.blinkTime !== null) {
      this.blinkTime += delta;
      const t = this.blinkTime / c.blinkDuration;
      blink = t < 1 ? Math.sin(Math.PI * t) ** 2 : 0;
      if (t >= 1) {
        this.blinkTime = null;
        this.nextBlink = this.time + c.blinkIntervalMin + Math.random() * (c.blinkIntervalMax - c.blinkIntervalMin);
      }
    }
    this.setBlink(Math.max(blink, gestureBlink));
  }

  setPlaying(playing) {
    this.playing = playing;
    this.gestureTime = null;
    this.blinkTime = null;
    for (const key of Object.keys(this.gaze)) this.gaze[key] = 0;
    this.nextGaze = this.time + this.config.gazeIntervalMin;
    this.nextBlink = this.time + this.config.blinkIntervalMin;
    this.setBlink(0);
    if (!playing) {
      if (this.spine) this.spine.bone.scale.copy(this.spine.scale);
      if (this.head) this.head.bone.quaternion.copy(this.head.quaternion);
      for (const eye of this.eyes) eye.bone.quaternion.copy(eye.quaternion);
    }
  }

  dispose() { this.setPlaying(false); this.eyelids = []; }
}
