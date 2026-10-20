import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const modelPath=new URL('./public/models/si.glb',import.meta.url);
const source=existsSync(modelPath)?readFileSync(modelPath):null;
const compressed=source?gzipSync(source,{level:9}):null;
const asset=source?{path:'models/si.glb',gzipPath:'models/si.glb.gz',revision:createHash('sha256').update(source).digest('hex'),bytes:source.length,gzipBytes:compressed.length}:null;

// Actions supplies /repository/; relative assets also work in a nested preview.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  define: { __DEFAULT_MODEL_ASSET__: JSON.stringify(asset) },
  plugins: [{
    name: 'lossless-model-download',
    generateBundle(){if(compressed)this.emitFile({type:'asset',fileName:asset.gzipPath,source:compressed});},
    configureServer(server){
      server.middlewares.use((request,response,next)=>{
        if(!compressed||!request.url.split('?')[0].endsWith('/models/si.glb.gz'))return next();
        response.setHeader('Content-Type','application/gzip');response.setHeader('Content-Length',compressed.length);response.end(compressed);
      });
    },
  }],
});
