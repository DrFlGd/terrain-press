'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PNG}=require('pngjs');
require('../source/giant-core.js');require('../source/panel-core.js');
for(const world of ['saturn','uranus','neptune'])test(world+' bundled coverage, seam and default selection',()=>{
 const m=TPGiants.maps[world],im=PNG.sync.read(fs.readFileSync('site/'+m.path));
 assert.equal(im.width,m.width);assert.equal(im.height,m.height);
 const q={lat:m.lat,lon:m.lon,size:m.size};
 const crop=TPPanel.crop(im.data,im.width,im.height,q,128,m);
 for(let i=3;i<crop.length;i+=4)assert.equal(crop[i],255);
 assert.deepEqual(TPPanel.crop(im.data,im.width,im.height,{...q,lon:179},24,m),TPPanel.crop(im.data,im.width,im.height,{...q,lon:-181},24,m));
 const invalid=world==='saturn'?0:world==='uranus'?-60:75;
 assert.throws(()=>TPPanel.crop(im.data,im.width,im.height,{lat:invalid,lon:0,size:10},24,m),/unmapped/);
 const [south,north]=m.panelBand;
 for(let y=0;y<im.height;y++){const lat=90-(y+.5)/im.height*180;if(lat<=south||lat>=north)continue;
  for(let x=0;x<im.width;x++)assert.ok(im.data[(y*im.width+x)*4+3]&&im.data[(y*im.width+x)*4]+im.data[(y*im.width+x)*4+1]+im.data[(y*im.width+x)*4+2]>0);
 }
});
test('1024 color quantization retains narrow detail and supports eight colors',()=>{
 const n=1024,pixels=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const c=(Math.floor(x/128))*32;pixels.set([c,c,c,255],(y*n+x)*4);}
 const p=TPPanel.quantize(pixels,n,n,8);
 assert.equal(p.labels.length,n*n);assert.equal(new Set(p.labels).size,8);assert.equal(p.removed,0);
 assert.notEqual(p.labels[127],p.labels[128]);assert.equal(p.labels[0],p.labels[n*(n-1)]);
});
