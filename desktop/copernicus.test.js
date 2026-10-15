'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const COP=require('./copernicus'),GEO=require('./usgs-geotiff'),{PackStore}=require('./pack-store');
require('../source/core.js');const C=globalThis.TPCore;
const response=(url,body,options={})=>{const r=new Response(body,options);Object.defineProperty(r,'url',{value:url});return r;};
const query={lat:27.5,lon:86.5,sizeKm:1,resolution:90};
function planFor(bytes){return {schemaVersion:1,id:'earth-cop90-0123456789abcdef',resolution:90,query,files:[{south:27,west:86,name:COP.cellName(90,27,86)+'.tif',bytes,etag:'"version1"'}],downloadBytes:bytes,missingCells:0};}
async function fixture(){const {writeArrayBuffer}=await import('geotiff');const data=new Float32Array(1200*1200);for(let y=0;y<1200;y++)for(let x=0;x<1200;x++)data[y*1200+x]=x*.25+y*.5-400;return Buffer.from(writeArrayBuffer(data,{width:1200,height:1200,ModelPixelScale:[1/1200,1/1200,0],ModelTiepoint:[0,0,0,86,28,0],GeographicTypeGeoKey:4326,GTRasterTypeGeoKey:2}));}
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'cop-test-'));
test('regional planner handles dateline, polar bounds and invalid selections',()=>{
 assert.deepEqual(COP.regionCells(query),[{south:27,west:86}]);const cells=COP.regionCells({...query,lat:0,lon:179.99,sizeKm:20});
 assert.ok(cells.some(c=>c.west===179));assert.ok(cells.some(c=>c.west===-180));
 for(const q of [{...query,lat:NaN},{...query,lon:181},{...query,sizeKm:0},{...query,sizeKm:501},{...query,resolution:10},{...query,lat:90}])assert.throws(()=>COP.regionCells(q));
 assert.equal(COP.longitudeFactor(-50),1);assert.equal(COP.longitudeFactor(50),1.5);assert.equal(COP.longitudeFactor(-51),1.5);assert.equal(COP.longitudeFactor(85),10);
});
test('coverage index and HEAD provide exact download size and version',async()=>{
 const name=COP.cellName(90,27,86),p=await COP.plan(query,{fetcher:async(url,opt)=>opt.method==='HEAD'?response(url,null,{headers:{'content-length':'12345',etag:'"v1"'}}):response(url,name+'\r\n')});
 assert.equal(p.files.length,1);assert.equal(p.downloadBytes,12345);assert.equal(p.missingCells,0);assert.equal(COP.describe(p).w,432000);
 await assert.rejects(COP.plan(query,{fetcher:async url=>response(url,'')}),/No public land/);
 await assert.rejects(COP.plan(query,{fetcher:async url=>response('https://evil.example/'+url,'')}),/coverage index/);
});
test('saved manifests and tile paths are confined and validated',()=>{
 const p=planFor(100);assert.doesNotThrow(()=>COP.validatePlan(p));
 for(const bad of [{...p,id:'../../outside'},{...p,resolution:15},{...p,query:null},{...p,files:[{...p.files[0],name:'../outside'}]},{...p,files:[p.files[0],p.files[0]]}])assert.throws(()=>COP.validatePlan(bad));
 assert.throws(()=>COP.tileInfo(p,'../../x.png'));assert.throws(()=>COP.tileInfo(p,'t99999999_0.png'));assert.equal(COP.tileInfo(p,'t210_421.png').width,896);
});
test('native metadata checks point registration and latitude-dependent width',()=>{
 const img={getWidth:()=>2400,getHeight:()=>3600,getSamplesPerPixel:()=>1,getOrigin:()=>[6,52],getResolution:()=>[1/2400,-1/3600],getGeoKeys:()=>({GeographicTypeGeoKey:4326,GTRasterTypeGeoKey:2})};
 assert.doesNotThrow(()=>COP.validateImage(img,30,{south:51,west:6}));
 assert.throws(()=>COP.validateImage({...img,getWidth:()=>3600},30,{south:51,west:6}));
 assert.throws(()=>COP.validateImage({...img,getOrigin:()=>[6.5,52]},30,{south:51,west:6}));
 assert.throws(()=>COP.validateImage({...img,getGeoKeys:()=>({GeographicTypeGeoKey:4326,GTRasterTypeGeoKey:1})},30,{south:51,west:6}));
 assert.equal(COP.interpolate([0,10,20,30],2,2,.5,.5,null),15);assert.ok(Number.isNaN(COP.interpolate([0,10,-32767,30],2,2,.5,.5,-32767)));
});
test('global 30s product is pinned and rejects 60s registration',()=>{
 const p=GEO.product('earth-etopo-30');assert.equal(p.expectedBytes,1585813987);assert.match(p.sha256,/^[a-f0-9]{64}$/);
 const img={getOrigin:()=>[-180,90,0],getResolution:()=>[1/120,-1/120,1],getGeoKeys:()=>({GeographicTypeGeoKey:4326,VerticalCSTypeGeoKey:3855,GTRasterTypeGeoKey:1})};
 assert.doesNotThrow(()=>GEO.validateEarthImage(img,p));assert.throws(()=>GEO.validateEarthImage(img,GEO.product('earth-etopo-60')));
});
test('missing regional samples fall through other regions, global terrain and bundled base',async()=>{
 const coverage=[{south:-1,north:1,west:-1,east:1}],packs=[{id:'region-fine',w:1440,h:720,regional:true,coverage},{id:'region-coarse',w:720,h:360,regional:true,coverage},{id:'earth-global',w:360,h:180}].map(p=>({...p,tile:64,imageExt:'png'}));
 const meta={earth:{w:180,h:90,tile:64,ovw:180,ovh:90,radiusKm:6371,installedPacks:packs}};
 const loader=async file=>{const p=packs.find(p=>file.includes(p.id)),d=p||meta.earth,m=/t(\d+)_(\d+)/.exec(file);const w=m?Math.min(64,d.w-Number(m[2])*64):180,h=m?Math.min(64,d.h-Number(m[1])*64):90;return new Float32Array(w*h).fill(p?.regional?NaN:p?123:7);};
 const store=C.makeStore(meta,loader),sample=await store.sample('earth',0,0,10,5);assert.equal(sample.source.validFraction,0);assert.ok(sample.heights.every(v=>v===123));assert.equal(store.chooseSource('earth',40,40,10,5).id,'earth-global');
 meta.earth.installedPacks=packs.slice(0,2);assert.ok((await C.makeStore(meta,loader).sample('earth',0,0,10,5)).heights.every(v=>v===7));
});
test('resumed native GeoTIFF installs, survives offline restart, generates heights and removes',async()=>{
 const bytes=await fixture(),p=planFor(bytes.length),dir=temp(),home=temp();
 try{const f=p.files[0],target=path.join(dir,f.name),offset=2048;fs.writeFileSync(target+'.part',bytes.subarray(0,offset));fs.writeFileSync(target+'.part.etag',f.etag);let requested;
 const fetcher=async(url,opt)=>{requested=opt.headers;return response(url,bytes.subarray(offset),{status:206,headers:{etag:f.etag,'content-range':`bytes ${offset}-${bytes.length-1}/${bytes.length}`}});};
 const signal=new AbortController().signal,progress={doneFiles:0,downloadedBytes:0};await COP.install(p,dir,{signal,progress,report:()=>{},fetcher});
 assert.equal(requested.Range,'bytes=2048-');assert.equal(requested['If-Match'],f.etag);assert.ok(COP.complete(dir,p.id));assert.equal(progress.downloadedBytes,bytes.length);
 await COP.install(p,dir,{signal,progress:{doneFiles:0,downloadedBytes:0},report:()=>{},fetcher:()=>{throw Error('unexpected network');}});
 const s=new PackStore(home);fs.renameSync(dir,path.join(s.root,p.id));s.installed.add(p.id);s.save();const offline=new PackStore(home);assert.equal(offline.status().installed[0].regional,true);
 const n=1200,x=Math.floor(266.5*n),y=Math.floor(62.5*n),file=await offline.assetForUrl('terrain://app/packs/'+p.id+`/t${Math.floor(y/1024)}_${Math.floor(x/1024)}.png`);
 const png=require('pngjs').PNG.sync.read(fs.readFileSync(file)),k=4*((y%1024)*png.width+x%1024),height=png.data[k]*65536+png.data[k+1]*256+png.data[k+2]-8388608;
 assert.equal(png.data[k+3],255);assert.equal(height,Math.round(600.5*.25+600.5*.5-400));await offline.remove(p.id);assert.equal(new PackStore(home).status().installed.length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(home,{recursive:true,force:true});}
});
test('bad ranges, changed objects and interrupted transfers cannot install',async()=>{
 const p=planFor(100),dir=temp(),f=p.files[0],target=path.join(dir,f.name),signal=new AbortController().signal;
 try{fs.writeFileSync(target+'.part',Buffer.alloc(10));fs.writeFileSync(target+'.part.etag',f.etag);
 await assert.rejects(COP.downloadFile(p,f,dir,signal,()=>{},async url=>response(url,Buffer.alloc(90),{status:206,headers:{etag:f.etag,'content-range':'bytes 0-89/100'}})),/resume range/);
 await assert.rejects(COP.downloadFile(p,f,dir,signal,()=>{},async url=>response(url,Buffer.alloc(100),{headers:{etag:'"changed"'}})),/source changed/);
 await assert.rejects(COP.install(p,dir,{signal,progress:{doneFiles:0,downloadedBytes:0},report:()=>{},fetcher:async url=>response(url,Buffer.alloc(20),{status:206,headers:{etag:f.etag,'content-range':'bytes 10-99/100'}})}),/incomplete/);
 assert.equal(fs.statSync(target+'.part').size,30);assert.equal(COP.complete(dir,p.id),false);
 const c=new AbortController();c.abort();await assert.rejects(COP.install(p,dir,{signal:c.signal,progress:{},report:()=>{}}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
