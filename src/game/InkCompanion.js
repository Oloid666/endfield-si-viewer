import { BufferGeometry, CanvasTexture, ConeGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, LatheGeometry, Mesh, Shape, SphereGeometry, SRGBColorSpace, DoubleSide, Vector2 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The cream face is painted into the round head's UVs. There is no face card,
// backing plane, independent face motion or unlit sticker material.
function headMap(owner, mood) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d');c.fillStyle='#222825';c.fillRect(0,0,512,512);
  c.save();c.beginPath();c.moveTo(74,252);c.bezierCurveTo(91,265,106,284,128,287);
  c.bezierCurveTo(150,284,166,265,182,252);c.bezierCurveTo(181,329,167,391,128,410);
  c.bezierCurveTo(90,391,75,329,74,252);c.closePath();c.clip();
  c.fillStyle='#dedfd0';c.fillRect(65,240,130,180);
  c.fillStyle=c.strokeStyle='#587c38';c.lineJoin=c.lineCap='round';
  for(const side of [-1,1]){
    c.save();c.translate(128+side*29,0);
    const angry=mood==='angry',smug=mood==='smug',panic=mood==='panic';
    c.translate(0,307);c.rotate(side*(angry?-.27:smug?.12:0));
    c.beginPath();c.moveTo(-17,-7);c.quadraticCurveTo(0,6,18,-7);c.quadraticCurveTo(8,14,-8,7);c.closePath();c.fill();
    c.lineWidth=panic?4:6;c.beginPath();
    if(panic)c.ellipse(0,26,9,13,0,0,Math.PI*2);
    else if(mood==='dead'){c.moveTo(-14,25);c.lineTo(14,25);}
    else if(mood==='blink'){c.moveTo(-14,29);c.quadraticCurveTo(0,32,14,29);}
    else if(smug&&side<0){c.moveTo(-14,31);c.lineTo(13,23);}
    else{c.moveTo(-15,24);c.quadraticCurveTo(0,39,15,24);}
    c.stroke();c.restore();
  }
  c.lineWidth=3;c.beginPath();
  if(mood==='panic')c.ellipse(128,374,5,8,0,0,Math.PI*2);
  else{c.moveTo(120,373);c.quadraticCurveTo(128,mood==='smug'?382:mood==='angry'?365:373,137,371);}
  c.stroke();c.restore();
  const texture=owner.own(new CanvasTexture(canvas));texture.colorSpace=SRGBColorSpace;return texture;
}

function mergeSleeve(owner,group){
  const pieces=group.children.map(mesh=>{mesh.updateMatrix();return (mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);});
  const geometry=owner.own(mergeGeometries(pieces));const material=group.children[0].material;
  group.clear();group.add(new Mesh(geometry,material));for(const piece of pieces)piece.dispose();
}

export function buildInkCompanion(owner){
  const root=new Group(),motion=new Group(),fixed=new Group();root.add(motion);motion.add(fixed);
  root.name='ink-spirit';
  const black=owner.material(0x222825,{roughness:.9,side:DoubleSide});
  const moods=['calm','panic','smug','angry','dead','blink'],maps=moods.map(mood=>headMap(owner,mood));
  const face=owner.mesh(owner.own(new SphereGeometry(1,40,28)),owner.material(0xffffff,{map:maps[0],roughness:1}),motion,[0,1.27,-.03],[.77,.74,.65]);
  face.name='integrated-ink-head';
  const robe=owner.own(new LatheGeometry([
    new Vector2(0,.05),new Vector2(.43,.05),new Vector2(.38,.17),new Vector2(.32,.43),
    new Vector2(.38,.65),new Vector2(.53,.83),new Vector2(.49,.91),new Vector2(.36,.76),
  ],24));
  owner.mesh(robe,black,fixed,[0,0,-.08],[1,1,.93]);
  const tiny=owner.own(new ConeGeometry(.075,.17,7));
  for(const side of [-1,1])owner.mesh(tiny,black,fixed,[side*.23,.07,.12]).rotation.x=-1.8;
  const arms=[];
  for(const side of [-1,1]){
    const sleeve=new Group();sleeve.position.set(side*.43,.88,-.02);sleeve.scale.x=side;motion.add(sleeve);arms.push(sleeve);
    const shape=new Shape();shape.moveTo(0,.06);shape.bezierCurveTo(.13,-.10,.34,-.34,.67,-.43);
    shape.quadraticCurveTo(.76,-.49,.59,-.54);shape.bezierCurveTo(.35,-.58,.09,-.30,-.035,-.10);shape.closePath();
    const clothGeometry=owner.own(new ExtrudeGeometry(shape,{depth:.24,bevelEnabled:true,bevelSize:.035,bevelThickness:.045,bevelSegments:2,steps:1,curveSegments:8}));
    const position=clothGeometry.attributes.position;for(let i=0;i<position.count;i++)position.setZ(i,position.getZ(i)-position.getX(i)**2*.25);clothGeometry.computeVertexNormals();
    owner.mesh(clothGeometry,black,sleeve,[0,0,-.12]);
    for(let i=0;i<3;i++){const tip=owner.mesh(tiny,black,sleeve,[.47+i*.065,-.54-i*.012,.02]);tip.rotation.z=Math.PI-.15;}
    mergeSleeve(owner,sleeve);
  }
  const tail=new Group();motion.add(tail);
  const points=[[0,.26,-.3,.18],[.15,.24,-.65,.2],[.42,.20,-.95,.15],[.78,.16,-1.19,.07],[1.02,.17,-1.32,0]],vertices=[],indices=[];
  points.forEach(([x,y,z,w],i)=>{vertices.push(x-w*.4,y-w*.7,z,x+w*.4,y+w*.7,z);if(i){const a=i*2;indices.push(a-2,a,a-1,a-1,a,a+1);}});
  const tailGeometry=owner.own(new BufferGeometry());tailGeometry.setAttribute('position',new Float32BufferAttribute(vertices,3));tailGeometry.setIndex(indices);tailGeometry.computeVertexNormals();
  owner.mesh(tailGeometry,black,tail);
  return {root,motion,arms,tail,face,maps,moods,kind:'ink'};
}
