import { MathUtils, Quaternion, Vector3 } from 'three';

const ease = (value) => MathUtils.smoothstep(value, 0, 1);
const REST_ROTATION = [0, 0, 0];

// Runtime pose offsets only: never edit the GLB or rebuild its skeleton.
export class IdleController {
  constructor(gltf, config, bounds) {
    this.config = config;
    this.time = 0;
    this.playing = true;
    this.nextBlink = config.blinkIntervalMin;
    this.blinkTime = null;
    this.gestureTime = null;
    this.gaze = { targetX: 0, targetY: 0, eyeX: 0, eyeY: 0, headX: 0, headY: 0 };
    this.nextGaze = config.gazeIntervalMin;
    this.eyes = [];
    this.body = [];
    this.face = [];
    this.height = bounds ? bounds.max.y - bounds.min.y : 1;
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
      this.spine = { ...this.createPose(spine), scale: spine.scale.clone() };
      this.head = this.createPose(head);
      this.eyes = [find('faceLfIrisJoint_').parent, find('faceRtIrisJoint_').parent].map((bone) => this.createPose(bone));
      this.body.push({ name: 'spine', pose: this.spine });
      for (const [name, id] of Object.entries(config.bodyNodes)) {
        const bone = byNode(id);
        if (bone) this.body.push({ name, pose: this.createPose(bone) });
      }
      const hips = byNode(config.hipsNode);
      if (hips) this.hips = this.createPosition(hips);
      for (const bone of bones) {
        const brow = bone.name.match(/^brow(Lf|Rt)0([1-5])Joint_/);
        const mouth = bone.name.match(/lip([LR])(?:dn|up)1Joint/);
        const cheek = bone.name.match(/^face(Lf|Rt)CheekOtUpJoint_/);
        if (brow || mouth || cheek) this.face.push({
          ...this.createPosition(bone), role: brow ? 'brow' : mouth ? 'mouth' : 'cheek',
          side: (brow?.[1] || cheek?.[1] || mouth?.[1]).startsWith('L') ? 'Left' : 'Right',
          fraction: brow ? (Number(brow[2]) - 1) / 4 : 0,
        });
      }
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

  createPosition(bone) {
    const inverse = bone.parent.matrixWorld.clone().invert();
    const origin = new Vector3().applyMatrix4(inverse);
    return {
      bone, rest: bone.position.clone(),
      x: new Vector3(1, 0, 0).applyMatrix4(inverse).sub(origin),
      y: new Vector3(0, 1, 0).applyMatrix4(inverse).sub(origin),
      z: new Vector3(0, 0, 1).applyMatrix4(inverse).sub(origin),
    };
  }

  applyBody(mood, amount) {
    if (!amount && !this.bodyActive) return;
    for (const { name, pose } of this.body) {
      const angles = mood?.body[name] || REST_ROTATION;
      const mirror = name === 'spine' ? this.awaySign : 1;
      this.applyPose(pose, angles[0] * amount, angles[1] * amount * mirror, angles[2] * amount * mirror);
    }
    if (this.hips) {
      const move = mood?.hips || REST_ROTATION;
      this.hips.bone.position.copy(this.hips.rest)
        .addScaledVector(this.hips.x, move[0] * amount * this.height * this.awaySign)
        .addScaledVector(this.hips.y, move[1] * amount * this.height)
        .addScaledVector(this.hips.z, move[2] * amount * this.height);
    }
    this.bodyActive = amount > 0;
  }

  applyFace(mood, amount) {
    for (const item of this.face) {
      let offset = 0;
      if (item.role === 'brow') {
        const shape = mood?.face[`brow${item.side}`] || REST_ROTATION;
        offset = MathUtils.lerp(shape[0], shape[1], item.fraction) * amount;
        if (this.playing) offset += Math.max(0, Math.sin(this.time * 0.6)) * this.config.idleBrowLift * (1 - amount);
      } else if (item.role === 'mouth') offset = (mood?.face[`mouth${item.side}`] || 0) * amount;
      else offset = (mood?.face.cheek || 0) * amount;
      item.bone.position.copy(item.rest).addScaledVector(item.y, offset * this.height);
    }
  }

  playGesture(cameraPosition, kind = 'cold') {
    if (!this.head || this.gestureTime !== null || !Object.hasOwn(this.config.gestures, kind)) return false;
    this.gestureKind = kind;
    this.gesturePose = {};
    this.head.bone.getWorldPosition(this.lookDirection);
    this.lookDirection.subVectors(cameraPosition, this.lookDirection);
    this.gestureYaw = MathUtils.clamp(Math.atan2(this.lookDirection.x, this.lookDirection.z), -this.config.gestureYawLimit, this.config.gestureYawLimit);
    this.gesturePitch = MathUtils.clamp(-Math.atan2(this.lookDirection.y, Math.hypot(this.lookDirection.x, this.lookDirection.z)), -this.config.gesturePitchLimit, this.config.gesturePitchLimit);
    this.awaySign = this.gestureYaw >= 0 ? -1 : 1;
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
    let pitch = 0;
    let yaw = 0;
    let roll = 0;
    let eyeYaw = 0;
    let gestureBlink = 0;
    let bodyAmount = 0;
    let faceAmount = 0;
    const mood = this.gestureTime !== null ? c.gestures[this.gestureKind] : null;
    if (mood) {
      this.gestureTime += delta;
      const t = Math.min(1, this.gestureTime / mood.duration);
      envelope = ease(t / 0.14) * ease((1 - t) / 0.18);
      const frames = mood.frames;
      const index = frames.findIndex((frame) => frame.time >= t);
      const b = frames[Math.max(index, 1)];
      const a = frames[Math.max(index - 1, 0)];
      const blend = ease((t - a.time) / (b.time - a.time));
      for (const key of ['yaw', 'pitch', 'roll', 'eyeYaw', 'lid', 'viewer', 'body', 'face']) this.gesturePose[key] = MathUtils.lerp(a[key], b[key], blend);
      const pose = this.gesturePose;
      pitch = pose.pitch + this.gesturePitch * pose.viewer;
      yaw = pose.yaw * this.awaySign + this.gestureYaw * pose.viewer;
      roll = pose.roll * this.awaySign;
      eyeYaw = pose.eyeYaw * this.awaySign;
      bodyAmount = pose.body * envelope;
      faceAmount = pose.face * envelope;
      gestureBlink = pose.lid * envelope;
      if (t > 0.82 && t < 0.88) gestureBlink = Math.max(gestureBlink, Math.sin(Math.PI * (t - 0.82) / 0.06) ** 2);
      if (t >= 1) this.gestureTime = null;
    }
    this.applyBody(mood, bodyAmount);
    this.applyFace(mood, faceAmount);
    this.applyPose(this.head,
      gaze.headY * c.headPitch * (1 - envelope) + pitch * envelope,
      gaze.headX * c.headYaw * (1 - envelope) + yaw * envelope,
      -gaze.headX * c.headTilt * (1 - envelope) + roll * envelope);
    for (const eye of this.eyes) this.applyPose(eye, gaze.eyeY * c.eyePitch * (1 - envelope), gaze.eyeX * c.eyeYaw * (1 - envelope) + eyeYaw * envelope);
    if (this.playing && this.gestureTime === null && this.blinkTime === null && this.time >= this.nextBlink) this.blinkTime = 0;
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
      this.applyBody(null, 0);
      this.applyFace(null, 0);
    }
  }

  dispose() { this.setPlaying(false); this.eyelids = []; }
}
