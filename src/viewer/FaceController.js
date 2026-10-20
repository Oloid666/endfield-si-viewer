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
    // The former 0–200% curve now occupies 0–50%. Above it,
    // bounded new endpoints accompany the separately drawn comic effects.
    const mapped = Math.min(this.strength / this.config.compressedEnd, 1) * 2;
    const baseWeight = Math.min(mapped, 1);
    const oldBoost = MathUtils.smoothstep(mapped, 1, 2);
    this.boostTarget = MathUtils.smoothstep(this.strength, this.config.compressedEnd, this.config.maxStrength);
    const dramatic = this.config.dramatic[selection] || exaggerated;
    for (const key of KEYS) {
      const base = preset[key] || 0;
      const compressed = MathUtils.lerp(base*baseWeight, exaggerated[key] ?? base, oldBoost);
      this.target[key] = MathUtils.lerp(compressed, dramatic[key] ?? exaggerated[key] ?? base, this.boostTarget);
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
