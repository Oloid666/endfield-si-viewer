import { RaftEngine } from './RaftEngine.js';
import { rideConfig, zhuangRideConfig, rivalRideConfig } from '../config/rideConfig.js';
import { flightHeight, takeoverBlend, zhuangPhase, zhuangRace } from './ZhuangRaceStory.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Driving has its own rules; the original raft keeps its previous handling.
// Reuses the fixed-step clock and bounded follower spring from RaftEngine.
export class RideEngine extends RaftEngine {
  constructor(config = rideConfig) { super(config); this.baseConfig = config; }

  setCharacter(character) { this.character = character === 'zhuang' ? 'zhuang' : 'si'; this.config = this.isZhuang ? zhuangRideConfig : this.baseConfig; this.reset(); }
  get isZhuang() { return this.character === 'zhuang'; }
  get flying() { return this.isZhuang && this.flightStarted !== null; }
  get timeScale() { return this.isZhuang && this.takeoffPending ? zhuangRace.decisionScale : 1; }
  get prizeRemaining() { return this.prizeDeadline === null ? null : Math.max(0, this.prizeDeadline - this.prizeClock); }
  setOpponent(enabled) {
    this.rivalEnabled = !!enabled;
    this.rival = { enabled: this.isZhuang && !!enabled, progress: 0, speed: rivalRideConfig.introSpeed, offset: -rivalRideConfig.lane, clock: 0,
      finished: false, finishTime: null, burst: 0, nextBurst: zhuangRace.raceAt + 1, bursts: 0, cornering: false,
      lead: 0, nextQuip: zhuangRace.raceAt + 5, reactionUntil: 0, reaction: null, near: false };
  }
  get height() { return this.flying ? flightHeight(this.elapsed - this.flightStarted) : 0; }


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
    this.storyPhase = this.isZhuang ? 'drag' : null;
    this.lastStoryPhase = null; this.flightStarted = null; this.takeoffPending = false;
    this.prizeClock = 0; this.prizeDeadline = null; this.outcome = null;
    this.setOpponent(this.rivalEnabled); this.steerHeld = this.lastSteer = 0;
    this.petBumps = this.petGroundBumps = this.petAirBumps = 0;
    Object.assign(this.pet, { y: 1.2, angle: 0, angularVelocity: 0, hit: 0, cooldown: 0, tumble: 0 });
    this.airHit = new Set(); this.groundHit = new Set();
    if (this.isZhuang) { this.speed = this.topSpeed = zhuangRace.introSpeed; this.gasLeft = 2; this.pet.z = -this.config.ropeLength; }
  }

  get driftTier() { return this.charge >= .95 ? 3 : this.charge >= .6 ? 2 : this.charge >= .28 ? 1 : 0; }
  emit(type, detail = {}) { this.events.push({ type, ...detail }); if (this.events.length > 8) this.events.shift(); }
  takeEvents() { return this.events.splice(0); }

  useGas() {
    if (this.isZhuang && (this.elapsed < zhuangRace.raceAt || this.takeoffPending)) return false;
    if (this.state !== 'playing' || !this.gasLeft || this.gasTime > 0) return false;
    this.gasLeft--; this.gasUsed++;
    this.gasTime = this.config.gas.seconds;
    this.speed = Math.max(this.speed, this.config.speed + 3);
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    this.emit('gas');
    return true;
  }

  requestTakeoff() {
    if (!this.isZhuang || this.state !== 'playing' || !this.takeoffPending || this.flying) return false;
    this.flightStarted = this.elapsed; this.takeoffPending = false;
    this.storyPhase = this.lastStoryPhase = 'flight';
    this.hitStop = this.cooldown = this.hit = 0;
    this.speed = Math.max(this.speed, zhuangRace.flightSpeed);
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    this.emit('story', { phase: 'flight' });
    return true;
  }

  updateOpponent(dt) {
    const r = this.rival, c = rivalRideConfig;
    if (!r.enabled || r.finished) return;
    r.clock += dt;
    r.burst = Math.max(0, r.burst - dt);
    const bend = Math.max(...[0, 15, 30].map(ahead => Math.abs(this.curvature(r.progress + ahead))));
    r.cornering = bend > c.straightCurvature;
    const racing = r.clock >= zhuangRace.raceAt;
    if (racing && !r.cornering && r.clock >= r.nextBurst && !r.burst) {
      r.burst = c.burstSeconds; r.nextBurst = r.clock + c.burstCooldown; r.bursts++;
      if (Math.abs(r.progress - this.progress) < 80) this.emit('rival', { action: 'burst' });
    }
    const target = racing ? Math.min(c.maxSpeed, c.cruiseSpeed * (1 - Math.min(c.cornerLoss, bend * 12)) + (r.burst ? c.burstSpeed : 0)) : c.introSpeed;
    r.speed += (target - r.speed) * (1 - Math.exp(-dt * c.acceleration));
    // Choose a passing lane, then ease across it. Neither racer can block the other.
    const lane = Math.abs(r.progress - this.progress) < 22 ? (this.offset < 0 ? c.lane : -c.lane) : -Math.sign(this.curvature(r.progress + 15) || 1) * c.lane;
    r.offset += (lane - r.offset) * (1 - Math.exp(-dt * 2));
    r.progress = Math.min(this.config.length, r.progress + r.speed * dt);
    const gap = r.progress - this.progress;
    const lead = gap > c.passMargin ? 1 : gap < -c.passMargin ? -1 : r.lead;
    const near = Math.abs(gap) < 14;
    if (racing && (lead !== r.lead || (near && !r.near))) {
      r.reaction = lead !== r.lead ? lead > 0 ? 'pass' : 'passed' : 'near';
      r.reactionUntil = r.clock + 2.4;
      // The first pass must visibly react, even during opening dialogue.
      // Only the subtitle has a cooldown; gestures never wait for text.
      if (r.clock >= r.nextQuip) {
        r.nextQuip = r.clock + c.quipCooldown;
        this.emit('rival', { action: r.reaction });
      }
    }
    r.lead = lead; r.near = near;
    if (r.progress >= this.config.length) {
      r.finished = true; r.finishTime = this.prizeClock;
      this.emit('rival', { action: 'finish' });
    }
  }

  curvature(s) {
    const center = this.config.center;
    const angle = x => Math.atan((center(x + .5) - center(x - .5)));
    return (angle(s + 1) - angle(s - 1)) / 2;
  }

  step(dt, steer, brake) {
    const c = this.config, d = c.driving;
    this.elapsed += dt;
    if (this.isZhuang) {
      this.storyPhase = zhuangPhase(this.elapsed, this.progress, false, this.flying);
      if (this.storyPhase !== this.lastStoryPhase) {
        if (this.storyPhase === 'takeoff') {
          this.takeoffPending = true; this.prizeDeadline = this.prizeClock + zhuangRace.prizeSeconds;
        }
        this.lastStoryPhase = this.storyPhase;
        this.emit('story', { phase: this.storyPhase });
      }
      this.steerHeld = steer && Math.sign(steer) === Math.sign(this.lastSteer) ? this.steerHeld + dt : 0;
      this.lastSteer = steer;
      brake = this.steerHeld >= zhuangRace.steeringHold && this.elapsed >= zhuangRace.raceAt;
    }
    dt *= this.timeScale;
    this.prizeClock += dt;
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
    const storySpeed = !this.isZhuang ? c.speed : this.flying ? zhuangRace.flightSpeed : this.storyPhase === 'impatient' ? 40 : zhuangRace.introSpeed + (zhuangRace.speed - zhuangRace.introSpeed) * takeoverBlend(this.elapsed);
    const topSpeed = Math.min(this.isZhuang ? zhuangRace.maxSpeed : c.maxSpeed, storySpeed + (this.boost ? this.boostPower : 0) + (this.gasTime ? c.gas.speed : 0));
    const targetSpeed = (brake ? this.isZhuang ? topSpeed * .93 : c.brakeSpeed : topSpeed) * (this.cooldown > .2 ? .68 : 1);
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt * d.acceleration));
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    const lateralTarget = Math.sin(this.heading) * this.speed * d.sidePower;
    this.velocity += (lateralTarget - this.velocity) * (1 - Math.exp(-dt * (brake ? d.driftGrip : d.grip)));
    // A bend pushes the vehicle toward the outside. Countersteer and braking
    // matter, while forgiving guardrails still let a first-time player finish.
    this.velocity -= this.curvature(this.progress) * this.speed ** 2 * d.curveForce * (this.flying ? .4 : 1) * dt;
    this.drift = Math.sin(this.heading) * this.speed - this.velocity;
    const slip = Math.abs(this.heading - Math.atan2(this.velocity, this.speed));
    this.isDrifting = brake && Math.abs(steer) > .15 && this.speed > d.minDriftSpeed && (this.isZhuang || slip > .08);
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
      if (this.flying) this.velocity *= -.2; else this.bump('護欄', Math.sign(this.offset));
    }
    this.progress = Math.min(this.takeoffPending ? zhuangRace.flightAt + 40 : c.length, this.progress + this.speed * dt);
    for (const obstacle of this.flying ? [] : c.obstacles) {
      if (Math.abs(this.progress - obstacle.s) < 1.8 && Math.abs(this.offset - obstacle.offset) < obstacle.radius + .9) {
        const direction = this.offset >= obstacle.offset ? 1 : -1;
        if (this.bump(obstacle.name || '路障', -direction)) this.velocity = direction * 3;
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
    this.updateOpponent(dt);
    if (this.progress >= c.length) {
      this.state = 'won'; this.isDrifting = false;
      if (this.isZhuang) {
        this.storyPhase = 'finish';
        this.outcome = this.rival.enabled && this.rival.finished ? 'rival' : this.prizeRemaining === 0 ? 'late' : 'player';
      }
      this.emit('finish');
    }
  }

  updatePet(dt, brake) {
    if (!this.isZhuang) { super.updatePet(dt, brake); return; }
    const p = this.pet, oldX = p.x, oldZ = p.z;
    p.hit = Math.max(0, p.hit - dt * (this.flying ? 1.5 : 2));
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (this.elapsed < zhuangRace.raceAt) {
      const a = takeoverBlend(this.elapsed);
      p.x = this.x + Math.sin(a * Math.PI) * 3;
      p.z = this.z + (a * 2 - 1) * this.config.ropeLength;
      p.y = 1.2;
    } else {
      // A bounded angular spring gives the dragon room to swing, without
      // stretching the rope or teleporting it into a scripted collision.
      const target = clamp(-this.curvature(this.progress) * this.speed ** 2 * .18 - this.heading * 2.7 + (this.flying ? Math.sin(this.elapsed * 4) * .5 : 0), -1.15, 1.15);
      p.angularVelocity += ((target - p.angle) * 12 - p.angularVelocity * 2.5) * dt;
      p.angle = clamp(p.angle + p.angularVelocity * dt, -1.4, 1.4);
      const rope = this.flying ? zhuangRace.petAirRope : zhuangRace.petGroundRope;
      p.x = this.x + Math.sin(p.angle) * rope;
      p.z = this.z + Math.cos(p.angle) * rope;
      p.y = this.height + 1.2 + (this.flying ? Math.sin(this.elapsed * 6) * .95 : 0);
      const lateral = p.x - this.config.center(-p.z);
      if (!this.flying && Math.abs(lateral) > this.config.roadHalfWidth - .7) this.petBump('護欄', Math.sign(lateral));
      if (!this.flying) for (const [index, item] of this.config.petHazards.entries()) {
        if (!this.groundHit.has(index) && Math.hypot(p.x - this.config.center(item.s) - item.offset, p.z + item.s) < item.radius + .8 && this.petBump(item.name, Math.sign(item.offset))) this.groundHit.add(index);
      }
      if (this.flying) for (const [index, item] of this.config.airHazards.entries()) {
        const hit = Math.abs(p.x - this.config.center(item.s) - item.offset) < item.width / 2 + .75 && Math.abs(p.z + item.s) < .95 && Math.abs(p.y - item.height) < item.tall / 2 + .75;
        if (!this.airHit.has(index) && hit && this.petBump(item.name, Math.sign(item.offset))) this.airHit.add(index);
      }
    }
    p.vx = (p.x - oldX) / dt; p.vz = (p.z - oldZ) / dt;
  }

  petBump(kind, direction) {
    const p = this.pet;
    if (p.cooldown > 0) return false;
    p.hit = 1; p.cooldown = this.flying ? .42 : .75;
    p.angularVelocity -= direction * (this.flying ? 4 : 2.5);
    p.tumble += this.flying ? Math.PI * 4 : Math.PI * 2;
    this.petBumps++;
    if (this.flying) this.petAirBumps++; else this.petGroundBumps++;
    this.emit('pet-hit', { kind, air: this.flying });
    return true;
  }

  bump(kind, direction = 1) {
    if (this.cooldown > 0) return false;
    this.cooldown = .95; this.hit = 1; this.hitStop = this.isZhuang ? 0 : .06; this.impactX = direction;
    this.bumps++; this.speed = Math.max(5, this.speed * (this.isZhuang ? .85 : .6));
    this.velocity *= -.45;
    this.boost = this.gasTime = this.charge = 0;
    this.pet.vx -= direction * 4; this.pet.vz += 3;
    this.emit('collision', { kind });
    return true;
  }
}
