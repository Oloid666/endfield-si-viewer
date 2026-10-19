import { Quaternion, Vector3 } from 'three';

// Runtime pose offsets only: never edit the GLB or rebuild its skeleton.
export class IdleController {
  constructor(gltf, config) {
    this.config = config;
    this.time = 0;
    this.playing = true;
    this.nextBlink = config.blinkIntervalMin;
    this.blinkTime = null;
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
      this.head = { bone: head, quaternion: head.quaternion.clone() };
    }
    this.offset = new Quaternion();
    this.headAxis = new Vector3(0, 0, 1);
  }

  setBlink(amount) {
    for (const { bone, rest, target } of this.eyelids) bone.position.lerpVectors(rest, target, amount);
  }

  update(delta) {
    if (!this.supported || !this.playing) return;
    this.time += delta;
    const breath = Math.sin(this.time * Math.PI * 2 / this.config.breathPeriod);
    if (this.spine) {
      this.spine.bone.scale.copy(this.spine.scale);
      this.spine.bone.scale.y *= 1 + breath * this.config.breathAmount;
    }
    if (this.head) {
      this.offset.setFromAxisAngle(this.headAxis, Math.sin(this.time * Math.PI * 2 / this.config.headPeriod) * this.config.headAngle);
      this.head.bone.quaternion.copy(this.head.quaternion).multiply(this.offset);
    }
    if (this.blinkTime === null && this.time >= this.nextBlink) this.blinkTime = 0;
    if (this.blinkTime !== null) {
      this.blinkTime += delta;
      const t = this.blinkTime / this.config.blinkDuration;
      this.setBlink(t < 1 ? Math.sin(Math.PI * t) ** 2 : 0);
      if (t >= 1) {
        this.blinkTime = null;
        this.nextBlink = this.time + this.config.blinkIntervalMin + Math.random() * (this.config.blinkIntervalMax - this.config.blinkIntervalMin);
      }
    }
  }

  setPlaying(playing) {
    this.playing = playing;
    this.blinkTime = null;
    this.nextBlink = this.time + this.config.blinkIntervalMin;
    this.setBlink(0);
    if (!playing) {
      if (this.spine) this.spine.bone.scale.copy(this.spine.scale);
      if (this.head) this.head.bone.quaternion.copy(this.head.quaternion);
    }
  }

  dispose() { this.setPlaying(false); this.eyelids = []; }
}
