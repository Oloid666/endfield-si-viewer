import { MathUtils, Quaternion, Vector3 } from 'three';
import { LimbSolver } from './LimbSolver.js';
import { LeekProp } from './LeekProp.js';
import { FaceController } from './FaceController.js';
import { GazeController } from './GazeController.js';
import { BrushDrawing } from './BrushDrawing.js';
import { LeekChorus } from './LeekChorus.js';
import { InkStage } from './InkStage.js';
import { leekBeat, reverseBeat, ramp } from './actionTimeline.js';
import { ReverseLeekController } from './ReverseLeekController.js';

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
  constructor(gltf, config, bounds, actor = gltf.scene, faceConfig = null, gazeConfig = null, photographyConfig = null) {
    this.config = config;
    this.photographyConfig = photographyConfig;
    this.time = 0;
    this.awaySign = 1;
    this.playing = true;
    this.nextBlink = config.blinkIntervalMin;
    this.blinkTime = null;
    this.gestureTime = null;
    this.reverseChoice = null;
    this.rescueTime = null;
    this.photoLean = 0;
    this.dialogueReaction = null;
    this.gaze = { targetX: 0, targetY: 0, eyeX: 0, eyeY: 0, headX: 0, headY: 0 };
    this.nextGaze = config.gazeIntervalMin;
    this.eyes = [];
    this.body = [];
    this.face = [];
    this.fingers = [];
    this.neutralRotation = new Quaternion();
    this.root = gltf.scene;
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
    const profileNodes = [...Object.values(config.bodyNodes), ...Object.values(config.fingerNodes).flat(2), config.hipsNode, config.spineNode, config.headNode];
    if (profileNodes.some((id) => !byNode(id))) { this.supported = false; this.eyelids = []; return; }
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
      this.arms = {};
      this.legs = {};
      for (const side of ['L', 'R']) {
        const arm = byNode(config.bodyNodes[`arm${side}`]), elbow = byNode(config.bodyNodes[`elbow${side}`]), wrist = byNode(config.bodyNodes[`wrist${side}`]);
        this.arms[side] = new LimbSolver(arm, elbow, wrist);
        const thigh = byNode(config.bodyNodes[`thigh${side}`]), knee = byNode(config.bodyNodes[`knee${side}`]), foot = byNode(config.bodyNodes[`foot${side}`]);
        this.legs[side] = { solver: new LimbSolver(thigh,knee,foot), anchor: foot.getWorldPosition(new Vector3()), rotation: foot.getWorldQuaternion(new Quaternion()) };
        const chains = config.fingerNodes[side === 'L' ? 'left' : 'right'];
        const across = byNode(chains[0][0]).getWorldPosition(new Vector3()).sub(byNode(chains[3][0]).getWorldPosition(new Vector3())).normalize();
        for(const chain of chains)for(const [segment,id] of chain.entries()) {
          const bone=byNode(id);this.fingers.push({bone,rest:bone.quaternion.clone(),side,segment,axis:across.clone().applyQuaternion(bone.getWorldQuaternion(new Quaternion()).invert())});
        }
        this.arms[side].fingerDirection = byNode(chains[1][0]).getWorldPosition(new Vector3()).sub(wrist.getWorldPosition(new Vector3())).normalize().applyQuaternion(wrist.getWorldQuaternion(new Quaternion()).invert());
      }
      this.leek = new LeekProp(this.arms.R.end,byNode(config.fingerNodes.right[1][0]),gltf.scene.parent || gltf.scene,this.height,config.prop);
      for (const bone of bones) {
        const brow = bone.name.match(/^brow(Line)?(Lf|Rt)0([1-5])Joint_/);
        const mouth = bone.name.match(/lip([LR])(dn|up)([1-4])Joint/);
        const cheek = bone.name.match(/^face(Lf|Rt)CheekOtUpJoint_/);
        if (brow || mouth || cheek) this.face.push({
          ...this.createPosition(bone), role: brow ? 'brow' : mouth ? 'mouth' : 'cheek',
          side: (brow?.[2] || cheek?.[1] || mouth?.[1]).startsWith('L') ? 'Left' : 'Right',
          fraction: brow ? (Number(brow[3]) - 1) / (brow[1] ? 2 : 4) : mouth ? (Number(mouth[3])-1)/4 : 0,
        });
      }
    }
    if (this.arms) {
      this.reverse = new ReverseLeekController(actor,this.arms.R.end,bounds,this.height,config.reverse,config.prop);
      this.drawing=new BrushDrawing(this.reverse.stage,bounds,this.height,config.drawing,config.prop,config.reverse,this.leek.textures[0]||null);
      this.chorus = new LeekChorus(this.reverse.stage,bounds,this.height,config.chorus,config.prop);
      this.inkStage = new InkStage(this.reverse.stage,bounds,this.height,config.theater,this.leek.textures[0]||null);
    }
    if (this.head && faceConfig && gazeConfig) {
      this.expression = new FaceController(faceConfig);
      this.look = new GazeController(this.head.bone, gazeConfig);
    }
    this.offset = new Quaternion();
    this.axisOffset = new Quaternion();
    this.lookDirection = new Vector3();
    this.desiredDirection = new Vector3();
    this.target = new Vector3(); this.pole = new Vector3(); this.anchor = new Vector3();
    this.direction = new Vector3(); this.worldRotation = new Quaternion(); this.parentRotation = new Quaternion();
    // A relaxed baseline is part of the viewer pose, not a change to the asset.
    this.applyBody(null, 0);
    this.transitionBones = [...new Set([
      ...this.body.map(({ pose }) => pose.bone), this.hips?.bone, this.head?.bone,
      ...this.eyes.map(({ bone }) => bone), ...this.face.map(({ bone }) => bone), ...this.fingers.map(({bone})=>bone),
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
      const track = curves?.[c.bodyTiming[name]];
      const amount = track ? sampleTrack(track, time) : 0;
      const mirror = name === 'spine' && mood ? this.awaySign : 1;
      // Chest and shoulders breathe with different phase; hands stay settled.
      const chest = name === 'spine' ? breath * 0.004 : 0;
      this.applyPose(pose,
        MathUtils.lerp(rest[0], target[0], amount) + chest,
        MathUtils.lerp(rest[1], target[1] * mirror, amount),
        MathUtils.lerp(rest[2], target[2] * mirror, amount));
    }
    if (this.hips) {
      const amount = curves?.hips ? sampleTrack(curves.hips, time) : 0;
      const move = mood?.hips || REST_ROTATION;
      this.hips.bone.position.copy(this.hips.rest)
        .addScaledVector(this.hips.x, move[0] * amount * this.height * this.awaySign)
        .addScaledVector(this.hips.y, move[1] * amount * this.height)
        .addScaledVector(this.hips.z, move[2] * amount * this.height);
    }
  }

  pointFromHips(offset, out) {
    this.hips.bone.getWorldPosition(out);
    return out.addScaledVector(this.target.set(...offset), this.height);
  }

  orientHand(arm, direction, amount) {
    this.desiredDirection.copy(direction);
    arm.end.getWorldQuaternion(this.worldRotation);
    this.direction.copy(arm.fingerDirection).applyQuaternion(this.worldRotation).normalize();
    this.offset.setFromUnitVectors(this.direction,this.desiredDirection);
    this.offset.slerp(this.neutralRotation,1-amount).multiply(this.worldRotation);
    arm.end.parent.getWorldQuaternion(this.parentRotation).invert();
    arm.end.quaternion.copy(this.parentRotation.multiply(this.offset)).normalize();
  }

  reachHand(side, offset, poleOffset, amount) {
    const arm=this.arms[side];
    arm.end.getWorldPosition(this.anchor);
    this.pointFromHips(offset,this.pole);
    this.anchor.lerp(this.pole,amount);
    this.pointFromHips(poleOffset,this.pole);
    arm.solve(this.anchor,this.pole);
    this.orientHand(arm,this.direction.set(0,-1,.12).normalize(),amount);
  }

  reachWorldHand(side,target,amount=1){
    const arm=this.arms[side];arm.end.getWorldPosition(this.anchor);this.anchor.lerp(target,amount);
    this.pointFromHips(this.config.drawing.penPole,this.pole);arm.solve(this.anchor,this.pole);
    this.orientHand(arm,this.direction.set(0,1,.2).normalize(),amount);
  }
  applyDrawing(kind,seconds){
    const weight=ramp(seconds,0,.45)*(1-ramp(seconds,this.config.drawing.smallEnd,this.config.drawing.takeEnd));
    const amount=kind==='reverse'?ramp(seconds,0,.45)*(1-ramp(seconds,this.config.reverse.beats.grab,this.config.reverse.beats.swing)):weight;
    this.drawing.getHandTarget(kind,seconds,this.target);this.reachWorldHand('R',this.target,amount);
    this.reachHand('L',this.config.action.waistHands[0],this.config.action.elbowPoles[0],amount);
    for(const finger of this.fingers)finger.bone.quaternion.copy(finger.rest).multiply(this.axisOffset.setFromAxisAngle(finger.axis,(finger.side==='R'?.85:.2)*amount));
    this.plantFeet();
  }

  plantFeet(lift=0, forward=0, lateral=0) {
    for(const side of ['L','R']) {
      const {solver,anchor,rotation}=this.legs[side];
      this.anchor.copy(anchor);
      if(side==='R'){this.anchor.y+=lift*this.height;this.anchor.z+=forward*this.height;this.anchor.x+=lateral*this.height;}
      solver.upper.getWorldPosition(this.pole);this.pole.z+=this.height;
      solver.solve(this.anchor,this.pole);
      solver.end.parent.getWorldQuaternion(this.parentRotation).invert();
      solver.end.quaternion.copy(this.parentRotation.multiply(rotation));
    }
  }

  applyActing(progress) {
    if(progress>=1)return;
    const c=this.config, curves=c.gestureTiming.tsundere;
    const hands=sampleTrack(curves.hands,progress), stomp=sampleTrack(curves.stomp,progress), impact=sampleTrack(curves.impact,progress);
    const boost = this.expression?.bodyBoost || 0;
    const action = c.action, extra = action.stompExtra;
    const lift = action.stompLift + boost*extra.lift;
    const forward = action.stompForward + boost*extra.forward;
    const impactDepth = action.stompImpact + boost*extra.impact;
    this.hips.bone.position
      .addScaledVector(this.hips.x, stomp*this.height*(action.stompHipShift+boost*extra.hipShift))
      .addScaledVector(this.hips.y, -this.height*(Math.max(0,impact)*impactDepth+stomp*action.stompCrouch));
    this.offset.setFromAxisAngle(this.spine.x, stomp*action.stompTorsoPitch*(1+boost*.4)+impact*impactDepth);
    this.offset.multiply(this.axisOffset.setFromAxisAngle(this.spine.z, stomp*action.stompTorsoRoll));
    this.spine.bone.quaternion.multiply(this.offset);
    const after = action.aftershock;
    const recoil = after ? Math.max(0,Math.sin((progress-after.start)*Math.PI*after.frequency))
      * ramp(progress,after.start,after.start+.015)*(1-ramp(progress,after.end-.025,after.end)) : 0;
    this.spine.bone.quaternion.multiply(this.axisOffset.setFromAxisAngle(this.spine.z,recoil*(after?.torso||0)));
    this.reachHand('L',c.action.waistHands[0],c.action.elbowPoles[0],hands);
    this.reachHand('R',c.action.waistHands[1],c.action.elbowPoles[1],hands);
    this.plantFeet(stomp*lift+recoil*(after?.lift||0),stomp*forward);
    for(const finger of this.fingers)finger.bone.quaternion.copy(finger.rest).multiply(this.axisOffset.setFromAxisAngle(finger.axis,.22*hands));
  }

  applyLeekDance(seconds,weight) {
    const c=this.config, beat=leekBeat(seconds,c.leekStory), phase=(seconds-c.leekStory.beats.dance)*Math.PI*2/c.action.leekCycle;
    const swing=Math.sin(phase)*beat.amplitude*beat.dance, bounce=Math.cos(phase*2)*beat.dance;
    this.applyPose(this.spine,.025+.025*bounce,.065*swing,.055*swing);
    this.hips.bone.position.addScaledVector(this.hips.x,.014*this.height*swing*weight).addScaledVector(this.hips.y,-.004*this.height*(1-bounce)*weight);
    this.reachHand('L',c.action.waistHands[0],c.action.elbowPoles[0],weight);
    const hand=[...c.action.leekHand];hand[0]+=c.action.leekSwing*swing*2.1;hand[1]+=.045*bounce;
    hand[0]+=.08*Math.sin(seconds*4)*beat.draw; hand[1]+=.065*Math.cos(seconds*4)*beat.draw;
    hand[2]+=.09*beat.show;
    this.reachHand('R',hand,[-.34,.19,.12],weight);
    const wrist=this.body.find(part=>part.name==='wristR').pose;
    // Wrist-local offsets follow the moving arm instead of moving the prop alone.
    this.offset.setFromAxisAngle(wrist.z,-c.action.leekTilt*swing*weight);
    wrist.bone.quaternion.multiply(this.offset);
    this.plantFeet(Math.max(0,swing)*.018,Math.max(0,swing)*.045,swing*.025);
    for(const finger of this.fingers){const curl=(finger.side==='R'?.95:.22)*weight;
      finger.bone.quaternion.copy(finger.rest).multiply(this.axisOffset.setFromAxisAngle(finger.axis,curl*(finger.segment===0?.7:1)));
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

  applyFace(mood, amount, progress = 0, userWeight = 1) {
    const acting = mood && this.gestureKind==='tsundere';
    for (const item of this.face) {
      let offset = 0;
      if (item.role === 'brow') {
        const shape = mood?.face[`brow${item.side}`] || REST_ROTATION;
        offset = acting ? sampleTrack(mood.frames,progress,`brow${item.side}`) * amount * (1 - item.fraction*.25)
          : mood && !acting ? .0007*amount*(item.side==='Left'?1:.6) : MathUtils.lerp(shape[0], shape[1], item.fraction) * amount;
        if (this.playing) offset += Math.max(0, Math.sin(this.time * 0.6)) * this.config.idleBrowLift * (1 - amount);
      } else if (item.role === 'mouth') offset = acting ? sampleTrack(mood.frames,progress,`mouth${item.side}`)*amount : mood && !acting ? .00085*amount : 0;
      else offset = acting ? sampleTrack(mood.frames,progress,'cheek')*amount : mood && !acting ? .0004*amount : 0;
      if (mood && this.gestureKind==='reverse') {
        const surprised=this.gestureTime<this.config.reverse.beats.rest;
        offset=(item.role==='brow'?(surprised?.0014:-.0013):item.role==='mouth'?-.0007:.0003)*amount;
      }
      if(item.role==='mouth') offset *= 1-item.fraction;
      const deflated = !mood && this.dialogueReaction?.selection === 'proud';
      if (this.expression) offset += this.expression.offset(item.role, item.side, item.fraction) * userWeight * (deflated && item.role === 'mouth' ? .1 : 1);
      item.bone.position.copy(item.rest).addScaledVector(item.y, offset * this.height);
    }
  }

  playGesture(cameraPosition, kind = 'tsundere') {
    if (!this.head || this.gestureTime !== null || this.reverse?.landing || this.rescueTime !== null || !Object.hasOwn(this.config.gestures, kind)) return false;
    this.beginTransition(this.config.transitionDuration);
    this.gestureKind = kind;
    this.gesturePose = {};
    this.head.bone.getWorldPosition(this.lookDirection);
    this.lookDirection.subVectors(cameraPosition, this.lookDirection);
    this.gestureYaw = MathUtils.clamp(Math.atan2(this.lookDirection.x, this.lookDirection.z), -this.config.gestureYawLimit, this.config.gestureYawLimit);
    this.gesturePitch = MathUtils.clamp(-Math.atan2(this.lookDirection.y, Math.hypot(this.lookDirection.x, this.lookDirection.z)), -this.config.gesturePitchLimit, this.config.gesturePitchLimit);
    this.awaySign = this.gestureYaw >= 0 ? -1 : 1;
    this.gestureTime = 0;
    this.reverseChoice = null;
    this.photoLean = 0;
    if(kind==='reverse')this.reverse.start();
    return true;
  }

  update(delta, cameraPosition) {
    if (!this.supported) return;
    // Hold the complete authored pose indefinitely; rendering and camera remain live.
    if (this.reverseChoice === 'pending') return;
    if (this.gestureKind === 'reverse' && this.gestureTime !== null && this.reverseChoice === null && this.gestureTime + delta >= this.config.reverse.choiceAt) {
      delta = Math.max(0,this.config.reverse.choiceAt-this.gestureTime);
      this.reverseChoice = 'pending';
    }
    if (this.rescueTime !== null) {
      this.rescueTime += delta;
      if (this.rescueTime >= this.config.reverse.rescueDuration) this.rescueTime = null;
    }
    this.expression?.update(delta);
    const tracking = this.look?.update(delta, cameraPosition);
    const c = this.config;
    if (this.playing) {
      this.time += delta;
      if ((!this.look || this.look.mode === 'idle') && this.time >= this.nextGaze) {
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
    let loopWeight = 0;
    const mood = this.gestureTime !== null ? c.gestures[this.gestureKind] : null;
    if (mood) {
      this.gestureTime += delta;
      const t = mood.loop ? (this.gestureTime % mood.duration) / mood.duration : Math.min(1, this.gestureTime / mood.duration);
      loopWeight = mood.loop ? ease(this.gestureTime / c.transitionDuration) : 0;
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
      if (!mood.loop && t >= 1) this.gestureTime = null;
    }
    this.applyBody(mood, gestureProgress);
    for(const finger of this.fingers)finger.bone.quaternion.copy(finger.rest);
    if (mood && this.gestureKind === 'tsundere') this.applyActing(gestureProgress);
    if (mood && this.gestureKind === 'leek') {
      const seconds=this.gestureTime ?? mood.duration, beat=leekBeat(seconds,c.leekStory);
      loopWeight=beat.fade;
      this.applyLeekDance(seconds,loopWeight);
      if(seconds<c.drawing.takeEnd){
        this.applyDrawing('leek',seconds);
        if(seconds>=c.drawing.smallEnd){
          this.drawing.origin('leek',this.target);this.reachWorldHand('R',this.target,ramp(seconds,c.drawing.smallEnd,c.drawing.takeEnd));
        }
      }
      const phase=(seconds-c.leekStory.beats.dance)*Math.PI*2/c.action.leekCycle;
      envelope=loopWeight; faceAmount=.9*loopWeight;
      pitch=-.06*beat.show+.04*beat.dance*Math.cos(phase*2);
      yaw=.1*Math.sin(phase*.5)*beat.dance-.45*beat.peek;
      roll=.12*Math.sin(phase)*beat.dance+.1*beat.show;
      eyeYaw=-.15*beat.peek;gestureBlink=.3*beat.show;
    }
    if (mood && this.gestureKind === 'reverse') {
      const seconds=this.gestureTime ?? mood.duration, beat=reverseBeat(seconds,c.reverse);
      const phase=(seconds-c.reverse.beats.swing)*Math.PI*2/c.reverse.cycle;
      loopWeight=ramp(seconds,0,.5)*(1-ramp(seconds,c.reverse.beats.fade,mood.duration));
      envelope=loopWeight;faceAmount=loopWeight;
      this.applyPose(this.body.find(p=>p.name==='armR').pose,0,0,-1.65*beat.attached);
      this.applyPose(this.body.find(p=>p.name==='elbowR').pose,-.12*beat.attached,.1*beat.attached,0);
      this.applyPose(this.body.find(p=>p.name==='armL').pose,-.3*beat.attached,.1*beat.attached,(.6+.35*Math.sin(phase))*beat.attached);
      this.applyPose(this.body.find(p=>p.name==='thighL').pose,.3*Math.sin(phase)*beat.attached,0,0);
      this.applyPose(this.body.find(p=>p.name==='kneeL').pose,(.4+.25*Math.sin(phase+1))*beat.attached,0,0);
      this.applyPose(this.body.find(p=>p.name==='kneeR').pose,(.4+.3*Math.sin(phase))*beat.attached,0,0);
      pitch=-.08*beat.attached; yaw=-.45*(1-beat.attached)*beat.limbs;roll=-.17*Math.sin(phase)*beat.attached;
      eyeYaw=-.15*(1-beat.attached);gestureBlink=0;
      if(seconds<c.reverse.beats.swing)this.applyDrawing('reverse',seconds);
      if(seconds>=c.reverse.beats.stare&&seconds<c.reverse.beats.grab){pitch=0;yaw=-.45;roll=0;eyeYaw=-.15;}

    }
    this.applyFace(mood, faceAmount, gestureProgress, 1-envelope);
    const photo = mood ? 0 : this.photoLean;
    if (photo > .001 && this.photographyConfig) {
      this.spine.bone.quaternion.multiply(this.axisOffset.setFromAxisAngle(this.spine.x,this.photographyConfig.leanPitch*photo));
      this.hips.bone.position.addScaledVector(this.hips.z,-this.photographyConfig.leanOffset*this.height*photo);
      this.plantFeet();
    }
    const useTracking = this.look && this.look.mode !== 'idle';
    let baseHeadPitch = useTracking ? tracking.headPitch : gaze.headY*c.headPitch;
    let baseHeadYaw = useTracking ? tracking.headYaw : gaze.headX*c.headYaw;
    baseHeadPitch += photo*.08;
    if (!mood && this.rescueTime !== null) baseHeadYaw += .25*ramp(this.rescueTime,.5,1.5);
    if (!mood && this.dialogueReaction) {
      baseHeadYaw += this.dialogueReaction.selection === 'surprised' ? -.2 : .1;
      baseHeadPitch += this.dialogueReaction.selection === 'proud' ? .08 : 0;
    }
    const baseEyePitch = useTracking ? tracking.eyePitch : gaze.eyeY*c.eyePitch;
    const baseEyeYaw = useTracking ? tracking.eyeYaw : gaze.eyeX*c.eyeYaw;
    const expressionHead = this.expression?.values;
    this.applyPose(this.head,
      (baseHeadPitch + (expressionHead?.headPitch || 0)) * (1 - envelope) + pitch * envelope,
      (baseHeadYaw + (expressionHead?.headYaw || 0)) * (1 - envelope) + yaw * envelope,
      ((useTracking ? -baseHeadYaw*.2 : -gaze.headX*c.headTilt) + (expressionHead?.headRoll || 0)) * (1 - envelope) + roll * envelope);
    for (const eye of this.eyes) this.applyPose(eye, baseEyePitch * (1 - envelope), baseEyeYaw * (1 - envelope) + eyeYaw * envelope);
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
    const expressionLid = (this.dialogueReaction?.selection === 'proud' && !mood ? 0 : this.expression?.values.lid || 0) * (1-envelope);
    this.setBlink(MathUtils.lerp(expressionLid, 1, Math.max(blink, gestureBlink)));
    this.blendTransition(delta);
    if(mood && this.gestureKind==='reverse' && this.gestureTime===null){this.reverse.update(mood.duration,0);this.reverse.stop();}
    this.reverse?.update(this.gestureTime ?? mood?.duration ?? 0, delta);
    const paintingKind=this.gestureTime!==null?this.gestureKind:'';
    const paintingTime=this.gestureTime||0;
    this.drawing?.update(paintingKind,paintingTime,delta,this.arms.R.end,this.reverse);
    const leekActive=!!mood && this.gestureKind==='leek' && this.gestureTime!==null && this.gestureTime>=c.drawing.revealEnd;
    const leekState=leekBeat(this.gestureTime || 0,c.leekStory);
    const tilt=-c.action.leekTilt*Math.sin(((this.gestureTime || 0)-c.leekStory.beats.dance)*Math.PI*2/c.action.leekCycle)*leekState.dance*leekState.amplitude + .3*leekState.peek;
    if(leekActive&&paintingTime<c.drawing.takeEnd)this.leek.alpha=1;
    this.leek?.update(leekActive,delta,c.action.leekFade,tilt);
    if(leekActive){this.drawing.origin('leek',this.target);this.leek.placeAt(this.target,1-ramp(paintingTime,c.drawing.revealEnd,c.drawing.takeEnd));}
    else this.leek?.placeAt(this.target,0);
    const seconds=this.gestureTime || 0;
    const peekStart=c.leekStory.beats.peek;
    const expression=leekActive && leekState.peek>.1 ? seconds<peekStart+.55?'peek':'dead' : 'hidden';
    const lateCowlick=leekActive && seconds>c.leekStory.beats.pose && seconds<peekStart+.4;
    this.leek?.perform(seconds,expression,leekState.dance || (lateCowlick?1:0));
    this.chorus?.update(leekActive,seconds,delta,c.action.leekCycle);
    this.arms.R.end.getWorldPosition(this.target);this.legs.R.solver.end.getWorldPosition(this.anchor);
    this.inkStage?.update(this.gestureTime===null?'':this.gestureKind,this.gestureTime || 0,this.target,this.anchor,this.reverse,delta,cameraPosition);
  }

  stopGesture() {
    this.reverseChoice = null;
    if (this.rescueTime !== null) { this.rescueTime = null; return true; }
    if(this.gestureTime === null)return false;
    this.beginTransition(this.gestureKind==='reverse'?this.config.reverse.landing:this.config.transitionDuration);
    this.reverse?.stop();
    this.gestureTime = null;
    return true;
  }

  chooseReverse(choice) {
    if (this.reverseChoice !== 'pending' || !['rescue','extend'].includes(choice)) return false;
    if (choice === 'rescue') { this.stopGesture(); this.rescueTime = 0; }
    this.reverseChoice = choice;
    return true;
  }

  setPlaying(playing) {
    this.reverseChoice = null; this.rescueTime = null;
    this.reverse?.stop();
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
    this.drawing?.dispose();
    this.chorus?.dispose();
    this.inkStage?.dispose();
    this.reverse?.dispose();
    this.leek?.dispose();
    for(const finger of this.fingers)finger.bone.quaternion.copy(finger.rest);
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
