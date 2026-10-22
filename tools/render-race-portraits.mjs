// Offline only. Uses an existing Playwright installation, never a game dependency.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/render-race-portraits.mjs
import { writeFileSync } from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.PORTRAIT_ORIGIN||'http://127.0.0.1:4177/endfield-si-viewer/';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
await page.route('**/src/main.js',async route=>{const response=await route.fetch();const source=await response.text();await route.fulfill({response,body:source.replace('models = new ModelManager(scene.scene, viewerConfig);','models = new ModelManager(scene.scene, viewerConfig);globalThis.__portraitViewer={scene,models};')});});
const portraits=[];
try{
 for(const id of ['si','zhuang']){
  await page.goto(origin+'#'+id);
  await page.waitForFunction(id=>globalThis.__portraitViewer?.models.current?.characterId===id&&document.querySelector('#load-panel').hidden,id,{timeout:120000});
  const cells=await page.evaluate(async id=>{
   const T=await import(new URL('node_modules/.vite/deps/three.js',location.href).pathname),{scene,models}=__portraitViewer,m=models.current,idle=m.idle;
   idle.setPlaying(false);idle.stopGesture();idle.transition=null;idle.applyBody(null,0);idle.setBlink(0);idle.setCompanionVisible?.(false);
   const nodes=new Map();m.gltf.scene.traverse(n=>{if(n.isBone)nodes.set(m.gltf.parser.associations.get(n)?.nodes,n);});
   const saved=[...nodes.values()].map(bone=>({bone,p:bone.position.clone(),q:bone.quaternion.clone(),s:bone.scale.clone()}));
   const anchor=models.getGazeAnchor(),h=anchor.height,head=nodes.get(id==='si'?77:83),headQ=head.quaternion.clone();
   const browGroups=id==='si'?[[170,171,172,173,174],[175,176,177],[181,182,183,184,185],[178,179,180]]:[[114,115,116,117,118],[119,120,121],[125,126,127,128,129],[122,123,124]];
   const mouth=id==='si'?{lower:[227,228,229,230,237,238,239,240,235],upper:[231,232,233,234,241,242,243,244,236]}:{lower:[171,172,173,174,181,182,183,184,179],upper:[175,176,177,178,185,186,187,188,180]};
   for(const ids of [...browGroups,mouth.lower,mouth.upper])if(ids.some(n=>!nodes.has(n)))throw Error('Face profile missing '+id);
   const light=new T.DirectionalLight(0xfff8ef,1.15);light.position.set(0,h*.5,h*2);scene.scene.add(light);
   const camera=new T.PerspectiveCamera(35,1,h*.001,h*10);camera.position.copy(anchor.position).add(new T.Vector3(0,h*.035,h*.40));camera.lookAt(anchor.position.clone().add(new T.Vector3(0,h*.035,0)));camera.updateMatrixWorld();
   const size=768,target=new T.WebGLRenderTarget(size,size,{samples:4});target.texture.colorSpace=T.SRGBColorSpace;
   const bg=scene.scene.background,oldTarget=scene.renderer.getRenderTarget(),oldAlpha=scene.renderer.getClearAlpha();scene.scene.background=null;scene.renderer.setClearAlpha(0);
   function lift(node,amount){const up=new T.Vector3(0,1,0).applyQuaternion(node.parent.getWorldQuaternion(new T.Quaternion()).invert());node.position.addScaledVector(up,amount*h);}
   const results=[];
   try{for(const mood of ['calm','smug','panic','angry','dead']){
    for(const {bone,p,q,s}of saved){bone.position.copy(p);bone.quaternion.copy(q);bone.scale.copy(s);}m.group.updateWorldMatrix(true,true);
    const lid={calm:0,smug:.32,panic:-.14,angry:.25,dead:.72}[mood];idle.setBlink(lid);
    browGroups.forEach((ids,group)=>ids.forEach((n,i)=>{const f=i/(ids.length-1);const amount=mood==='angry'?-.0016*(1-f)+.00015*f:mood==='panic'?.0015:mood==='smug'?(group<2?.0008:-.00015):mood==='dead'?-.00035:0;lift(nodes.get(n),amount);}));
    for(const [part,ids]of Object.entries(mouth))for(const n of ids)lift(nodes.get(n),mood==='panic'?(part==='lower'?-.00065:.0002):mood==='smug'?.00045:mood==='angry'?-.0003:mood==='dead'?-.0002:0);
    head.quaternion.copy(headQ).multiply(new T.Quaternion().setFromEuler(new T.Euler(mood==='dead'?.05:mood==='smug'?-.03:0,mood==='smug'?-.08:0,mood==='smug'?.07:mood==='dead'?-.07:0)));
    m.group.updateWorldMatrix(true,true);for(const bone of nodes.values())if(!bone.quaternion.toArray().every(Number.isFinite))throw Error('Nonfinite face');
    scene.renderer.setRenderTarget(target);scene.renderer.render(scene.scene,camera);const bytes=new Uint8Array(size*size*4);scene.renderer.readRenderTargetPixels(target,0,0,size,size,bytes);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d'),image=c.createImageData(size,size);for(let y=0;y<size;y++)image.data.set(bytes.subarray((size-1-y)*size*4,(size-y)*size*4),y*size*4);c.putImageData(image,0,0);results.push(canvas.toDataURL('image/png'));
   }}finally{scene.renderer.setRenderTarget(oldTarget);scene.renderer.setClearAlpha(oldAlpha);scene.scene.background=bg;light.removeFromParent();target.dispose();for(const{bone,p,q,s}of saved){bone.position.copy(p);bone.quaternion.copy(q);bone.scale.copy(s);}}
   return results;
  },id);portraits.push(cells);console.log('POSED',id);
 }
 const atlas=await page.evaluate(async sources=>{
  const T=await import(new URL('node_modules/.vite/deps/three.js',location.href).pathname),{buildCompanion}=await import(new URL('src/game/RideProps.js',location.href).pathname);
  const cell=384,canvas=document.createElement('canvas');canvas.width=cell*5;canvas.height=cell*4;const c=canvas.getContext('2d');
  const images=await Promise.all(sources.map(async row=>Promise.all(row.map(async src=>{const im=new Image();im.src=src;await im.decode();return im;}))));
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(cell,cell);renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene();scene.add(new T.AmbientLight(0xffffff,2.2));const light=new T.DirectionalLight(0xfff8ef,2);light.position.set(3,4,6);scene.add(light);
  const camera=new T.PerspectiveCamera(32,1,.1,30);camera.position.set(0,1,4.7);camera.lookAt(0,1,0);
  const resources=new Set(),owner={own(r){resources.add(r);return r;},material(color,extra={}){return this.own(new T.MeshStandardMaterial({color,roughness:.9,...extra}));},mesh(g,m,p,pos=[0,0,0],scale=[1,1,1]){const mesh=new T.Mesh(g,m);mesh.position.fromArray(pos);mesh.scale.fromArray(scale);p.add(mesh);return mesh;}};
  const props=[buildCompanion(owner,'ink'),buildCompanion(owner,'dragon')],moods=['calm','smug','panic','angry','dead'];
  try{for(let row=0;row<4;row++)for(let col=0;col<5;col++){
   c.save();c.translate(col*cell,row*cell);const gradient=c.createRadialGradient(cell*.5,cell*.4,5,cell*.5,cell*.5,cell*.8);gradient.addColorStop(0,'#7b9d8c');gradient.addColorStop(1,'#243c33');c.fillStyle=gradient;c.fillRect(0,0,cell,cell);
   if(row<2)c.drawImage(images[row][col],0,0,cell,cell);
   else{const prop=props[row-2];scene.add(prop.root);prop.face.material.map=prop.maps[prop.moods.indexOf(moods[col])];prop.root.rotation.z=col===4?-.1:0;renderer.render(scene,camera);c.drawImage(renderer.domElement,0,0,cell,cell);scene.remove(prop.root);}
   // Symbols stay in the outer margin; no drawing over a human's face.
   c.textAlign='center';c.lineJoin='round';
   if(col===1){c.fillStyle='#f2da8e';for(const [x,y,r]of [[350,108,12],[338,139,6]]){c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r*.4,y);c.lineTo(x,y+r);c.lineTo(x-r*.4,y);c.closePath();c.fill();}}
   if(col===2){c.fillStyle='#ffe69b';c.strokeStyle='#31483b';c.lineWidth=6;c.font='bold 76px sans-serif';c.strokeText('!',350,159);c.fillText('!',350,159);}
   if(col===3){c.strokeStyle='#e8a089';c.lineWidth=7;for(const [x,y,sx,sy]of [[340,135,1,1],[367,135,-1,1],[340,164,1,-1],[367,164,-1,-1]]){c.beginPath();c.moveTo(x,y+sy*7);c.lineTo(x,y);c.lineTo(x+sx*7,y);c.stroke();}}
   if(col===4){c.fillStyle='#b4dce0';c.beginPath();c.ellipse(350,151,9,17,.25,0,Math.PI*2);c.fill();}
   c.restore();
  }}finally{renderer.dispose();for(const resource of resources)resource.dispose();}
  return canvas.toDataURL('image/webp',.93);
 },portraits);
 writeFileSync(new URL('../public/images/race-portraits.webp',import.meta.url),Buffer.from(atlas.split(',')[1],'base64'));console.log('ATLAS_READY',1920,1536);
}finally{await browser.close();}
