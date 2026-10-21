// A paused SVG overview shares the engine's actual cells. No second WebGL scene.
export function escapeMap(engine){
  const c=engine.config,top=Math.max(c.exit.y+2,...engine.blocks.map(b=>b.y+1),...(c.ropes||[c.rope]).filter(Boolean).map(r=>r.top+1));
  const x=v=>(v+1)*28,y=v=>(top-v+1)*28;
  const cell=(b,fill,extra='')=>`<rect x="${x(b.x)}" y="${y(b.y+1)}" width="27" height="27" fill="${fill}" ${extra}/>`;
  const text=(b,label)=>`<text x="${x(b.x)+14}" y="${y(b.y+.5)+5}" text-anchor="middle" fill="#fff7d9" font-size="15">${label}</text>`;
  let content=engine.blocks.map(b=>cell(b,b.kind==='gate'?'#c38d58':b.kind==='crate'?'#5e987f':b.kind==='built'?'#a6c97d':'#425956')+(b.label?text(b,b.label):'')).join('');
  for(const r of engine.ropes)content+=`<path d="M${x(r.x)+14} ${y(r.bottom)} V${y(r.top+1)}" stroke="#dbe4b4" stroke-width="3" stroke-dasharray="5 3"/>`;
  for(const p of c.plates||[])content+=`<path d="M${x(p.x)} ${y(p.y)} h27" stroke="#a4ebbe" stroke-width="5"/>`;
  for(const p of c.hazards)content+=cell({...p,y:p.y-.85},'#be8fdb');
  for(const p of c.pickups||[])if(!engine.collected.includes(p.id))content+=text(p,'◆');
  for(const p of c.deliveries||[])content+=cell(p,'none','stroke="#e2eba7" stroke-width="3" stroke-dasharray="4 2"');
  content+=`<rect x="${x(c.exit.x)}" y="${y(c.exit.y+2)}" width="27" height="55" fill="none" stroke="#a4ebbe" stroke-width="3"/>`;
  content+=`<circle cx="${x(engine.player.x)+14}" cy="${y(engine.player.y+.6)}" r="8" fill="#f5da83" stroke="#172822" stroke-width="3"/>`;
  return `<svg viewBox="0 0 ${(c.width+2)*28} ${(top+2)*28}" role="img" aria-label="關卡全圖：黃點是你，綠框是出口，虛線框是收貨位置，菱形是任務物品">${content}</svg>`;
}
