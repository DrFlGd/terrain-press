'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
require('../source/core.js');

const C = globalThis.TPCore;
const moon = {
  radiusKm: 1737.4, w: 8192, h: 4096, tile: 1024, ovw: 2048, ovh: 1024,
  patches: { tycho: { w: 16, h: 16, west: -3, east: 3, north: 3, south: -3, ppd: 364 } },
  installedPacks: [{ id: 'moon-lola-128', w: 46080, h: 23040, tile: 1024,
    label: 'NASA LOLA 128', imageExt: 'png' }]
};
const patch = () => new Float32Array(16 * 16).fill(83);
const globalTile = value => new Float32Array(1024 * 1024).fill(value);

test('switching 83 m patch -> installed NASA PNG -> patch picks the correct tiles', async () => {
  const requested = [];
  const store = C.makeStore({ moon }, async path => {
    requested.push(path);
    if (path.includes('patch_tycho.webp')) return patch();
    if (path.startsWith('packs/moon-lola-128/') && path.endsWith('.png')) return globalTile(237);
    throw new Error('Unexpected elevation request: ' + path);
  });
  const inPatch = await store.sample('moon', 0, 0, 3, 11);
  assert.equal(inPatch.source.kind, 'patch');
  assert.ok(inPatch.heights.every(h => h === 83));
  const elsewhere = await store.sample('moon', 20, 45, 3, 11);
  assert.equal(elsewhere.source.kind, 'pack');
  assert.ok(elsewhere.source.paths.every(p => p.endsWith('.png')));
  assert.ok(elsewhere.heights.every(h => h === 237));
  const returned = await store.sample('moon', 0, 0, 3, 11);
  assert.equal(returned.source.kind, 'patch');
  assert.equal(returned.heights[0], 83);
  assert.ok(requested.includes('data/moon/patch_tycho.webp'));
  assert.ok(requested.some(p => p.startsWith('packs/moon-lola-128/')));
});

test('higher-res global dataset wins outside patch and sharper patch wins inside', () => {
  const with128 = C.makeStore({moon}, async () => new Float32Array(1024*1024));
  assert.equal(with128.chooseSource('moon', 0, 0, 3, 11).kind, 'patch');
  assert.equal(with128.chooseSource('moon', 20, 45, 3, 11).kind, 'pack');
  const upgraded = { ...moon, installedPacks: [...moon.installedPacks,
    {id:'moon-lola-512',w:184320,h:92160,tile:1024,label:'NASA LOLA 512',imageExt:'png'}] };
  assert.equal(C.makeStore({moon:upgraded},async()=>{}).chooseSource('moon',20,45,3,11).id,'moon-lola-512');
});

test('failed tile load can be retried without restarting the application', async () => {
  let attempts = 0;
  const store = C.makeStore({moon}, async path => {
    if (path.includes('patch_tycho')) return patch();
    if (++attempts === 1) throw new Error('Temporary disk read error');
    return globalTile(42);
  });
  await assert.rejects(store.sample('moon',20,45,2,7), /Temporary disk/);
  const recovered = await store.sample('moon',20,45,2,7);
  assert.ok(recovered.heights.every(v=>v===42));
});

test('mesh planner follows source spacing but never exceeds the 721 x 721 cap', () => {
  const fixed = C.meshPlan(100, 100, 0.059, 0.35);
  assert.equal(fixed.N, 287);
  const auto = C.meshPlan(100, 100, 0.059, 'source');
  assert.equal(auto.N, 721);
  assert.ok(auto.limited);
  const low = C.meshPlan(100, 100, 1.33, 'source');
  assert.equal(low.N, 201);
  const short = C.meshPlan(100, 20, 0.083, 'source');
  assert.ok(short.N > low.N);
  assert.ok(short.N <= 721);
  assert.ok(Math.abs(auto.stepMm - 100/720) < 0.0001);
  const cappedFixed = C.meshPlan(220,100,0.059,0.25);
  assert.equal(cappedFixed.N,721);
  assert.ok(cappedFixed.stepMm > 0.25);
});
