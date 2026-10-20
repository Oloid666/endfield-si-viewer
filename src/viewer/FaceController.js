import { MathUtils } from 'three';

const KEYS = ['browLeftInner', 'browLeftOuter', 'browRightInner', 'browRightOuter', 'mouthLeft', 'mouthRight', 'cheek', 'lid', 'headPitch', 'headYaw', 'headRoll'];

// Only user-selected expression offsets. IdleController blends them with authored
// action expressions and blinking, so two writers never fight over face bones.
export class FaceController {
  constructor(config) {
    this.config = config;
    this.selection = 'neutral';
    this.strength = config.defaultStrength;
    this.values = Object.fromEntries(KEYS.map((key) => [key, 0]));
    this.target = { ...this.values };
    this.bodyBoost = 0;
    this.boostTarget = 0;
  }

  setExpression(selection, strength = this.strength) {
    if (!Object.hasOwn(this.config.presets, selection) || !Number.isFinite(strength)) return false;
    this.selection = selection;
    this.strength = MathUtils.clamp(strength, 0, this.config.maxStrength);
    const preset = this.config.presets[selection];
    const exaggerated = this.config.exaggerated[selection];
    const baseWeight = Math.min(this.strength, 1);
    this.boostTarget = MathUtils.smoothstep(this.strength, 1, this.config.maxStrength);
    for (const key of KEYS) {
      const base = preset[key] || 0;
      this.target[key] = MathUtils.lerp(base*baseWeight, exaggerated[key] ?? base, this.boostTarget);
    }
    return true;
  }

  update(delta) {
    const alpha = 1 - Math.exp(-Math.max(0, delta) * this.config.response);
    for (const key of KEYS) this.values[key] = MathUtils.lerp(this.values[key], this.target[key], alpha);
    this.bodyBoost = MathUtils.lerp(this.bodyBoost, this.boostTarget, alpha);
  }

  offset(role, side, fraction) {
    if (role === 'brow') return MathUtils.lerp(this.values[`brow${side}Inner`], this.values[`brow${side}Outer`], fraction);
    if (role === 'mouth') return this.values[`mouth${side}`] * (1 - fraction);
    return this.values.cheek;
  }
}
