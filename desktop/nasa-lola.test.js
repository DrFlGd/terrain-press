'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bounds, parseLabel, findComponent, tileInfo, FILE_BYTES, SOURCE } = require('./nasa-lola');

test('direct NASA files: naming, partitioning, expected bytes', () => {
  assert.deepEqual([128,256,512].map(x=>bounds(x).length), [1,4,16]);
  assert.equal(bounds(128)[0].name, 'ldem_128.img');
  assert.ok(bounds(256).some(c=>c.name==='ldem_256_00n_90n_000_180.img'));
  assert.ok(bounds(512).some(c=>c.name==='ldem_512_90s_45s_270_360.img'));
  assert.ok(SOURCE.startsWith('https://pds-geosciences.wustl.edu/'));
  for(const ppd of [128,256,512]) for (const c of bounds(ppd)) {
    assert.equal(c.rows*c.cols*2, FILE_BYTES);
  }
});
test('label dimensions, scale and datum are checked', () => {
  const c=bounds(128)[0];
  const label=['LINES = 23040','LINE_SAMPLES = 46080','SAMPLE_BITS = 16',
    'SAMPLE_TYPE = MSB_INTEGER','SCALING_FACTOR = 0.5','OFFSET = 1737400'].join('\n');
  assert.deepEqual(parseLabel(label,c),{bigEndian:true,scale:0.5,offset:1737400});
  assert.throws(()=>parseLabel(label.replace('SAMPLE_BITS = 16','SAMPLE_BITS = 32'),c));
  assert.throws(()=>parseLabel(label.replace('OFFSET = 1737400','OFFSET = 0'),c));
});
test('longitude and latitude source coordinate transform', () => {
  for(const ppd of [128,256,512]) {
    const left=findComponent(ppd,0,0);
    assert.equal(left.c.west,180);
    assert.equal(left.x,0);
    const middle=findComponent(ppd,180*ppd,90*ppd);
    assert.equal(middle.c.west,0);
    assert.equal(middle.c.north,0);
    assert.equal(middle.x,0);
    assert.equal(middle.y,0);
    const bottom=findComponent(ppd,360*ppd-1,180*ppd-1);
    assert.equal(bottom.y,bottom.c.rows-1);
  }
});
test('tile bounds reject out of range or path traversal', () => {
  assert.throws(()=>tileInfo(128,'t99_0.png'));
  assert.throws(()=>tileInfo(128,'../../bad.png'));
  assert.equal(tileInfo(128,'t0_0.png').width,1024);
});
