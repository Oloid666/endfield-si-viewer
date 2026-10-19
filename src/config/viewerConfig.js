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
    gestureDuration: 3.2, gestureTilt: 0.13, gestureNod: 0.075,
    gestureYawLimit: 0.22, gesturePitchLimit: 0.08,
    spineNode: 73, headNode: 77,
  },
  lights: { ambient: { color: 0xffffff, intensity: 1.6 }, directional: { color: 0xffffff, intensity: 2.5, position: [3, 5, 4] } },
};
