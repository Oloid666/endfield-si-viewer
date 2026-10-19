import { MathUtils, Quaternion, Vector3 } from 'three';

const ease = (value) => MathUtils.smoothstep(value, 0, 1);
const REST_ROTATION = [0, 0, 0];

// Cubic Hermite curves pass through a continuing motion without stopping at
// every key. At a change of direction the tangent is zero to avoid extra overshoot.
function sampleTrack(points, time, key = 1) {
  const at = (p) => p.time ?? p[0];
  const value = (p) => p[key];
  if (time <= at(points[0])) return value(points[0]);
  const last = points.length - 1;
  if (time >= at(points[last])) return value(points[last]);
  const end = points.findIndex((p) => at(p) > time);
  const a = points[end - 1], b = points[end];
  const span = at(b) - at(a);
  const tangent = (i) => {
    if (i === 0 || i === last) return 0;
    const before = (value(points[i]) - value(points[i - 1])) / (at(points[i]) - at(points[i - 1]));
    const after = (value(points[i + 1]) - value(points[i])) / (at(points[i + 1]) - at(points[i]));
    return before * after <= 0 ? 0 : Math.sign(before) * Math.min(Math.abs(before), Math.abs(after));
  };
  const t = (time - at(a)) / span, t2 = t * t, t3 = t2 * t;
  return (2*t3 - 3*t2 + 1)*value(a) + (t3 - 2*t2 + t)*span*tangent(end - 1)
    + (-2*t3 + 3*t2)*value(b) + (t3 - t2)*span*tangent(end);
}

// Runtime pose offsets only: never edit the GLB or rebuild its skeleton.
export class IdleController {
  constructor(gltf, config, bounds) {
    this.config = config;
    this.time = 0;
    this.awaySign = 1;
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
    // A relaxed baseline is part of the viewer pose, not a change to the asset.
    this.applyBody(null, 0);
    this.transitionBones = [...new Set([
      ...this.body.map(({ pose }) => pose.bone), this.hips?.bone, this.head?.bone,
      ...this.eyes.map(({ bone }) => bone), ...this.face.map(({ bone }) => bone),
      ...this.eyelids.map(({ bone }) => bone),
    ].filter(Boolean))];
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

  applyBody(mood, time) {
    const c = this.config;
    const curves = mood ? c.gestureTiming[this.gestureKind] : null;
    const breath = this.playing ? Math.sin(this.time * Math.PI * 2 / c.breathPeriod) : 0;
    for (const { name, pose } of this.body) {
      const rest = c.restBody[name] || REST_ROTATION;
      const target = mood?.body[name] || rest;
      const amount = curves ? sampleTrack(curves[c.bodyTiming[name]], time) : 0;
      const mirror = name === 'spine' && mood ? this.awaySign : 1;
      // Chest and shoulders breathe with different phase; hands stay settled.
      const chest = name === 'spine' ? breath * 0.004 : 0;
      this.applyPose(pose,
        MathUtils.lerp(rest[0], target[0], amount) + chest,
        MathUtils.lerp(rest[1], target[1] * mirror, amount),
        MathUtils.lerp(rest[2], target[2] * mirror, amount));
    }
    if (this.hips) {
      const amount = curves ? sampleTrack(curves.hips, time) : 0;
      const move = mood?.hips || REST_ROTATION;
      this.hips.bone.position.copy(this.hips.rest)
        .addScaledVector(this.hips.x, move[0] * amount * this.height * this.awaySign)
        .addScaledVector(this.hips.y, move[1] * amount * this.height)
        .addScaledVector(this.hips.z, move[2] * amount * this.height);
    }
  }

  beginTransition(duration) {
    this.transition = {
      time: 0, duration,
      poses: this.transitionBones.map((bone) => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() })),
    };
  }

  blendTransition(delta) {
    const transition = this.transition;
    if (!transition) return;
    transition.time += delta;
    const amount = ease(transition.time / transition.duration);
    for (const { bone, position, quaternion, scale } of transition.poses) {
      bone.position.lerp(position, 1 - amount);
      bone.quaternion.slerp(quaternion, 1 - amount);
      bone.scale.lerp(scale, 1 - amount);
    }
    if (amount === 1) this.transition = null;
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
    this.beginTransition(this.config.transitionDuration);
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
    if (!this.supported || (!this.playing && this.gestureTime === null && !this.transition)) return;
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
    let gestureProgress = 0;
    let faceAmount = 0;
    const mood = this.gestureTime !== null ? c.gestures[this.gestureKind] : null;
    if (mood) {
      this.gestureTime += delta;
      const t = Math.min(1, this.gestureTime / mood.duration);
      envelope = ease(t / 0.14) * ease((1 - t) / 0.18);
      gestureProgress = t;
      for (const key of ['yaw', 'pitch', 'roll', 'eyeYaw', 'lid', 'viewer', 'face']) {
        this.gesturePose[key] = sampleTrack(mood.frames, t, key);
      }
      const pose = this.gesturePose;
      pitch = pose.pitch + this.gesturePitch * pose.viewer;
      yaw = pose.yaw * this.awaySign + this.gestureYaw * pose.viewer;
      roll = pose.roll * this.awaySign;
      eyeYaw = pose.eyeYaw * this.awaySign;
      faceAmount = pose.face * envelope;
      gestureBlink = pose.lid * envelope;
      // Blink on the decisive head turn, rather than an arbitrary end-of-clip timer.
      for (const center of c.gestureBlinks[this.gestureKind]) {
        const blinkPhase = (t - center) * mood.duration / c.blinkDuration + 0.5;
        if (blinkPhase > 0 && blinkPhase < 1) gestureBlink = Math.max(gestureBlink, Math.sin(Math.PI * blinkPhase) ** 2);
      }
      if (t >= 1) this.gestureTime = null;
    }
    this.applyBody(mood, gestureProgress);
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
    this.blendTransition(delta);
  }

  setPlaying(playing) {
    if (this.transitionBones) this.beginTransition(this.config.transitionDuration);
    this.playing = playing;
    this.gestureTime = null;
    this.blinkTime = null;
    for (const key of Object.keys(this.gaze)) this.gaze[key] = 0;
    this.nextGaze = this.time + this.config.gazeIntervalMin;
    this.nextBlink = this.time + this.config.blinkIntervalMin;
  }

  dispose() {
    // Release offsets immediately when replacing the model, without a blend.
    for (const { pose } of this.body) pose.bone.quaternion.copy(pose.quaternion);
    if (this.hips) this.hips.bone.position.copy(this.hips.rest);
    if (this.spine) this.spine.bone.scale.copy(this.spine.scale);
    if (this.head) this.head.bone.quaternion.copy(this.head.quaternion);
    for (const eye of this.eyes) eye.bone.quaternion.copy(eye.quaternion);
    for (const item of this.face) item.bone.position.copy(item.rest);
    this.setBlink(0);
    this.transition = null;
    this.transitionBones = [];
    this.eyelids = [];
  }
}
