// One short course; all motion is in metres / seconds. No physics dependency.
export const raftConfig = {
  length: 255,
  speed: 6.2,
  brakeSpeed: 2.5,
  riverHalfWidth: 6.3,
  edge: 4.7,
  actorHeight: 2.1,
  ropeLength: 4.2,
  maxRopeLength: 6.2,
  obstacles: [
    { s: 36, offset: -2, radius: .85 },
    { s: 66, offset: 1.8, radius: 1 },
    { s: 106, offset: 0, radius: .95 },
    { s: 143, offset: -2.2, radius: 1.1 },
    { s: 180, offset: 2, radius: .9 },
    { s: 216, offset: -.8, radius: 1.05 },
  ],
  stamps: [
    { s: 24, offset: 0 }, { s: 58, offset: -1.8 },
    { s: 92, offset: 2.2 }, { s: 126, offset: -.8 },
    { s: 166, offset: 1.5 }, { s: 202, offset: -2 },
    { s: 238, offset: 1.5 },
  ],
};

export function riverCenter(s) {
  return Math.sin(s * .045) * 4.8 + Math.sin(s * .095) * 1.8;
}
