'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate,parseArgs,sourceById}=require('./preflight');
const catalog=require('./sources.json');
function raster(overrides={}) {
  return { driverShortName:'ISIS3', size:[7200,3600],
    bands:[{type:'Float32',noDataValue:-3.402823466e38,mask:{flags:['PER_DATASET']}}],
    geoTransform:[-180,0.05,0,90,0,-0.05],
    coordinateSystem:{wkt:'PROJCS["Io Simple Cylindrical Equirectangular"]'},
    metadata:{IMAGE_STRUCTURE:{INTERLEAVE:'BAND'}},
    ...overrides };
}
test('unverified Io global cube is never authorized for installation',()=>{
  const p=evaluate('io-white-2014-global',raster());
  assert.equal(p.structurallyValid,true);
  assert.equal(p.approvedForImport,false);
  assert.equal(p.publicationStatus,'research-only');
  assert.match(p.requiredManualChecks.join(' '),/25% unobserved/);
  assert.match(sourceById('io-white-2014-global').sourceUrl,/IoDEM\.cub/);
  assert.equal(catalog.installable,false);
});
test('Tvashtar measured geographic footprint and arbitrary vertical zero remain explicit',()=>{
  const info=raster({driverShortName:'GTiff',size:[286,641],
    coordinateSystem:{wkt:'PROJCS["Io Equirectangular"]'},
    geoTransform:[-200000,900,0,500000,0,-900]});
  const p=evaluate('io-tvashtar-900m',info);
  assert.equal(p.structurallyValid,true);
  assert.equal(p.approvedForImport,false);
  assert.match(p.requiredManualChecks.join(' '),/arbitrary elevation zero\/tilt/);
  assert.deepEqual(sourceById('io-tvashtar-900m').expectedSize,[286,641]);
});
test('wrong raster format/size and missing Io identity are hard errors',()=>{
  let p=evaluate('io-tvashtar-900m',raster({driverShortName:'PNG',size:[512,512]}));
  assert.equal(p.structurallyValid,false);
  assert.ok(p.errors.some(e=>e.includes('driver')));
  assert.ok(p.errors.some(e=>e.includes('size')));
  p=evaluate('io-white-2014-global',raster({coordinateSystem:{wkt:'PROJCS["Moon Equirectangular"]'}}));
  assert.equal(p.structurallyValid,false);
});
test('north-up, one height band and valid samples are required',()=>{
  const p=evaluate('io-white-2014-global',raster({
    bands:[{type:'CFloat32'},{type:'Byte'}],
    geoTransform:[0,1,0,0,0,1]
  }));
  assert.equal(p.structurallyValid,false);
  assert.ok(p.errors.some(e=>e.includes('band')));
  assert.ok(p.errors.some(e=>e.includes('sample type')));
  assert.ok(p.errors.some(e=>e.includes('north-up')));
});
test('mask absence is a warning, not a reason to manufacture elevations',()=>{
  const p=evaluate('io-white-2014-global',raster({bands:[{type:'Float32'}]}));
  assert.equal(p.structurallyValid,true);
  assert.match(p.warnings.join(' '),/NoData/);
  assert.equal(p.approvedForImport,false);
});
test('preflight does not accept unspecified or unrecognized sources',()=>{
  assert.throws(()=>sourceById('moon'),/Unknown Io source/);
  assert.deepEqual(parseArgs(['--help']),{help:true});
  assert.throws(()=>parseArgs(['--source','io-white-2014-global']),/exactly one/);
  assert.throws(()=>parseArgs(['--source','io-white-2014-global','--raster','x','--gdalinfo-json','y']),/exactly one/);
});

test('generic projection/normalization words cannot impersonate Io metadata',()=>{
  const r=evaluate('io-white-2014-global',raster({
    coordinateSystem:{wkt:'PROJCS["Equirectangular Projection"]'},
    metadata:{SERVICE:'Normalisation and image processing'}
  }));
  assert.equal(r.structurallyValid,false);
  assert.ok(r.errors.some(e=>e.includes('identify Io')));
});
