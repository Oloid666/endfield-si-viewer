export const viewerConfig = {
  background: 0x242629,
  modelPath: 'models/si.glb',
  renderer: { maxPixelRatio: 1.5, antialias: true },
  camera: { fov: 40, near: 0.01, far: 1000, fitPadding: 1.18 },
  controls: { dampingFactor: 0.08, minPolarAngle: 0.08, maxPolarAngle: Math.PI - 0.08, minDistanceFactor: 0.15, maxDistanceFactor: 8 },
  idle: {
    blinkIntervalMin: 3, blinkIntervalMax: 6, blinkDuration: 0.24, upperLidShare: 0.85,
    breathPeriod: 4.5, breathAmount: 0.003,
    gazeIntervalMin: 3, gazeIntervalMax: 7, eyeResponse: 10, headResponse: 3,
    eyeYaw: 0.075, eyePitch: 0.04, headYaw: 0.04, headPitch: 0.025, headTilt: 0.02,
    gestureDurations: { greeting: 3.2, nod: 2.2, tsundere: 4.4 },
    gestureTilt: 0.13, gestureNod: 0.075, nodAngle: 0.11,
    gestureYawLimit: 0.22, gesturePitchLimit: 0.08,
    // Normalized keyframes: look, turn away, hold, peek back, recover.
    tsundereFrames: [
      { time: 0, yaw: 0, pitch: 0, roll: 0, eyeYaw: 0, lid: 0, viewer: 0 },
      { time: 0.1, yaw: 0, pitch: 0, roll: -0.03, eyeYaw: 0, lid: 0, viewer: 1 },
      { time: 0.24, yaw: 0.3, pitch: -0.1, roll: 0.04, eyeYaw: 0.02, lid: 0.22, viewer: 0.2 },
      { time: 0.52, yaw: 0.3, pitch: -0.1, roll: 0.04, eyeYaw: 0.02, lid: 0.22, viewer: 0.2 },
      { time: 0.64, yaw: 0.3, pitch: -0.1, roll: 0.04, eyeYaw: -0.12, lid: 0.1, viewer: 0.2 },
      { time: 0.76, yaw: 0.18, pitch: -0.03, roll: 0.06, eyeYaw: -0.1, lid: 0, viewer: 0.7 },
      { time: 0.87, yaw: 0.04, pitch: 0.02, roll: -0.02, eyeYaw: 0, lid: 0, viewer: 1 },
      { time: 1, yaw: 0, pitch: 0, roll: 0, eyeYaw: 0, lid: 0, viewer: 0 },
    ],
    spineNode: 73, headNode: 77,
  },
  lights: { ambient: { color: 0xffffff, intensity: 1.6 }, directional: { color: 0xffffff, intensity: 2.5, position: [3, 5, 4] } },
};
