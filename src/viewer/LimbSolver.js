import { MathUtils, Quaternion, Vector3 } from 'three';

// Analytic two-bone reach. The pole chooses the elbow/knee direction; no iterative
// physics or skeleton rebuilding. Intermediate twist nodes remain in the chain.
export class LimbSolver {
  constructor(upper, lower, end) {
    this.upper = upper; this.lower = lower; this.end = end;
    this.a = new Vector3(); this.b = new Vector3(); this.c = new Vector3();
    upper.getWorldPosition(this.a); lower.getWorldPosition(this.b); end.getWorldPosition(this.c);
    this.lengthA = this.a.distanceTo(this.b); this.lengthB = this.b.distanceTo(this.c);
    this.direction = new Vector3(); this.bend = new Vector3(); this.elbow = new Vector3();
    this.from = new Vector3(); this.to = new Vector3();
    this.rotation = new Quaternion(); this.world = new Quaternion(); this.parent = new Quaternion();
  }

  rotateToward(bone, end, target) {
    bone.getWorldPosition(this.a); end.getWorldPosition(this.b);
    this.from.subVectors(this.b, this.a).normalize();
    this.to.subVectors(target, this.a).normalize();
    this.rotation.setFromUnitVectors(this.from, this.to);
    bone.getWorldQuaternion(this.world);
    bone.parent.getWorldQuaternion(this.parent).invert();
    bone.quaternion.copy(this.parent.multiply(this.rotation.multiply(this.world))).normalize();
    bone.updateWorldMatrix(false, true);
  }

  solve(target, pole) {
    this.upper.getWorldPosition(this.a);
    this.direction.subVectors(target, this.a);
    const distance = MathUtils.clamp(this.direction.length(), Math.abs(this.lengthA - this.lengthB) + 1e-5, this.lengthA + this.lengthB - 1e-5);
    this.direction.normalize();
    this.bend.subVectors(pole, this.a).addScaledVector(this.direction, -this.bend.dot(this.direction)).normalize();
    const along = (this.lengthA**2 - this.lengthB**2 + distance**2) / (2 * distance);
    const height = Math.sqrt(Math.max(0, this.lengthA**2 - along**2));
    this.elbow.copy(this.a).addScaledVector(this.direction, along).addScaledVector(this.bend, height);
    this.rotateToward(this.upper, this.lower, this.elbow);
    this.rotateToward(this.lower, this.end, target);
  }
}
