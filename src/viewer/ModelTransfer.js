export class ModelTransferError extends Error {
  constructor(code, message) { super(message); this.name = 'ModelTransferError'; this.code = code; }
}

function validateGLB(buffer) {
  if (buffer.byteLength < 20) throw new ModelTransferError('invalid','模型下載不完整。');
  const view = new DataView(buffer);
  if (view.getUint32(0,true) !== 0x46546c67 || view.getUint32(8,true) !== buffer.byteLength)
    throw new ModelTransferError('invalid','模型下載不完整。');
}

async function verify(buffer, revision) {
  validateGLB(buffer);
  if (revision && globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256',buffer);
    const actual = [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
    if (actual !== revision) throw new ModelTransferError('invalid','模型資料驗證失敗。');
  }
}

const abortError = () => new DOMException('載入已取消。','AbortError');
const optionalCache = promise => {
  let timer;
  return Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1000);})]).catch(()=>null).finally(()=>clearTimeout(timer));
};

async function readDownload(url, progress, settings, signal, reload) {
  const controller = new AbortController();
  let idleTimer, totalTimer, rejectDeadline;
  const deadline = new Promise((_,reject)=>{rejectDeadline=reject;});
  const stop = error => { rejectDeadline(error); controller.abort(); };
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>stop(new ModelTransferError('stalled','下載連線停滯，沒有收到新資料。')),settings.idleTimeoutMs);
  };
  const cancel = () => stop(abortError());
  signal?.addEventListener('abort',cancel,{once:true});
  resetIdle(); totalTimer=setTimeout(()=>stop(new ModelTransferError('timeout','下載時間過長。')),settings.totalTimeoutMs);
  try {
    if(signal?.aborted)throw abortError();
    return await Promise.race([deadline,(async()=>{
      const response=await settings.fetchImpl(url,{signal:controller.signal,cache:reload?'reload':'default'});
      if(!response.ok)throw new ModelTransferError('http',`下載失敗（HTTP ${response.status}）。`);
      resetIdle();
      const total=Number(response.headers.get('content-length'))||0;
      let loaded=0;
      if(!response.body){const buffer=await response.arrayBuffer();progress?.({loaded:buffer.byteLength,total});return buffer;}
      const reader=response.body.getReader(),chunks=[];
      try {
        while(true){
          const {done,value}=await reader.read();if(done)break;
          resetIdle();chunks.push(value);loaded+=value.byteLength;progress?.({loaded,total});
        }
      }finally{reader.releaseLock();}
      const bytes=new Uint8Array(loaded);let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      return bytes.buffer;
    })()]);
  }finally{
    clearTimeout(idleTimer);clearTimeout(totalTimer);signal?.removeEventListener('abort',cancel);
  }
}

// Lossless transport only: the decoded bytes are the original GLB. Cache and
// gzip are optional; uploaded files never enter the persistent cache.
export async function transferGLB(url, progress, options = {}) {
  const settings={idleTimeoutMs:15000,totalTimeoutMs:120000,retries:1,fetchImpl:(input,init)=>globalThis.fetch(input,init),...options};
  const {signal,asset,onState}=settings;
  let cache=null,key=null;
  let storage;
  try{storage=globalThis.caches;}catch{storage=null;}
  if(asset?.revision && storage && !url.startsWith('blob:')){
    key=new URL(url,globalThis.location?.href||'http://localhost/');key.searchParams.set('model-revision',asset.revision);
    cache=await optionalCache(storage.open('endfield-si-model-v1'));
    if(signal?.aborted)throw abortError();
    const hit=cache&&await optionalCache(cache.match(key.href));
    if(hit){
      try{const buffer=await hit.arrayBuffer();await verify(buffer,asset.revision);if(signal?.aborted)throw abortError();onState?.('cached');return buffer;}
      catch{await optionalCache(cache.delete(key.href));}
    }
  }
  let lastError;
  const compressed=!!settings.compressedUrl && typeof DecompressionStream==='function';
  for(let attempt=0;attempt<=settings.retries;attempt++){
    if(signal?.aborted)throw abortError();
    const zipped=compressed&&attempt===0;
    const source=zipped?settings.compressedUrl:url;
    if(attempt)onState?.('retry');
    try{
      let buffer=await readDownload(source,progress,settings,signal,attempt>0);
      if(signal?.aborted)throw abortError();
      // Some hosts serve .gz with Content-Encoding and fetch already decodes it.
      if(zipped&&new DataView(buffer).getUint16(0,false)===0x1f8b){
        onState?.('decompress');
        buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }
      await verify(buffer,asset?.revision);
      if(signal?.aborted)throw abortError();
      if(cache&&key){
        // Cache a copy of the verified original, independent of CDN expiry.
        await optionalCache(cache.put(key.href,new Response(buffer,{headers:{'Content-Type':'model/gltf-binary'}})));
        const keys=await optionalCache(cache.keys());
        if(keys)for(const request of keys)if(request.url!==key.href)void cache.delete(request).catch(()=>{});
      }
      onState?.('parse');return buffer;
    }catch(error){
      if(signal?.aborted)throw abortError();
      lastError=error;
    }
  }
  throw lastError;
}
