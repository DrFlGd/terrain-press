'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../source/core.js');

const root = path.resolve(__dirname, '..');
const src = p => fs.readFileSync(path.join(root, 'source', p), 'utf8');
const html = src('src.html');
const app = src('app.js');
const worker = src('worker.js');
const core = globalThis.TPCore;

test('the model width input supports a 1,000-mm puzzle', () => {
  assert.match(html, /id="width" min="60" max="1000" step="5"/);
  assert.equal(core.meshPlan(1000, 100, 0.059, 0.7).N, 721);
  assert.equal(core.meshPlan(1000, 100, 0.059, 0.5).N, 721);
  const auto = core.meshPlan(1000, 100, 0.059, 'source');
  assert.equal(auto.N, 721);
  assert.equal(auto.stepMm, 1000 / 720);
  assert.ok(auto.limited);
});
test('preview quality is off by default but matches export query when enabled', () => {
  assert.match(html, /id="preview-high"/);
  assert.doesNotMatch(html, /id="preview-high"[^>]*checked/);
  assert.match(app, /const step = \$\('preview-high'\)\.checked \? state\.detail : PREVIEW_STEP;/);
  assert.match(app, /q: query\(step\), p/);
  assert.match(app, /if \(el\.name !== 'detail' \|\| \$\('preview-high'\)\.checked\) schedule\(\);/);
  assert.match(app, /\$\('preview-high'\)\.addEventListener\('change', \(\) => schedule\(true\)\);/);
  assert.match(worker, /mesh: \{ N: hf\.N, stepMm: hf\.stepMm, limited: hf\.limited \}/);
});
test('large model preview camera and virtual plate resize with geometry', () => {
  assert.match(app, /plate\.geometry = new THREE\.PlaneGeometry\(Math\.max\(800, effective \* 1\.2\)/);
  assert.match(app, /cam\.far = Math\.max\(4000, 4000 \* d\)/);
  assert.match(app, /sun\.shadow\.camera\.updateProjectionMatrix\(\)/);
});
