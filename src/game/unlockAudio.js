// Some Safari audio sessions leave resume() pending. The visual game must still
// start on the same tap; do not let an optional sound context block its controls.
export async function unlockAudio(audio,timeoutMs=450){
  if(!audio)return false;
  let timer;
  try{
    const resume=audio.resume();
    await Promise.race([Promise.resolve(resume).catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,timeoutMs);})]);
    return audio.state==='running';
  }catch{return false;}
  finally{clearTimeout(timer);}
}
