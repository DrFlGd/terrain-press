'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Geo = require('./usgs-geotiff');
const { PackStore } = require('./pack-store');
require('../source/core.js');

test('three source-controlled USGS topography DEMs are published as individual beta packs', () => {
  const products = [
    ['mercury-messenger-64', 'mercury', 23040, 11520, 0],
    ['ceres-dawn-60', 'ceres', 21600, 10800, 0],
    ['vesta-dawn-48', 'vesta', 17280, 8640, -180]
  ];
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'usgs-dem-'));
  try {
    const s=new PackStore(home);
    for(const [id,body,w,h,lon] of products) {
      const p=s.catalogPack(id), info=Geo.product(id);
      assert.equal(p.status,'published');
      assert.equal(p.format,'usgs-geotiff');
      assert.equal(p.body,body);
      assert.equal(p.w,w); assert.equal(p.h,h);
      assert.equal(info.longitudeStart,lon);
      assert.equal(Geo.urlFor(id),'https://planetarymaps.usgs.gov/mosaic/'+info.file);
      assert.ok(p.name.toLowerCase().includes('beta'));
    }
    assert.equal(s.catalogPack('mars-mola-64').format,'nasa-mola-img');
    assert.equal(s.catalogPack('moon-lola-128').format,'nasa-pds-img');
  } finally {fs.rmSync(home,{recursive:true,force:true});}
});
test('planet-specific vertical offsets and 24bit PNG height representation',()=>{
  const mercury=Geo.product('mercury-messenger-64');
  const ceres=Geo.product('ceres-dawn-60');
  const vesta=Geo.product('vesta-dawn-48');
  for(const raw of [-15000,-3700,0,12345,45000]) {
    for(const p of [mercury,ceres]) {
      assert.equal(Geo.decodeHeight(Geo.encodeHeight(raw,p)),raw);
    }
    assert.equal(Geo.decodeHeight(Geo.encodeHeight(raw+255000,vesta)),raw);
  }
  assert.throws(()=>Geo.encodeHeight(NaN,ceres));
  assert.throws(()=>Geo.encodeHeight(1e8,mercury));
  assert.throws(()=>Geo.product('unlisted-source'));
});
test('GeoTIFF tile paths are confined and respect partial last columns',()=>{
  assert.equal(Geo.tileInfo('mercury-messenger-64','t0_22.png').width,512);
  assert.equal(Geo.tileInfo('mercury-messenger-64','t11_0.png').height,256);
  assert.equal(Geo.tileInfo('ceres-dawn-60','t0_21.png').width,96);
  assert.equal(Geo.tileInfo('vesta-dawn-48','t0_16.png').width,896);
  assert.throws(()=>Geo.tileInfo('ceres-dawn-60','t0_22.png'));
  assert.throws(()=>Geo.tileInfo('vesta-dawn-48','../../escape.png'));
  assert.throws(()=>Geo.tileInfo('mercury-messenger-64','t99_0.png'));
});
test('only known HTTPS source hosts are accepted, including USGS storage redirects',()=>{
  for(const u of ['https://planetarymaps.usgs.gov/mosaic/test.tif',
    'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/test.tif'])
    assert.ok(Geo.trustedResponse({url:u}));
  for(const u of ['http://planetarymaps.usgs.gov/test.tif',
    'https://evil.example.com/test.tif',
    'https://planetarymaps.usgs.gov@evil.example.com/test.tif'])
    assert.equal(Geo.trustedResponse({url:u}),false);
});
test('USGS optional packs take precedence over coarser built-ins and use PNGs',()=>{
  const C=globalThis.TPCore;
  for(const [body,radius,wide] of [['mercury',2439.4,23040],['ceres',470,21600],['vesta',255,17280]]) {
    const meta={w:8192,h:4096,tile:512,ovw:720,ovh:360,radiusKm:radius};
    const pack={id:body==='mercury'?'mercury-messenger-64':body==='ceres'?'ceres-dawn-60':'vesta-dawn-48',
      w:wide,h:wide/2,tile:1024,imageExt:'png',heightEncoding:'int24'};
    const store=C.makeStore({[body]:{...meta,installedPacks:[pack]}},
      ()=>Promise.reject(new Error('not reading source')));
    const source=store.chooseSource(body,0,100,10,11);
    assert.equal(source.kind,'pack');
    assert.ok(source.paths.every(p=>p.endsWith('.png')));
    assert.ok(source.paths.every(p=>p.startsWith('packs/'+pack.id+'/')));
    const plain=C.makeStore({[body]:meta},()=>Promise.reject(new Error('no read')));
    assert.notEqual(plain.chooseSource(body,0,100,10,11).kind,'pack');
  }
});
test('NoData pixels in an optional pack revert to actual built-in height tiles',async()=>{
  const C=globalThis.TPCore;
  const world={w:360,h:180,tile:128,ovw:180,ovh:90,radiusKm:1000,installedPacks:[
    {id:'ceres-dawn-60',w:720,h:360,tile:32,imageExt:'png',heightEncoding:'int24'}
  ]};
  const fetchTile=async p=>{
    const pack=p.startsWith('packs/');
    const N=pack?32: p.endsWith('overview.webp')?180:128;
    const M=pack?32:p.endsWith('overview.webp')?90:128;
    const data=new Float32Array(N*M);
    data.fill(pack?NaN:42);
    return data;
  };
  const heights=await C.makeStore({ceres:world},fetchTile).sample('ceres',0,30,10,5);
  assert.equal(heights.source.kind,'pack');
  assert.ok(heights.heights.every(x=>Number.isFinite(x)&&x===42));
});
test('source worker decodes int24 PNGs and treats zero-alpha samples as missing',()=>{
  const s=fs.readFileSync(path.join(__dirname,'..','source','worker.js'),'utf8');
  assert.match(s,/p\.heightEncoding === 'int24'/);
  assert.match(s,/px\[k \+ 3\] === 0 \? NaN/);
});

test('invalid pixels do not become invented planetary terrain',()=>{
  const v=Geo.product('vesta-dawn-48'),m=Geo.product('mercury-messenger-64');
  assert.equal(Geo.isMissingSample(-32768,null,m),true);
  assert.equal(Geo.isMissingSample(-3.4028235e38,null,v),true);
  assert.equal(Geo.isMissingSample(0,null,v),true);
  assert.equal(Geo.isMissingSample(260000,null,v),false);
  assert.equal(Geo.isMissingSample(-8000,null,m),false);
  assert.equal(Geo.isMissingSample(-9999,'-9999',m),true);
});
