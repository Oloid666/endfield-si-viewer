import {
  BoxGeometry, BufferGeometry, CanvasTexture, ConeGeometry, CylinderGeometry,
  Float32BufferAttribute, Group, LatheGeometry, Mesh, MeshBasicMaterial,
  PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original procedural fan props. References guide silhouettes; no downloaded
// character textures or meshes are redistributed. Static parts share draw calls.
function batch(owner, root) {
  const groups = new Map();
  for (const mesh of [...root.children]) {
    if (!mesh.isMesh) continue;
    mesh.updateMatrix();
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const list = groups.get(mesh.material) || [];
    list.push(geometry); groups.set(mesh.material, list); mesh.removeFromParent();
  }
  for (const [material, geometries] of groups) {
    const geometry = owner.own(mergeGeometries(geometries));
    root.add(new Mesh(geometry, material));
    for (const source of geometries) source.dispose();
  }
}

function paintFace(owner, kind, panic) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.lineJoin = c.lineCap = 'round';
  if (kind === 'ink') {
    c.fillStyle = '#e6e4ce';
    c.beginPath(); c.moveTo(12, 8); c.lineTo(244, 8); c.lineTo(230, 231); c.lineTo(210, 243); c.lineTo(181, 238); c.lineTo(143, 250); c.lineTo(109, 243); c.lineTo(70, 248); c.lineTo(27, 233); c.closePath(); c.fill();
    c.strokeStyle = '#547e3b'; c.lineWidth = 13;
    for (const side of [-1, 1]) {
      c.save(); c.translate(128 + side * 61, 108); c.rotate(side * -.18);
      c.beginPath(); c.moveTo(-27, -29); c.quadraticCurveTo(0, -14, 27, -31); c.stroke();
      c.lineWidth = panic ? 9 : 12; c.beginPath();
      if (panic) c.ellipse(0, 10, 18, 27, 0, 0, Math.PI * 2);
      else { c.moveTo(-25, 9); c.quadraticCurveTo(0, 30, 25, 7); }
      c.stroke(); c.restore();
    }
    c.lineWidth = 10; c.beginPath(); c.moveTo(101, 188); c.quadraticCurveTo(126, panic ? 146 : 208, 155, 185); c.stroke();
    c.globalAlpha = .25; c.lineWidth = 2;
    for (let i = 0; i < 11; i++) { c.beginPath(); c.moveTo(25 + i * 20, 17); c.lineTo(20 + i * 20, 225); c.stroke(); }
  } else {
    const gradient = c.createLinearGradient(0, 70, 0, 213); gradient.addColorStop(0, '#38a58e'); gradient.addColorStop(.55, '#9fc774'); gradient.addColorStop(1, '#eddb73');
    for (const side of [-1, 1]) {
      const x = 128 + side * 64, top = panic ? 64 : 100;
      c.fillStyle = gradient; c.strokeStyle = '#343a35'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(x - 38, top); c.lineTo(x + 38, top); c.bezierCurveTo(x + 38, 222, x - 38, 222, x - 38, top); c.closePath(); c.fill(); c.stroke();
      c.lineWidth = 14; c.beginPath(); c.moveTo(x - 39, top - 2); c.lineTo(x + 39, top - 2 + side * -3); c.stroke();
      c.fillStyle = '#83bdb1'; c.beginPath(); c.ellipse(x + side * 2, 54, 13, 8, side * .15, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = '#343a35'; c.lineWidth = 5; c.beginPath(); c.moveTo(108, 195); c.quadraticCurveTo(105, 213, 127, 202); c.quadraticCurveTo(147, 215, 150, 196); c.stroke();
  }
  const texture = owner.own(new CanvasTexture(canvas)); texture.colorSpace = SRGBColorSpace; return texture;
}

function facePanel(owner, material, parent, width, height, position) {
  const vertices = [], uv = [], indices = [];
  for (let row = 0; row <= 4; row++) for (let col = 0; col <= 8; col++) {
    const u = col / 8, v = row / 4, x = (u - .5) * width;
    vertices.push(x, (.5 - v) * height, -x * x * .42);
    uv.push(u, 1 - v);
    if (row && col) { const i = row * 9 + col; indices.push(i - 10, i - 1, i - 9, i - 9, i - 1, i); }
  }
  const geometry = owner.own(new BufferGeometry()); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return owner.mesh(geometry, material, parent, position);
}

export function buildCompanion(owner, kind) {
  const root = new Group(), fixed = new Group(); root.add(fixed);
  const sphere = owner.own(new SphereGeometry(1, 18, 14));
  const cone = owner.own(new ConeGeometry(1, 1, 8));
  const black = owner.material(0x141b1c, { roughness: .7 });
  const white = owner.material(0xe9e9da), gold = owner.material(0xc8ac63, { roughness: .5 });
  const green = owner.material(0x84bba6), red = owner.material(0xba5043);
  const arms = [], ink = kind === 'ink';
  if (ink) {
    owner.mesh(sphere, black, fixed, [0, .65, -.07], [.57, .69, .51]);
    owner.mesh(sphere, black, fixed, [0, 1.12, -.04], [.79, .74, .68]);
    for (const side of [-1, 1]) {
      arms.push(owner.mesh(sphere, black, root, [side * .71, .55, .01], [.4, .13, .2]));
      const foot = owner.mesh(cone, black, fixed, [side * .3, .12, .18], [.18, .4, .2]); foot.rotation.z = side * -.25;
    }
  } else {
    owner.mesh(sphere, white, fixed, [0, .94, 0], [.9, .9, .79]);
    const hornGeometry = owner.own(new LatheGeometry([new Vector2(0, 0), new Vector2(.17, 0), new Vector2(.2, .21), new Vector2(.13, .48), new Vector2(.03, .68), new Vector2(0, .7)], 10));
    for (const side of [-1, 1]) {
      owner.mesh(sphere, white, fixed, [side * .34, .11, .16], [.2, .29, .22]);
      arms.push(owner.mesh(sphere, white, root, [side * .84, .58, .05], [.23, .14, .22]));
      const horn = owner.mesh(hornGeometry, gold, fixed, [side * .53, 1.54, -.04]); horn.rotation.z = side * -.3;
    }
    const tuft = owner.mesh(cone, owner.material(0xb9cccf), fixed, [0, 1.86, -.09], [.15, .34, .16]); tuft.rotation.z = -.2;
    const ribbon = owner.own(new BoxGeometry(1, 1, 1));
    owner.mesh(ribbon, red, fixed, [.66, 1.79, .09], [.37, .07, .09]);
    owner.mesh(ribbon, red, fixed, [.85, 1.54, .02], [.06, .45, .05]).rotation.z = -.2;
    owner.mesh(ribbon, white, fixed, [.78, 1.45, .16], [.16, .19, .07]).rotation.z = .3;
  }
  batch(owner, fixed);
  const maps = [paintFace(owner, kind, false), paintFace(owner, kind, true)];
  const material = owner.own(new MeshBasicMaterial({ map: maps[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  const face = facePanel(owner, material, root, ink ? 1.02 : 1.5, ink ? 1 : 1.03, ink ? [0, .65, .68] : [0, .96, .8]);
  const tail = owner.mesh(cone, ink ? black : green, root, [0, .38, -.68], [ink ? .28 : .18, ink ? 1 : .6, .23]); tail.rotation.x = -1.1;
  return { root, arms, tail, face, maps };
}

export function buildMiniDijiang(owner) {
  const root = new Group(), fixed = new Group(), seat = new Group(), mount = new Group(); root.add(fixed, seat); seat.add(mount); seat.position.set(0, 1.14, -.3);
  const box = owner.own(new BoxGeometry(1, 1, 1)), sphere = owner.own(new SphereGeometry(1, 14, 10));
  const beam = owner.material(0x344448, { metalness: .55, roughness: .52 });
  const shell = owner.material(0xd3d8d0, { metalness: .25, roughness: .6 });
  const dark = owner.material(0x1d2a2d), warning = owner.material(0xd9aa55);
  const glow = owner.material(0xe6c87c, { emissive: 0xc69c35, emissiveIntensity: .8 });
  const thrust = owner.material(0xc7e5cd, { emissive: 0x7ed0b3, emissiveIntensity: 1 });
  const ring = owner.own(new TorusGeometry(1.02, .055, 5, 24));
  for (const z of [-1.65, 1.65]) {
    owner.mesh(ring, beam, fixed, [0, .57, z]);
    for (const side of [-1, 1]) {
      owner.mesh(box, shell, fixed, [side * .96, .57, z], [.38, .6, .72]);
      owner.mesh(box, dark, fixed, [side * 1.16, .64, z], [.025, .16, .47]);
    }
  }
  owner.mesh(box, beam, fixed, [0, .52, 0], [.4, .4, 5.9]);
  owner.mesh(box, shell, fixed, [0, .62, -2.25], [.8, .62, 1.4]);
  owner.mesh(box, dark, fixed, [0, .98, -2.35], [.56, .16, .64]);
  owner.mesh(sphere, glow, fixed, [0, .6, .8], [.43, .43, .43]);
  owner.mesh(box, shell, fixed, [0, .75, -.2], [1.4, .22, 1.3]);
  const flames = [];
  for (const side of [-1, 1]) {
    for (const y of [.1, 1.04]) owner.mesh(box, beam, fixed, [side * .78, y, 0], [.07, .07, 4.8]);
    for (const z of [-.9, .9]) {
      owner.mesh(box, shell, fixed, [side * 1.28, .55, z], [.62, .66, 1.1]);
      owner.mesh(box, warning, fixed, [side * 1.28, .9, z], [.5, .035, .18]);
    }
    const diagonal = owner.mesh(box, beam, fixed, [side * .78, .57, 0], [.055, 1.15, 2.8]); diagonal.rotation.x = side * .32;
    const antenna = owner.mesh(box, beam, fixed, [side * .55, .68, -3.05], [.035, .035, .9]); antenna.rotation.y = side * .18;
    const nozzle = owner.mesh(owner.own(new CylinderGeometry(.22, .28, .55, 10)), dark, fixed, [side * .82, .3, 2.48]); nozzle.rotation.x = Math.PI / 2;
    const flame = owner.mesh(owner.own(new ConeGeometry(.22, 1.2, 8)), thrust, root, [side * .82, .3, 3.05]); flame.rotation.x = Math.PI / 2; flames.push(flame);
    owner.mesh(box, dark, seat, [side * .47, .24, 0], [.11, .1, .8]);
  }
  owner.mesh(box, dark, seat, [0, -.06, 0], [.84, .13, .7]);
  owner.mesh(box, dark, seat, [0, .3, .35], [.84, .72, .12]);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const c = canvas.getContext('2d'); c.fillStyle = '#d3d8d0'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#27383b'; c.font = 'bold 28px sans-serif'; c.fillText('O.M.V. DIJIANG', 10, 40);
  const labelMap = owner.own(new CanvasTexture(canvas)); labelMap.colorSpace = SRGBColorSpace;
  const label = owner.own(new MeshBasicMaterial({ map: labelMap }));
  owner.mesh(owner.own(new PlaneGeometry(1.2, .3)), label, fixed, [0, .6, 2.76]);
  batch(owner, fixed);
  return { root, seat, mount, flames };
}
