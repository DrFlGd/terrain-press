'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {PackStore}=require('./pack-store');
const Venus=require('./nasa-venus');
require('../source/core.js');

const header=[
  'ENVI','description = {','mosaic_allstereo.img}',
  'samples = 34505','lines   = 21549','bands = 1','header offset = 0',
  'file type = ENVI Standard','data type = 4','interleave = bsq',
  'byte order = 0',
  'map info = {Equirectangular, 1, 1, -1690078.35735304, 8143885.38509742, 600, 600}',
  'coordinate system string = {PROJCS["equicyl_venus",GEOGCS["Venus_2000",SPHEROID["Venus_2000_IAU_IAG",6051800,0]]}'
].join('\n');
const xml='<Array_2D_Map><data_type>IEEE754LSBSingle</data_type>'+
  '<value_offset>6040000.0</value_offset>'+
  '<latitude_type>planetocentric</latitude_type>'+
  '<longitude_direction>Positive East</longitude_direction>'+
  '<pixel_resolution_x unit="m/pixel">600</pixel_resolution_x></Array_2D_Map>';

test('Venus PDS header from NASA defines real native dimensions, sample type, radius and absolute-height offset',()=>{
  const m=Venus.parseMetadata(header,xml);
  assert.equal(m.cols,34505);
  assert.equal(m.rows,21549);
  assert.equal(m.bytes,2974192980);
  assert.equal(m.valueOffset,6040000);
  assert.equal(m.sampleType,'IEEE754LSBSingle');
  assert.equal(m.spacingMeters,600);
  assert.equal(m.radius,6051800);
  assert.equal(Venus.toHeight(11926.8759765625),927);
  assert.equal(Venus.toHeight(12123),1123);
  assert.equal(Venus.toHeight(-3.4028230607370965e38),NaN);
  assert.equal(Venus.toHeight(0),NaN);
  assert.equal(Venus.isObserved(11926),true);
  assert.equal(Venus.isObserved(0),false);
});
test('unexpected projection, bytes, type and PDS4 vertical datum are hard errors',()=>{
  assert.throws(()=>Venus.parseMetadata(header.replace('samples = 34505','samples = 34504'),xml));
  assert.throws(()=>Venus.parseMetadata(header.replace('data type = 4','data type = 2'),xml));
  assert.throws(()=>Venus.parseMetadata(header.replace('600, 600','1200, 600'),xml));
  assert.throws(()=>Venus.parseMetadata(header,xml.replace('6040000.0','6051800.0')));
  assert.throws(()=>Venus.parseMetadata(header,xml.replace('Positive East','Positive West')));
  assert.throws(()=>Venus.parseMetadata(header,xml.replace('planetocentric','planetographic')));
});
test('Venus source map projection transforms known coordinates and rejects rectangular-file-only coverage',()=>{
  const origin=Venus.sourcePixel(0,0);
  assert.ok(origin && origin.x>2800&&origin.x<2850);
  const ll=Venus.sourcePixel(10,30);
  assert.ok(ll&&ll.x>0&&ll.x<Venus.COLS&&ll.y>0&&ll.y<Venus.ROWS);
  assert.equal(Venus.sourcePixel(0,-90),null);
  assert.equal(Venus.sourcePixel(90,10),null);
  assert.equal(Venus.sourcePixel(-90,10),null);
  const grid=Venus.mapCell(32400,16200);
  assert.ok(Math.abs(grid.lon)<.02&&Math.abs(grid.lat)<.02);
  assert.throws(()=>Venus.mapCell(-1,0));
  assert.throws(()=>Venus.mapCell(Venus.MAP_W,0));
});
test('Venus native 24-bit output tiles are bounded, with independent last row and column',()=>{
  assert.equal(Venus.tileInfo('t0_0.png').width,1024);
  assert.equal(Venus.tileInfo('t0_63.png').width,288);
  assert.equal(Venus.tileInfo('t31_0.png').height,656);
  assert.throws(()=>Venus.tileInfo('t32_0.png'));
  assert.throws(()=>Venus.tileInfo('t0_64.png'));
  assert.throws(()=>Venus.tileInfo('../../outside.png'));
});
test('NASA Venus source host is allowlisted and catalog is visibly partial-coverage beta',()=>{
  assert.equal(Venus.trusted({url:Venus.ROOT+'mosaic_allstereo.img'}),true);
  assert.equal(Venus.trusted({url:'https://evil.example.org/dataset.img'}),false);
  assert.equal(Venus.trusted({url:'http://pds-geosciences.wustl.edu/test.img'}),false);
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'venus-store-'));
  try {
    const store=new PackStore(home);
    const pack=store.catalogPack(Venus.ID);
    assert.equal(pack.status,'published');
    assert.equal(pack.body,'venus');
    assert.equal(pack.format,'nasa-venus-float');
    assert.equal(pack.downloadBytes,2974192980);
    assert.match(pack.note,/20%/);
    assert.match(pack.note,/1–2 km/);
    assert.ok(!store.status().installed.some(p=>p.id===Venus.ID));
    assert.equal(store.catalogPack('mars-mola-64').format,'nasa-mola-img');
  }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('Venus atlas UI paints only native valid source mask and distinguishes bundled fallback',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','source','app.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','source','src.html'),'utf8');
  const src=fs.readFileSync(path.join(__dirname,'..','source','core.js'),'utf8');
  const worker=fs.readFileSync(path.join(__dirname,'..','source','worker.js'),'utf8');
  assert.match(html,/id="coverage-panel"/);
  assert.match(html,/id="show-coverage" checked/);
  assert.match(html,/id="coverage-legend-key"/);
  assert.match(html,/id="coverage-at-point"/);
  assert.match(app,/image\.src=pack\.coverageMaskUrl/);
  assert.match(app,/coveragePixels\[k\]=val/);
  assert.match(app,/No Magellan stereo elevation here: using bundled Venus terrain/);
  assert.match(app,/Source coverage|Magellan stereo source validity|observed stereo/i);
  assert.match(src,/sourceValidFraction/);
  assert.match(src,/const fallback = await sample/);
  assert.match(worker,/validFraction: hf\.source\.validFraction/);
  assert.match(worker,/px\[k \+ 3\] === 0 \? NaN/);
});
test('masked Venus pack falls back to bundled height and reports ZERO native coverage',async()=>{
  const meta={venus:{w:360,h:180,tile:128,ovw:180,ovh:90,radiusKm:6051,
    installedPacks:[{id:Venus.ID,w:720,h:360,tile:32,imageExt:'png',heightEncoding:'int24'}]}};
  const fetchTile=async name=>{
    const isPack=name.startsWith('packs/');
    const width=isPack?32:name.includes('overview')?180:128;
    const height=isPack?32:name.includes('overview')?90:128;
    return new Float32Array(width*height).fill(isPack?NaN:123);
  };
  const result=await globalThis.TPCore.makeStore(meta,fetchTile).sample('venus',0,60,10,5);
  assert.equal(result.source.kind,'pack');
  assert.equal(result.source.validFraction,0);
  assert.ok(result.heights.every(x=>x===123));
});
