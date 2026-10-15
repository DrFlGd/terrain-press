'use strict';
// node tools/earth/verify-native.js /path/to/original-NOAA-source.tif
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {PNG}=require('pngjs'),Geo=require('../../desktop/usgs-geotiff');
globalThis.ClipperLib=require('clipper-lib');globalThis.poly2tri=require('poly2tri');require('../../source/core.js');
const provenance=require('../../site/data/earth/provenance.json');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'earth-native-'));
 try {
  fs.copyFileSync(path.resolve(process.argv[2]),path.join(dir,'elevation.tif'));
  const receipt=await Geo.install({id:'earth-etopo-60',staging:dir,signal:new AbortController().signal,progress:{},report:()=>{}});
  assert.equal(receipt.sha256,provenance.sha256);assert.ok(Geo.complete(dir,'earth-etopo-60'));
  for(const point of provenance.referenceSamples){
   const x=Math.floor((point.lon+180)*60),y=Math.floor((90-point.lat)*60);
   const png=PNG.sync.read(await Geo.generateTile(dir,'earth-etopo-60',`t${Math.floor(y/1024)}_${Math.floor(x/1024)}.png`));
   const k=4*((y%1024)*png.width+x%1024);assert.equal(png.data[k+3],255);
   const actual=png.data[k]*65536+png.data[k+1]*256+png.data[k+2]-8388608;
   assert.equal(actual,Math.round(point.nativeHeightM));console.log(point.name,actual,'m: native -> PNG exact to nearest metre');
  }
  const C=globalThis.TPCore,base=require('../../site/data/meta.json').earth;
  const store=C.makeStore({earth:{...base,installedPacks:[{id:'earth-etopo-60',w:21600,h:10800,tile:1024,imageExt:'png',heightEncoding:'int24'}]}},async name=>{
   const png=PNG.sync.read(await Geo.generateTile(dir,'earth-etopo-60',name.split('/').pop()));
   return Float32Array.from({length:png.width*png.height},(_,i)=>png.data[4*i]*65536+png.data[4*i+1]*256+png.data[4*i+2]-8388608);
  });
  for(const [lat,lon] of [[27.9881,86.925],[11.35,142.2]]){
   const hf=await store.sample('earth',lat,lon,100,31);hf.sizeKm=100;
   for(const product of ['ornament','puzzle']){
    const model=C.buildModel({shape:product==='puzzle'?'hexgrid':'square',widthMm:100,product,border:'none',exag:2,baseMm:2,frameMm:7,rimMm:3,rimAuto:false,back:false,pieces:7,hexLayout:'round',gapMm:.3,stepMm:3,loop:false},hf,null);
    assert.ok(model.parts.length>0);for(const part of model.parts)assert.ok(part.tris.every(Number.isFinite));
    const stl=C.stl(model.parts);assert.ok(stl.length>84);
    const entries=C.model3mf(model.parts,{},'Earth native smoke');assert.ok(!/NaN|Infinity/.test(entries[2][1]));
    const zip=await C.zip(entries);assert.equal(zip[0],80);assert.equal(zip[1],75);
    console.log('Earth',lat,lon,product,'STL/3MF finite geometry OK',stl.length,'STL bytes');
   }
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
