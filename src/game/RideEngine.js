import { RaftEngine } from './RaftEngine.js';
import { rideConfig } from '../config/rideConfig.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Driving has its own rules; the original raft keeps its previous handling.
// Reuses the fixed-step clock and bounded follower spring from RaftEngine.
export class RideEngine extends RaftEngine {
  constructor(config = rideConfig) { super(config); }

  reset() {
    super.reset();
    this.gasLeft = this.config.gas.start;
    this.gasTime = this.gasUsed = this.hitStop = this.impactX = 0;
    this.driftPoints = this.driftCount = this.bestCharge = 0;
    this.boostPower = 0;
    this.isDrifting = false;
    this.pickups = new Set();
    this.events = [];
    this.sector = 0;
    this.topSpeed = this.speed;
  }

  get driftTier() { return this.charge >= .95 ? 3 : this.charge >= .6 ? 2 : this.charge >= .28 ? 1 : 0; }
  emit(type, detail = {}) { this.events.push({ type, ...detail }); if (this.events.length > 8) this.events.shift(); }
  takeEvents() { return this.events.splice(0); }

  useGas() {
    if (this.state !== 'playing' || !this.gasLeft || this.gasTime > 0) return false;
    this.gasLeft--; this.gasUsed++;
    this.gasTime = this.config.gas.seconds;
    this.speed = Math.max(this.speed, this.config.speed + 3);
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    this.emit('gas');
    return true;
  }

  curvature(s) {
    const center = this.config.center;
    const angle = x => Math.atan((center(x + .5) - center(x - .5)));
    return (angle(s + 1) - angle(s - 1)) / 2;
  }

  step(dt, steer, brake) {
    const c = this.config, d = c.driving;
    this.elapsed += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hit = Math.max(0, this.hit - dt * 2.2);
    this.boost = Math.max(0, this.boost - dt);
    this.gasTime = Math.max(0, this.gasTime - dt);
    this.spinCooldown = Math.max(0, this.spinCooldown - dt);
    if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - dt); return; }

    const releaseTier = this.driftTier;
    if (!brake && this.braking) {
      if (releaseTier) {
        this.boost = .9 + releaseTier * .55;
        this.boostPower = d.boostSpeed * (.55 + releaseTier * .2);
        this.driftCount++;
        this.emit('boost', { tier: releaseTier });
      }
      this.charge = 0;
    }
    this.braking = brake;
    const headingTarget = steer * (brake ? d.driftTurn : d.turn);
    this.heading += (headingTarget - this.heading) * (1 - Math.exp(-dt * (brake ? 8 : 4.8)));
    const topSpeed = Math.min(c.maxSpeed, c.speed + (this.boost ? this.boostPower : 0) + (this.gasTime ? c.gas.speed : 0));
    const targetSpeed = (brake ? c.brakeSpeed : topSpeed) * (this.cooldown > .2 ? .68 : 1);
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt * d.acceleration));
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    const lateralTarget = Math.sin(this.heading) * this.speed * d.sidePower;
    this.velocity += (lateralTarget - this.velocity) * (1 - Math.exp(-dt * (brake ? d.driftGrip : d.grip)));
    // A bend pushes the vehicle toward the outside. Countersteer and braking
    // matter, while forgiving guardrails still let a first-time player finish.
    this.velocity -= this.curvature(this.progress) * this.speed ** 2 * d.curveForce * dt;
    this.drift = Math.sin(this.heading) * this.speed - this.velocity;
    const slip = Math.abs(this.heading - Math.atan2(this.velocity, this.speed));
    this.isDrifting = brake && Math.abs(steer) > .15 && this.speed > d.minDriftSpeed && slip > .08;
    if (this.isDrifting) {
      this.charge = Math.min(1, this.charge + dt * (.65 + Math.min(.35, slip)));
      this.bestCharge = Math.max(this.bestCharge, this.charge);
      this.driftPoints += this.speed * slip * dt * 18;
      if (this.driftTier === 3 && !this.spinCooldown) {
        this.spins++; this.spinCooldown = 4; this.emit('spin');
      }
    } else if (brake) this.charge = Math.max(0, this.charge - dt * .2);

    this.offset += this.velocity * dt;
    if (Math.abs(this.offset) > c.edge) {
      this.offset = clamp(this.offset, -c.edge, c.edge);
      this.bump('護欄', Math.sign(this.offset));
    }
    this.progress = Math.min(c.length, this.progress + this.speed * dt);
    for (const obstacle of c.obstacles) {
      if (Math.abs(this.progress - obstacle.s) < 1.8 && Math.abs(this.offset - obstacle.offset) < obstacle.radius + .9) {
        const direction = this.offset >= obstacle.offset ? 1 : -1;
        if (this.bump('路障', -direction)) this.velocity = direction * 3;
        this.offset = clamp(this.offset + direction * dt * 4, -c.edge, c.edge);
      }
    }
    c.stamps.forEach((stamp, i) => {
      if (!this.ink.has(i) && Math.abs(this.progress - stamp.s) < 1.5 && Math.abs(this.offset - stamp.offset) < 1.65) {
        this.ink.add(i); this.emit('ink');
      }
    });
    c.pickups.forEach((item, i) => {
      if (!this.pickups.has(i) && this.gasLeft < c.gas.capacity && Math.abs(this.progress - item.s) < 1.7 && Math.abs(this.offset - item.offset) < 1.9) {
        this.pickups.add(i); this.gasLeft++; this.emit('pickup');
      }
    });
    let sector = 0;
    c.sectors.forEach((item, i) => { if (this.progress >= item.s) sector = i; });
    if (sector !== this.sector) { this.sector = sector; this.emit('sector', { sector }); }
    this.updatePet(dt, brake);
    if (this.progress >= c.length) { this.state = 'won'; this.isDrifting = false; this.emit('finish'); }
  }

  bump(kind, direction = 1) {
    if (this.cooldown > 0) return false;
    this.cooldown = .95; this.hit = 1; this.hitStop = .06; this.impactX = direction;
    this.bumps++; this.speed = Math.max(5, this.speed * .6);
    this.velocity *= -.45;
    this.boost = this.gasTime = this.charge = 0;
    this.pet.vx -= direction * 4; this.pet.vz += 3;
    this.emit('collision', { kind });
    return true;
  }
}
