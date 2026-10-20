import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {transferGLB} from '../src/viewer/ModelTransfer.js';

const raw=readFileSync(new URL('../public/models/si.glb',import.meta.url));
const hash=createHash('sha256').update(raw).digest('hex');
const url='https://example.test/models/si.glb';
const tiny={idleTimeoutMs:25,totalTimeoutMs:200,retries:0};
const pending=(_, {signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));

test('lossless gzip transfer restores exactly the original GLB bytes',async()=>{
  const packed=gzipSync(raw),states=[],progress=[];
  const result=await transferGLB(url,event=>progress.push(event),{...tiny,compressedUrl:url+'.gz',asset:{revision:hash},onState:state=>states.push(state),fetchImpl:async source=>{assert.equal(source,url+'.gz');return new Response(packed,{headers:{'content-length':String(packed.length)}});}});
  assert(Buffer.from(result).equals(raw));assert(states.includes('decompress'));assert(states.includes('parse'));assert.equal(progress.at(-1).loaded,packed.length);
});

test('no first byte and stalled body time out instead of waiting forever',async()=>{
  await assert.rejects(transferGLB(url,null,{...tiny,fetchImpl:pending}),error=>error.code==='stalled');
  const stalled=(_, {signal})=>Promise.resolve(new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(raw.subarray(0,32)));signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});}})));
  await assert.rejects(transferGLB(url,null,{...tiny,fetchImpl:stalled}),error=>error.code==='stalled');
});

test('a failed compressed request automatically retries the original with fresh cache policy',async()=>{
  const calls=[];
  const result=await transferGLB(url,null,{...tiny,retries:1,compressedUrl:url+'.gz',fetchImpl:async(source,options)=>{calls.push([source,options.cache]);return source.endsWith('.gz')?new Response('missing',{status:404}):new Response(raw);}});
  assert(Buffer.from(result).equals(raw));assert.deepEqual(calls,[[url+'.gz','default'],[url,'reload']]);
});

test('an explicitly cancelled download does not retry or replace the current model',async()=>{
  const control=new AbortController();let calls=0;
  const promise=transferGLB(url,null,{...tiny,retries:1,signal:control.signal,fetchImpl:(...args)=>{calls++;return pending(...args);}});
  control.abort();await assert.rejects(promise,error=>error.name==='AbortError');assert.equal(calls,1);
});

test('partial transfers, corrupt compressed data and wrong asset revisions are rejected',async()=>{
  for(const bytes of [raw.subarray(0,1024),Buffer.from('not a glb')])await assert.rejects(transferGLB(url,null,{...tiny,fetchImpl:async()=>new Response(bytes)}));
  await assert.rejects(transferGLB(url,null,{...tiny,compressedUrl:url+'.gz',fetchImpl:async()=>new Response(new Uint8Array([0x1f,0x8b,1,2,3,4]))}));
  await assert.rejects(transferGLB(url,null,{...tiny,asset:{revision:'0'.repeat(64)},fetchImpl:async()=>new Response(raw)}),error=>error.code==='invalid');
});

test('verified default model cache avoids a second network request; uploads never write to it',async()=>{
  const original=globalThis.caches,items=new Map();let calls=0,writes=0;
  const cache={match:async key=>items.get(key)?.clone(),put:async(key,response)=>{writes++;items.set(key,response);},keys:async()=>[...items.keys()].map(key=>new Request(key)),delete:async key=>items.delete(key)};
  globalThis.caches={open:async()=>cache};
  try{
    const options={...tiny,asset:{revision:hash},fetchImpl:async()=>{calls++;return new Response(raw);}};
    await transferGLB(url,null,options);const states=[];
    const second=await transferGLB(url,null,{...options,onState:state=>states.push(state)});
    assert.equal(calls,1);assert.equal(writes,1);assert(Buffer.from(second).equals(raw));assert(states.includes('cached'));
    await transferGLB('blob:https://example.test/local-upload',null,{...tiny,fetchImpl:async()=>new Response(raw)});assert.equal(writes,1);
  }finally{if(original)globalThis.caches=original;else delete globalThis.caches;}
});

test('unavailable private-mode storage does not prevent loading',async()=>{
  const original=globalThis.caches;globalThis.caches={open:async()=>{throw new Error('storage unavailable');}};
  try{const result=await transferGLB(url,null,{...tiny,asset:{revision:hash},fetchImpl:async()=>new Response(raw)});assert(Buffer.from(result).equals(raw));}
  finally{if(original)globalThis.caches=original;else delete globalThis.caches;}
});

test('older browsers without native gzip support use the ordinary GLB',async()=>{
  const original=globalThis.DecompressionStream;globalThis.DecompressionStream=undefined;
  try{const result=await transferGLB(url,null,{...tiny,compressedUrl:url+'.gz',fetchImpl:async source=>{assert.equal(source,url);return new Response(raw);}});assert(Buffer.from(result).equals(raw));}
  finally{globalThis.DecompressionStream=original;}
});

test('native fetch retains the Window receiver required by browsers',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=function(){assert.equal(this,globalThis);return Promise.resolve(new Response(raw));};
  try{const result=await transferGLB(url,null,tiny);assert(Buffer.from(result).equals(raw));}
  finally{globalThis.fetch=original;}
});
