'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
global.ClipperLib=require('clipper-lib');global.poly2tri=require('poly2tri');require('../source/core.js');require('../source/panel-core.js');
const C=global.TPCore,P=global.TPPanel;
const p={widthMm:60,exag:3,baseMm:2,frameMm:7,rimMm:3,rimAuto:false,back:true,backMm:1.6,pieces:2,gapMm:.3,stepMm:5,seed:42,separate:true,hexLayout:'round',hexAcross:3,hexEdge:'terrain'};
function hf(){const N=13;return {N,sizeKm:120,heights:Float32Array.from({length:N*N},(_,i)=>i*5),surface:{width:8,height:8,labels:Uint8Array.from({length:64},(_,i)=>i%8<4?0:1),palette:[[40,50,60],[190,180,170]]}};}
test('lunar projection matches node positions, north-up orientation and seam wrapping',()=>{
 const g=C.nodeGrid(20,179.9,100,3,1737.4);assert.ok(Math.abs(g.lats[4]-20)<1e-10);assert.ok(Math.abs(g.lons[4]-179.9)<1e-10);
 assert.ok(g.lats[1]>20&&g.lats[7]<20);assert.ok(g.lons[3]<179.9&&g.lons[5]<0);
 const pole=C.nodeGrid(90,0,100,3,1737.4);assert.ok([...pole.lats,...pole.lons].every(Number.isFinite));
});
test('surface quantization preserves diagonal paint while layered panels keep cleanup',()=>{
 const rgba=Uint8Array.from([255,255,255,255,0,0,0,255,0,0,0,255,255,255,255,255]);
 assert.deepEqual(Array.from(P.quantize(rgba,2,2,2,false).labels),[1,0,0,1]);assert.ok(P.quantize(rgba,2,2,2).removed>0);
});
for(const [shape,product] of [['circle','ornament'],['square','puzzle'],['hexagon','ornament'],['hexgrid','puzzle']])test(`Moon ${shape} ${product}: painting preserves geometry and colors survive spread`,()=>{
 const h=hf(),params={...p,shape,product,border:'plain'};
 const colored=C.buildModel(params,h,null),plain=C.buildModel(params,{...h,surface:undefined},null);
 assert.equal(colored.reliefMm,plain.reliefMm);assert.equal(colored.parts.length,plain.parts.length);
 colored.parts.forEach((part,k)=>{assert.deepEqual(part.tris,plain.parts[k].tris);if(part.role!=='terrain'){assert.equal(part.faceColors,undefined);return;}
 assert.equal(part.faceColors.length,part.tris.length/9);const t=part.tris;
 for(let i=0;i<t.length;i+=9){const nz=(t[i+3]-t[i])*(t[i+7]-t[i+1])-(t[i+4]-t[i+1])*(t[i+6]-t[i]);const x=(t[i]+t[i+3]+t[i+6])/3;
 assert.equal(part.faceColors[i/9],nz>1e-10&&x>=0?1:0);}
 });
 const xml=C.model3mf(colored.parts,{terrain:'#aaaaaa',frame:'#444444'},'moon')[2][1];assert.match(xml,/displaycolor="#28323c"/);assert.match(xml,/pid="100000" p1="1"/);
 if(product==='puzzle'){const spread=C.spreadPieces(colored.parts,colored.grid,3,colored.floorZ);for(const part of spread.parts){const original=colored.parts.find(o=>o.name===part.name);assert.deepEqual(part.faceColors,original.faceColors);}}
});
test('Moon worker exports palette, guide colors and individual 3MF; paint toggle does not contaminate DEM cache',async()=>{
 const messages=[],N=13,h=hf(),pixels=new Uint8Array(16*8*4);for(let y=0;y<8;y++)for(let x=0;x<16;x++)pixels.set([x*16,y*32,x*10,255],(y*16+x)*4);
 const ctx=vm.createContext({console,Uint8Array,Uint32Array,Float32Array,Float64Array,ArrayBuffer,DataView,TextEncoder,Response,Blob,ClipperLib:global.ClipperLib,poly2tri:global.poly2tri,fetch:async()=>({ok:true,blob:async()=>new Blob()}),createImageBitmap:async()=>({width:16,height:8,close(){}}),OffscreenCanvas:class{getContext(){return{drawImage(){},getImageData(){return{data:pixels};}};}}});
 ctx.self=ctx;ctx.location={search:''};ctx.postMessage=m=>messages.push(m);ctx.importScripts=(...urls)=>urls.forEach(u=>{if(u.includes('core.js'))vm.runInContext(fs.readFileSync(path.join(__dirname,'../source',u),'utf8'),ctx);});vm.runInContext(fs.readFileSync(path.join(__dirname,'../source/worker.js'),'utf8'),ctx);
 ctx.TPCore.makeStore=()=>({chooseSource:()=>({kind:'tiles',label:'test DEM',pxKm:1}),sample:async()=>({heights:h.heights,source:{kind:'tiles',label:'test DEM',pxKm:1}})});
 ctx.TPCore.meshPlan=()=>({N,stepMm:5,limited:false,cap:721,featureMm:.4,sourceStepMm:.5,samplingLimit:721});
 await ctx.onmessage({data:{type:'init',meta:{moon:{radiusKm:1737.4}}}});
 const q={world:'moon',lat:0,lon:179,size:3000,widthMm:60,step:5,surfaceColors:true,surfaceCount:8,surfaceGrid:128};
 await ctx.onmessage({data:{type:'export',id:1,q,p:{...p,shape:'square',product:'puzzle',border:'plain'},readme:'real terrain',x:{slug:'moon-test',colors:{terrain:'#888888',frame:'#444444'},spread:true,spreadGap:3,perPiece:true}}});
 const out=messages.find(m=>m.id===1&&m.type!=='progress');assert.equal(out.type,'exported',out.text);
 const names=out.files.map(f=>f[0]);for(const name of ['surface-palette.csv','MOON-COLOR-PRINTING.txt','moon-surface-settings.json'])assert.ok(names.includes(name));assert.ok(!names.includes('color-changes.csv'));
 const individual=out.files.filter(f=>/^single-pieces\/.*\.3mf$/.test(f[0]));assert.ok(individual.length>0);assert.equal(individual.length,out.files.filter(f=>/^single-pieces\/.*\.stl$/.test(f[0])).length);
 assert.match(new TextDecoder().decode(individual[0][1]),/pid="100000" p1=/);
 for(const part of out.plates.find(pl=>pl.key==='pieces').parts){assert.equal(part.palette.length,8);assert.equal(part.faceColors.length,part.idx.length/3);}
 await ctx.onmessage({data:{type:'build',id:2,q:{...q,surfaceColors:false},p:{...p,shape:'circle',product:'ornament',border:'none'}}});
 const plain=messages.find(m=>m.id===2&&m.type!=='progress');assert.equal(plain.type,'built',plain.text);assert.ok(plain.parts.every(p=>!p.faceColors));
 await ctx.onmessage({data:{type:'build',id:3,q:{...q,surfaceCount:2,surfacePalette:['#ff0000','#00ff00']},p:{...p,shape:'circle',product:'ornament',border:'none'}}});
 const edited=messages.find(m=>m.id===3&&m.type!=='progress');assert.equal(edited.type,'built',edited.text);assert.deepEqual(Array.from(edited.parts[0].palette),['#ff0000','#00ff00']);
});
