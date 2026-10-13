'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PNG } = require('pngjs');
const MOLA = require('./nasa-mola');
const { PackStore } = require('./pack-store');

test('NASA PDS Mars MOLA 64 grid has four exact named global topography files', () => {
  const b = MOLA.bounds();
  assert.equal(b.length, 4);
  assert.deepEqual(b.map(o=>o.name), [
    'megt90n000gb.img','megt90n180gb.img','megt00n000gb.img','megt00n180gb.img'
  ]);
  assert.equal(b.reduce((n,c)=>n+c.bytes,0), 530841600);
  assert.ok(b.every(c=>c.rows===5760 && c.cols===11520 && c.bytes===MOLA.FILE_BYTES));
  assert.ok(MOLA.SOURCE.startsWith('https://pds-geosciences.wustl.edu/mgs/'));
});
test('MOLA topography PDS labels reject wrong scale, datum, endian, and tile size', () => {
  const c=MOLA.bounds()[0];
  const label=[
    'PRODUCT_VERSION_ID = "2.0"','OBJECT = IMAGE',
    'LINES = 5760','LINE_SAMPLES = 11520',
    'SAMPLE_BITS = 16','SAMPLE_TYPE = MSB_INTEGER',
    'SCALING_FACTOR = 1','OFFSET = 0',
    'MAP_RESOLUTION = 64 <PIX/DEG>'
  ].join('\n');
  assert.deepEqual(MOLA.parseLabel(label,c),{bigEndian:true,scale:1,offset:0});
  assert.throws(()=>MOLA.parseLabel(label.replace('OFFSET = 0','OFFSET = 3396000'),c));
  assert.throws(()=>MOLA.parseLabel(label.replace('LINES = 5760','LINES = 6000'),c));
  assert.throws(()=>MOLA.parseLabel(label.replace('SAMPLE_BITS = 16','SAMPLE_BITS = 32'),c));
  assert.throws(()=>MOLA.parseLabel(label.replace('64 <PIX/DEG>','128 <PIX/DEG>'),c));
  assert.throws(()=>MOLA.parseLabel(label.replace('MSB_INTEGER','UNSIGNED_INTEGER'),c));
});
test('Mars MOLA coordinate mapping and areoid-relative signed elevation', () => {
  const ppd=64, W=360*ppd,H=180*ppd;
  assert.deepEqual([MOLA.findComponent(0,0).c.west, MOLA.findComponent(0,0).x],[180,0]);
  assert.deepEqual([MOLA.findComponent(W/2,H/2).c.west,MOLA.findComponent(W/2,H/2).c.north],[0,0]);
  assert.equal(MOLA.findComponent(W-1,H-1).y,5760-1);
  assert.equal(MOLA.tileInfo('t0_0.png').width,1024);
  assert.equal(MOLA.tileInfo('t0_22.png').width,512);
  assert.equal(MOLA.tileInfo('t11_0.png').height,256);
  assert.throws(()=>MOLA.tileInfo('t12_0.png'));
  assert.throws(()=>MOLA.tileInfo('../../evil.png'));
  assert.equal(MOLA.encodeHeight(-8100),24668);
  assert.equal(MOLA.encodeHeight(9000),41768);
  assert.throws(()=>MOLA.encodeHeight(-32768));
});
test('Mars is an advertised direct-download beta and preserves lunar packs', () => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'terrain-mola-'));
  try {
    const store=new PackStore(tmp);
    const mars=store.catalogPack('mars-mola-64');
    assert.equal(mars.status,'published');
    assert.equal(mars.format,'nasa-mola-img');
    assert.equal(mars.body,'mars');
    assert.equal(store.catalogPack('moon-lola-128').format,'nasa-pds-img');
    assert.equal(store.status().catalog.filter(p=>p.body==='mars').length,1);
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});
test('on-demand Martian source tile uses signed metre encoding, without a download', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terrain-mola-tile-'));
  try {
    // A minimal local stand-in for one row in the authentic 11,520-column
    // source raster, at tile t0_0 which reads from the 180°-360° quadrant.
    const c=MOLA.bounds().find(c=>c.north===90 && c.west===180);
    const fd=fs.openSync(path.join(dir,c.name),'w');
    // Sparse file gives a valid row-addressed source without writing 133 MB.
    fs.ftruncateSync(fd,c.bytes);
    const buf=Buffer.alloc(1024*2);
    for(let k=0;k<1024;k++)buf.writeInt16BE(k%2?-8100:9000,k*2);
    for(let r=0;r<1024;r++)fs.writeSync(fd,buf,0,buf.length,r*c.cols*2);
    fs.closeSync(fd);
    fs.writeFileSync(path.join(dir,'receipt.json'),JSON.stringify({files:[{name:c.name,type:'MSB_INTEGER'}]}));
    const png=PNG.sync.read(MOLA.generateTile(dir,'t0_0.png'));
    assert.equal(png.width,1024);
    assert.equal(png.height,1024);
    const at=(x,y)=>png.data[(y*png.width+x)*4]*256+png.data[(y*png.width+x)*4+1]-32768;
    assert.equal(at(0,0),9000);
    assert.equal(at(1,0),-8100);
    assert.equal(at(1,1023),-8100);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
