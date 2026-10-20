import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const entries=['si','zhuang-fangyi'].flatMap(name=>{
  const file=new URL(`./public/models/${name}.glb`,import.meta.url);
  if(!existsSync(file))return [];
  const source=readFileSync(file),compressed=gzipSync(source,{level:9});
  return [{compressed,asset:{path:`models/${name}.glb`,gzipPath:`models/${name}.glb.gz`,revision:createHash('sha256').update(source).digest('hex'),bytes:source.length,gzipBytes:compressed.length}}];
});
const assets=Object.fromEntries(entries.map(({asset})=>[asset.path,asset]));

export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  define: { __DEFAULT_MODEL_ASSET__:JSON.stringify(assets['models/si.glb']||null), __MODEL_ASSETS__:JSON.stringify(assets) },
  plugins: [{
    name:'lossless-model-download',
    generateBundle(){for(const {compressed,asset} of entries)this.emitFile({type:'asset',fileName:asset.gzipPath,source:compressed});},
    configureServer(server){
      server.middlewares.use((request,response,next)=>{
        const entry=entries.find(({asset})=>request.url.split('?')[0].endsWith('/'+asset.gzipPath));
        if(!entry)return next();
        response.setHeader('Content-Type','application/gzip');response.setHeader('Content-Length',entry.compressed.length);response.end(entry.compressed);
      });
    },
  }],
});
