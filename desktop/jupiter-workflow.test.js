'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
global.ClipperLib=require('clipper-lib');global.poly2tri=require('poly2tri');
require('../source/core.js');require('../source/panel-core.js');
function watertight(t){const edges=new Map();let volume=0;
for(let i=0;i<t.length;i+=9){const v=[0,3,6].map(j=>Array.from(t.slice(i+j,i+j+3)));volume+=(v[0][0]*(v[1][1]*v[2][2]-v[1][2]*v[2][1])+v[0][1]*(v[1][2]*v[2][0]-v[1][0]*v[2][2])+v[0][2]*(v[1][0]*v[2][1]-v[1][1]*v[2][0]))/6;
for(let j=0;j<3;j++){const a=v[j].map(x=>x.toFixed(4)).join(','),b=v[(j+1)%3].map(x=>x.toFixed(4)).join(',');assert.notEqual(a,b);const key=[a,b].sort().join('|'),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}}
for(const [key,e] of edges)assert.deepEqual(e,[2,0],key);assert.ok(volume>0);}
const common={widthMm:120,exag:1,baseMm:2,frameMm:7,rimMm:3,rimAuto:false,back:false,pieces:3,gapMm:.3,stepMm:3,seed:42,panelLayer:.2,panelBand:3,panelBacking:8,separate:true,hexLayout:'round',hexAcross:3,hexEdge:'terrain'};
function hf(count=4){const n=24;let seed=51;const rgba=Uint8Array.from({length:n*n*4},()=>{seed=(seed*1664525+1013904223)>>>0;return seed>>>24;});return {panel:TPPanel.quantize(rgba,n,n,count),heights:new Float32Array(n*n),N:n,sizeKm:35000};}
for(const shape of ['square','circle','hexagon','hexgrid'])for(const product of ['ornament','puzzle']){if(shape==='hexgrid'&&product==='ornament')continue;
test(`Jupiter ${shape} ${product} has watertight pieces and color metadata`,()=>{
const model=TPCore.buildModel({...common,shape,product,border:shape==='hexgrid'?'none':'plain'},hf(),null);
for(const part of model.parts.filter(p=>p.role==='terrain')){watertight(part.tris);assert.equal(part.faceColors.length,part.tris.length/9);assert.equal(part.palette.length,4);}
const xml=TPCore.model3mf(model.parts,{terrain:'#cccccc',frame:'#444444'},'Jupiter')[2][1];assert.match(xml,/pid="100000" p1="/);
if(product==='puzzle'){const spread=TPCore.spreadPieces(model.parts,model.grid,3,model.floorZ);for(const p of spread.parts){assert.equal(p.faceColors.length,p.tris.length/9);watertight(p.tris);}}
});}
test('map crop preserves orientation, wraps seam and rejects polar gaps',()=>{const w=360,h=160,pixels=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels.set([x%256,y,0,255],(y*w+x)*4);
const sample=(lon,lat=0)=>TPPanel.crop(pixels,w,h,{lat,lon,size:1000},1);
assert.equal(sample(0)[0],180);assert.deepEqual(sample(179),sample(-181));assert.ok(sample(0,20)[1]<sample(0,-20)[1]);assert.throws(()=>sample(0,85),/polar/);
});
test('worker exports standard puzzle assets, shared palette and grounded schedule',async()=>{
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const pixels=new Uint8Array(100*50*4);for(let i=0;i<pixels.length;i+=4)pixels.set([i%255,(i/8)%255,(i/40)%255,255],i);
const messages=[];const ctx=vm.createContext({console,Uint8Array,Uint32Array,Float32Array,Float64Array,ArrayBuffer,DataView,TextEncoder,Response,ClipperLib:global.ClipperLib,poly2tri:global.poly2tri,fetch:async()=>({ok:true,blob:async()=>new Blob()}),createImageBitmap:async()=>({width:100,height:50,close(){}}),OffscreenCanvas:class{getContext(){return{drawImage(){},getImageData(){return{data:pixels};}};}}});
ctx.self=ctx;ctx.location={search:''};ctx.postMessage=m=>messages.push(m);ctx.importScripts=(...urls)=>urls.forEach(u=>{if(u.includes('core.js'))vm.runInContext(fs.readFileSync(path.join(__dirname,'..','source',u),'utf8'),ctx);});vm.runInContext(fs.readFileSync(path.join(__dirname,'..','source','worker.js'),'utf8'),ctx);
await ctx.onmessage({data:{type:'init',meta:{jupiter:{radiusKm:71492}}}});const q={world:'jupiter',lat:-22,lon:54,size:35000,widthMm:120,panelCount:4,panelGrid:24};const p={...common,shape:'square',product:'puzzle',border:'plain',back:true,backMm:1.6,colorPanel:true};
await ctx.onmessage({data:{type:'build',id:1,q,p}});const built=messages.find(m=>m.id===1&&m.type!=='progress');assert.equal(built.type,'built',built.text);assert.ok(built.parts.some(p=>p.faceColors?.length));
await ctx.onmessage({data:{type:'export',id:2,q,p,readme:'test',x:{slug:'jupiter-test',colors:{terrain:'#888888',frame:'#444444'},spread:true,spreadGap:3,perPiece:true}}});const result=messages.find(m=>m.id===2&&m.type!=='progress');assert.equal(result.type,'exported',result.text);
const names=result.files.map(f=>f[0]);for(const suffix of ['-pieces-spread.stl','-pieces-spread.3mf','-assembled.3mf','-frame.stl','-piece-map.svg'])assert.ok(names.some(n=>n.endsWith(suffix)),suffix);assert.ok(names.some(n=>n.startsWith('single-pieces/')));
assert.match(result.files.find(f=>f[0]==='color-changes.csv')[1],/,9,1.600/);assert.match(result.readmeFallback,/not real terrain/);
for(const part of result.plates.find(p=>p.key==='pieces').parts){assert.ok(part.palette);assert.equal(part.faceColors.length,part.idx.length/3);let min=Infinity;for(let i=2;i<part.verts.length;i+=3)min=Math.min(min,part.verts[i]);assert.ok(Math.abs(min)<1e-5);}
});
