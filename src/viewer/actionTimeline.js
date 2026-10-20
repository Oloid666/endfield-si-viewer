import { MathUtils } from 'three';

export const ramp = (time, start, end) => MathUtils.smoothstep(time, start, end);
export const windowWeight = (time, start, end, fade = .25) => ramp(time,start,start+fade)*(1-ramp(time,end-fade,end));

// Absolute seconds make the joke's pauses identical at 15/30/60fps.
export function reverseBeat(time, config) {
  const b = config.beats;
  const first = windowWeight(time,b.swing,b.release,.35);
  const second = windowWeight(time,b.windmill,b.return,.22);
  const attached = ramp(time,b.grab,b.swing)*(1-ramp(time,b.release,b.rest)) + second;
  return {
    summon: ramp(time,0,b.limbs),
    limbs: ramp(time,b.limbs,b.stare),
    attached: Math.min(1,attached),
    angle: first*config.swing*Math.sin((time-b.swing)*Math.PI*2/config.cycle)
      + Math.PI*2*(config.windmillTurns || 1)*ramp(time,b.windmill,b.return),
    first, second,
    bow: windowWeight(time,b.bow,b.fade,.3),
    fade: 1-ramp(time,b.fade,config.duration),
  };
}

export function leekBeat(time, config) {
  const b = config.beats;
  const dance = windowWeight(time,b.dance,b.pose,.3);
  return {
    draw: windowWeight(time,0,b.dance,.25),
    dance,
    amplitude: .45 + .8*ramp(time,b.dance,b.big),
    show: windowWeight(time,b.pose,b.peek,.2),
    peek: windowWeight(time,b.peek,b.end,.18),
    fade: ramp(time,0,.55)*(1-ramp(time,b.end,config.duration)),
  };
}
