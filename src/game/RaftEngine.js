import { raftConfig, riverCenter } from '../config/raftConfig.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const STEP = 1 / 120;

// A bounded spring tether, rather than general-purpose rigid-body physics.
// Fixed steps keep steering and collisions consistent at 30/60/120 Hz.
export class RaftEngine {
  constructor(config = raftConfig) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.elapsed = this.progress = this.offset = this.velocity = this.accumulator = 0;
    this.speed = this.config.speed;
    this.bumps = 0;
    this.cooldown = 0;
    this.hit = 0;
    this.ink = new Set();
    this.pet = { x: (this.config.center || riverCenter)(0), z: this.config.ropeLength, vx: 0, vz: 0 };
    this.event = null;
    this.heading = this.drift = this.boost = this.charge = this.spins = this.spinCooldown = 0;
    this.braking = false;
  }

  get x() { return (this.config.center || riverCenter)(this.progress) + this.offset; }
  get z() { return -this.progress; }

  start() { this.reset(); this.state = 'playing'; }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }

  update(delta, input = {}) {
    if (this.state !== 'playing' || !Number.isFinite(delta) || delta <= 0) return;
    // Discard a background / debugger stall instead of jumping through hazards.
    this.accumulator += Math.min(delta, .12);
    while (this.accumulator + 1e-10 >= STEP && this.state === 'playing') {
      this.step(STEP, clamp(Number(input.steer) || 0, -1, 1), !!input.brake);
      this.accumulator -= STEP;
    }
  }

  step(dt, steer, brake) {
    const c = this.config;
    this.elapsed += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hit = Math.max(0, this.hit - dt * 2);
    const driving = c.driving;
    this.boost = Math.max(0, this.boost - dt);
    this.spinCooldown = Math.max(0, this.spinCooldown - dt);
    if (driving) {
      if (brake && Math.abs(steer) > .1) this.charge = Math.min(1, this.charge + dt * .8);
      if (!brake && this.braking) {
        if (this.charge > .24) { this.boost = driving.boostSeconds; this.event = 'boost'; }
        this.charge = 0;
      }
      this.heading += (steer * driving.turn - this.heading) * (1 - Math.exp(-dt * (brake ? 5 : 3.5)));
    }
    this.braking = brake;
    const targetSpeed = (brake ? c.brakeSpeed : c.speed + (this.boost ? driving?.boostSpeed || 0 : 0)) * (this.cooldown > .6 ? .58 : 1);
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt * (driving?.acceleration || 4)));
    const targetVelocity = driving ? Math.sin(this.heading) * this.speed : steer * (brake ? 4 : 5.8);
    this.velocity += (targetVelocity - this.velocity) * (1 - Math.exp(-dt * (driving ? brake ? driving.driftGrip : driving.grip : 4.5)));
    this.drift = driving ? Math.sin(this.heading) * this.speed - this.velocity : 0;
    if (driving && brake && Math.abs(this.drift) > 2 && !this.spinCooldown) {
      this.spins++; this.spinCooldown = 4; this.event = 'spin';
    }
    this.offset += this.velocity * dt;
    if (Math.abs(this.offset) > c.edge) {
      this.offset = clamp(this.offset, -c.edge, c.edge);
      this.velocity *= -.3;
      this.bump(driving ? '護欄' : '岸邊');
    }
    this.progress = Math.min(c.length, this.progress + this.speed * dt);

    for (const obstacle of c.obstacles) {
      if (Math.abs(this.progress - obstacle.s) < 1.3 && Math.abs(this.offset - obstacle.offset) < obstacle.radius + .7) {
        this.bump(driving ? '路障' : '木樁');
        // A forgiving bounce: no permanent collision trap in this prototype.
        this.offset = clamp(this.offset + (this.offset >= obstacle.offset ? 1 : -1) * dt * 5, -c.edge, c.edge);
      }
    }
    c.stamps.forEach((stamp, i) => {
      if (!this.ink.has(i) && Math.abs(this.progress - stamp.s) < 1.2 && Math.abs(this.offset - stamp.offset) < 1.45) {
        this.ink.add(i);
        this.event = 'ink';
      }
    });

    this.updatePet(dt, brake);
    if (this.progress >= c.length) { this.state = 'won'; this.event = 'finish'; }
  }

  updatePet(dt, brake) {
    const c = this.config;
    const pet = this.pet;
    const tx = this.x, tz = this.z + (brake ? c.ropeLength * .68 : c.ropeLength);
    pet.vx += ((tx - pet.x) * 8 - pet.vx * 2.6) * dt;
    pet.vz += ((tz - pet.z) * 8 - pet.vz * 2.6) * dt;
    pet.x += pet.vx * dt;
    pet.z += pet.vz * dt;
    const dx = pet.x - tx, dz = pet.z - this.z, length = Math.hypot(dx, dz);
    if (length > c.maxRopeLength) {
      pet.x = tx + dx / length * c.maxRopeLength;
      pet.z = this.z + dz / length * c.maxRopeLength;
      // Remove outward velocity so tension cannot build unbounded energy.
      const radial = Math.max(0, (pet.vx * dx + (pet.vz + this.speed) * dz) / length);
      pet.vx -= radial * dx / length;
      pet.vz -= radial * dz / length;
    }
  }

  bump(kind) {
    if (this.cooldown > 0) return;
    this.cooldown = 1.15;
    this.hit = 1;
    this.bumps++;
    this.event = kind;
  }
}
