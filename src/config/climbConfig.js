// Original fan-game rules. Industrial waste and the patrol are gameplay inventions.
export const climbConfig = {
  title: '管理員，你人呢？',
  width: 13,
  start: { x: 0, y: 1 },
  exit: { x: 12, y: 8 },
  timeLimit: 80,
  wasteStart: -1,
  wasteEnd: 8.4,
  moveSeconds: .32,
  actorHeight: 1.55,
  fragileSeconds: 2.8,
  patrol: { period: 7, warnSeconds: 1.6, scanSeconds: 2.4, range: 4.5, exposureRate: 42, recoveryRate: 24 },
  // Tops form two deliberate two-cell walls: each needs a movable step.
  columns: [1, 1, 1, 1, 3, 3, 3, 3, 5, 6, 7, 8, 8],
  crates: [{ id: 'step-a', x: 2, y: 1 }, { id: 'step-b', x: 6, y: 3 }],
  fragile: { x: 9, y: 5 },
};
