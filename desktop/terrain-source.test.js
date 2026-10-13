'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
require('../source/core.js');

const moon = {
  radiusKm: 1737.4, w: 8192, h: 4096, tile: 1024, ovw: 2048, ovh: 1024,
  patches: { tycho: { w: 2000, h: 1000, west: -10, east: 10, north: 10, south: -10, ppd: 364 } }
};
const installed = { id: 'moon-lola-128', body: 'moon', w: 46080, h: 23040, tile: 1024, label: 'LOLA LDEM 128' };
const sampler = record => globalThis.TPCore.makeStore({ moon: record }, () => Promise.reject(new Error('Unexpected tile read')));

test('optional whole-Moon pack is used at arbitrary coordinates', () => {
  const source = sampler({ ...moon, installedPacks: [installed] }).chooseSource('moon', 40, 60, 10, 35);
  assert.equal(source.kind, 'pack');
  assert.equal(source.id, installed.id);
  assert.equal(source.w, 46080);
  assert.ok(source.paths.every(p => /^packs\/moon-lola-128\/t\d+_\d+\.webp$/.test(p)));
});
test('sharper local patch wins over coarser optional pack', () => {
  const source = sampler({ ...moon, installedPacks: [installed] }).chooseSource('moon', 0, 0, 10, 35);
  assert.equal(source.kind, 'patch');
  assert.equal(source.id, 'tycho');
});
test('no optional pack uses the included global tiles', () => {
  const source = sampler(moon).chooseSource('moon', 40, 60, 10, 35);
  assert.equal(source.kind, 'tiles');
  assert.ok(source.paths.every(p => p.startsWith('data/moon/t')));
});
