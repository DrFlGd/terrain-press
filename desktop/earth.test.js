'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Geo=require('./usgs-geotiff'),{PackStore}=require('./pack-store');
require('../source/core.js');
const id='earth-etopo-60';
function image(overrides={}) {return {getOrigin:()=>[-180,90,0],getResolution:()=>[1/60,-1/60,1],getGeoKeys:()=>({GeographicTypeGeoKey:4326,VerticalCSTypeGeoKey:3855,GTRasterTypeGeoKey:1}),...overrides};}
test('Earth rejects wrong datum, pixel registration, origin and flipped axes',()=>{
 assert.doesNotThrow(()=>Geo.validateEarthImage(image()));
 for(const bad of [{getOrigin:()=>[0,90,0]},{getResolution:()=>[1/60,1/60,1]},
  {getResolution:()=>[1/30,-1/30,1]},
  {getGeoKeys:()=>({GeographicTypeGeoKey:4326,VerticalCSTypeGeoKey:4979,GTRasterTypeGeoKey:1})},
  {getGeoKeys:()=>({GeographicTypeGeoKey:4326,VerticalCSTypeGeoKey:3855,GTRasterTypeGeoKey:2})}
 ]) assert.throws(()=>Geo.validateEarthImage(image(bad)));
});
test('Earth catalog uses the fixed NOAA source and preserves signed ocean depths',()=>{
 const p=Geo.product(id);assert.equal(p.w,21600);assert.equal(p.h,10800);
 assert.equal(Geo.trustedResponse({url:p.url},p),true);
 for(const url of [p.url.replace('https:','http:'),p.url+'?other=1',p.url.replace('www.ngdc.noaa.gov','evil.example')])assert.equal(Geo.trustedResponse({url},p),false);
 for(const h of [-10900,-4000,0,8500])assert.equal(Geo.decodeHeight(Geo.encodeHeight(h,p)),h);
 assert.equal(Geo.isMissingSample(-99999,-99999,p),true);
 assert.equal(Geo.isMissingSample(-4000,-99999,p),false);
 assert.equal(Geo.tileInfo(id,'t10_21.png').width,96);
 assert.equal(Geo.tileInfo(id,'t10_21.png').height,560);
 assert.throws(()=>Geo.tileInfo(id,'t11_0.png'));
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'earth-store-'));
 try{const s=new PackStore(home);assert.equal(s.catalogPack(id).format,'noaa-geotiff');assert.ok(s.status().bundled.some(p=>p.body==='earth'));}finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('Earth selects downloaded grid across dateline and poles, reverting to base when removed',()=>{
 const base=require('../site/data/meta.json').earth;
 const pack={id,w:21600,h:10800,tile:1024,imageExt:'png',heightEncoding:'int24'};
 const store=globalThis.TPCore.makeStore({earth:{...base,installedPacks:[pack]}},()=>{});
 for(const [lat,lon] of [[0,179.99],[0,-179.99],[89.9,0],[-89.9,0],[27.9881,86.925]]){
  const src=store.chooseSource('earth',lat,lon,100,11);assert.equal(src.kind,'pack');
  for(const p of src.paths)assert.doesNotThrow(()=>Geo.tileInfo(id,p.split('/').pop()));
 }
 const plain=globalThis.TPCore.makeStore({earth:base},()=>{});
 assert.equal(plain.chooseSource('earth',28,87,200,51).kind,'tiles');
});
test('Earth bundled assets include every tile, globe and reproducible provenance',()=>{
 const m=require('../site/data/meta.json').earth,dir=path.join(__dirname,'../site/data/earth');
 for(let y=0;y<Math.ceil(m.h/m.tile);y++)for(let x=0;x<Math.ceil(m.w/m.tile);x++)assert.ok(fs.statSync(path.join(dir,`t${y}_${x}.webp`)).size>0);
 for(const f of ['overview.webp','globe.jpg','provenance.json'])assert.ok(fs.existsSync(path.join(dir,f)));
 const p=JSON.parse(fs.readFileSync(path.join(dir,'provenance.json')));
 assert.equal(p.sha256,Geo.product(id).sha256);assert.equal(p.bytes,465969062);
 assert.ok(p.referenceSamples.find(p=>p.name==='Himalayas').nativeHeightM>5000);
 assert.ok(p.referenceSamples.find(p=>p.name==='Pacific').nativeHeightM<-1000);
});
