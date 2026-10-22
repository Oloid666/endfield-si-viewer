import {
  BoxGeometry, BufferGeometry, CanvasTexture, ConeGeometry, CylinderGeometry,
  Float32BufferAttribute, Group, LatheGeometry, Mesh, MeshBasicMaterial,
  SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildInkCompanion } from './InkCompanion.js';

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

function paintFace(owner, mood) {
  const panic = mood === 'panic', dead = mood === 'dead', angry = mood === 'angry', smug = mood === 'smug', blink = mood === 'blink';
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.lineJoin = c.lineCap = 'round';
  const gradient = c.createLinearGradient(0, 70, 0, 213); gradient.addColorStop(0, '#38a58e'); gradient.addColorStop(.55, '#9fc774'); gradient.addColorStop(1, '#eddb73');
  for (const side of [-1, 1]) {
    const x = 128 + side * 64, top = panic ? 54 : dead || blink ? 173 : angry ? 95 : 100;
    c.fillStyle = gradient; c.strokeStyle = '#343a35'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(x - 38, top); c.lineTo(x + 38, top); c.bezierCurveTo(x + 38, 222, x - 38, 222, x - 38, top); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = 14; c.beginPath(); c.moveTo(x - 39, top - 2); c.lineTo(x + 39, top - 2 + side * (angry ? 26 : smug ? -18 : -3)); c.stroke();
    c.fillStyle = '#83bdb1'; c.beginPath(); c.ellipse(x + side * 2, 54, 13, 8, side * .15, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = '#343a35'; c.lineWidth = 5; c.beginPath(); c.moveTo(108, 195); c.quadraticCurveTo(105, 213, 127, 202); c.quadraticCurveTo(147, 215, 150, 196); c.stroke();
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
  if(kind==='ink')return buildInkCompanion(owner);
  const root = new Group(), fixed = new Group(); root.add(fixed);
  const sphere = owner.own(new SphereGeometry(1, 18, 14));
  const cone = owner.own(new ConeGeometry(1, 1, 8));
  const white = owner.material(0xe9e9da), gold = owner.material(0xc8ac63, { roughness: .5 });
  const green = owner.material(0x84bba6), red = owner.material(0xba5043);
  const arms = [];
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
  batch(owner, fixed);
  const moods = ['calm','panic','smug','angry','dead','blink'];
  const maps = moods.map(mood => paintFace(owner, mood));
  const material = owner.own(new MeshBasicMaterial({ map: maps[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  const face = facePanel(owner, material, root, 1.5, 1.03, [0, .96, .8]);
  const tail = new Group();root.add(tail);tail.position.set(0,.38,-.55);
  owner.mesh(cone, green, tail, [0,0,0], [.18,.6,.23]).rotation.x=-1.1;
  return { root, arms, tail, face, maps, moods, kind };
}

// Bamboo shaft, ivory ferrule, tapered ink-loaded bristles. The silhouette is
// readable from the chase camera; fixed pieces are merged by material.
export function buildFlyingBrush(owner) {
  const root = new Group(), fixed = new Group(), seat = new Group(), mount = new Group();
  root.name = 'flying-ink-brush'; root.add(fixed, seat); seat.add(mount); seat.position.set(0, .94, .35);
  const bamboo = owner.material(0x8f673d, { roughness: .65 });
  const dark = owner.material(0x161e21), ivory = owner.material(0xe2dfc6);
  const gold = owner.material(0xc5a460, { metalness: .25, roughness: .55 });
  const jade = owner.material(0x9cc7b0, { emissive: 0x31574c, emissiveIntensity: .35 });
  const shaft = owner.mesh(owner.own(new CylinderGeometry(.18, .24, 4.5, 12)), bamboo, fixed, [0, .65, .6]); shaft.rotation.x = Math.PI / 2;
  const collar = owner.mesh(owner.own(new CylinderGeometry(.29, .24, .62, 12)), ivory, fixed, [0, .65, -1.75]); collar.rotation.x = Math.PI / 2;
  const bristles = owner.mesh(owner.own(new ConeGeometry(.3, 1.6, 14)), dark, fixed, [0, .65, -2.85]); bristles.rotation.x = -Math.PI / 2;
  const ring = owner.own(new TorusGeometry(.245, .035, 5, 12));
  for (const z of [-1.39, -.8, .9, 2.72]) owner.mesh(ring, gold, fixed, [0, .65, z]);
  const grain = owner.own(new BoxGeometry(.018, .018, 3.8));
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; owner.mesh(grain, dark, fixed, [Math.sin(a) * .19, .65 + Math.cos(a) * .19, .65]); }
  const ribbon = owner.mesh(owner.own(new BoxGeometry(.065, .035, 1.2)), jade, fixed, [.25, .64, 3.15]); ribbon.rotation.y = -.3;
  owner.mesh(owner.own(new SphereGeometry(.11, 8, 6)), gold, fixed, [0, .65, 2.98]);
  batch(owner, fixed);
  // Four small repeatable ink strokes; no particles allocated while racing.
  const flames = [], stroke = owner.own(new ConeGeometry(.12, 1.4, 5));
  for (let i = 0; i < 4; i++) {
    const ink = owner.mesh(stroke, i % 2 ? jade : dark, root, [(i - 1.5) * .14, .6 + i % 2 * .13, 3.5 + i * .22]);
    ink.rotation.x = Math.PI / 2; flames.push(ink);
  }
  const charge=owner.mesh(owner.own(new TorusGeometry(.4,.045,5,20)),owner.own(new MeshBasicMaterial({color:0xb2f4db,transparent:true,opacity:.85,depthWrite:false})),root,[0,.65,-2.25]);charge.visible=false;
  return { root, seat, mount, flames, charge };
}

// Called by the existing viewer/game frame loop; all meshes and maps are reused.
export function animateCompanion(prop, time, {mood='calm',wave=0,blink=0,stress=0,lookUp=0}={}) {
  const index=prop.moods.indexOf(blink>.65?'blink':mood);prop.face.material.map=prop.maps[Math.max(0,index)];
  if(prop.motion){const impact=Math.sin(time*7)*stress;prop.motion.rotation.set(impact*.09,0,impact*.08);prop.motion.scale.set(1+Math.abs(impact)*.05,1-Math.abs(impact)*.07,1);prop.face.rotation.x=-lookUp;}
  prop.arms.forEach((arm,i)=>{arm.rotation.z=Math.sin(time*(stress?17:5)+i*2)*(.2+wave*.7+stress*.5);});
  prop.tail.rotation.z=Math.sin(time*7)*(.18+stress*.25);
}
