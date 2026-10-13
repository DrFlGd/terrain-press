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
  assert.match(app, /q: query\(step, !\$\('preview-high'\)\.checked\), p/);
  assert.match(app, /const resolutionSetting = el\.name === 'detail' \|\| el\.name === 'resolution-mode';/);
  assert.match(app, /if \(!resolutionSetting \|\| \$\('preview-high'\)\.checked\) schedule\(\);/);
  assert.match(app, /\$\('preview-high'\)\.addEventListener\('change', async \(\) => \{/);
  assert.match(worker, /mesh: \{ N: hf\.N, stepMm: hf\.stepMm, limited: hf\.limited, cap: hf\.plan\.cap/);
});
test('large model preview camera and virtual plate resize with geometry', () => {
  assert.match(app, /plate\.geometry = new THREE\.PlaneGeometry\(Math\.max\(800, effective \* 1\.2\)/);
  assert.match(app, /cam\.far = Math\.max\(4000, 4000 \* d\)/);
  assert.match(app, /sun\.shadow\.camera\.updateProjectionMatrix\(\)/);
});


test('sampling control is present and matches high-detail preview and export', () => {
  assert.match(html, /id="sampling-limit"/);
  assert.match(html, /id="resolution-auto" value="auto" checked/);
  assert.match(html, /id="resolution-advanced" value="advanced"/);
  assert.match(html, /id="auto-options"/);
  assert.match(html, /id="advanced-options"[^>]*hidden/);
  assert.doesNotMatch(html, /name="detail"[^>]*value="source"/);
  for (const cap of [721, 1441, 2881]) assert.match(html, new RegExp('value="' + cap + '"'));
  assert.match(html, /id="min-feature"/);
  assert.match(app, /samplingLimit: fastPreview \? 721 : \$\('resolution-auto'\)\.checked/);
  assert.match(app, /featureMm: \+\$\('min-feature'\)\.value/);
  assert.match(app, /type: 'plan', q: query\(state.detail\)/);
  assert.match(worker, /C\.meshPlan\(q\.widthMm, q\.size, source\.pxKm, q\.step,/);
  assert.match(worker, /q\.step, q\.samplingLimit, q\.featureMm/);
  assert.match(app, /High-detail preview will build a/);
});


test('Automatic and Advanced modes preserve the planner contract', () => {
  // Execute the actual renderer query helper with a minimal settings mock.
  const match = app.match(/const query = \(step, fastPreview = false\) => \(\{[\s\S]*?\n\}\);/);
  assert.ok(match, 'query helper must remain separately testable');
  const state = { world: 'moon', lat: 0, lon: 25, size: 100 };
  const controls = {
    width: { value: '1000' },
    'resolution-auto': { checked: true },
    'sampling-limit': { value: '1441' },
    'min-feature': { value: '0.4' }
  };
  const $ = id => controls[id];
  const query = Function('state', '$', match[0] + '\nreturn query;')(state, $);
  assert.deepEqual(query('source'), {
    world: 'moon', lat: 0, lon: 25, size: 100, widthMm: 1000,
    step: 'source', samplingLimit: 'auto', featureMm: 0.4
  });
  controls['min-feature'].value = '0.8';
  assert.equal(query('source').featureMm, 0.8);
  controls['resolution-auto'].checked = false;
  const manual = query(0.35);
  assert.equal(manual.step, 0.35);
  assert.equal(manual.samplingLimit, 1441);
  assert.equal(query(0.7, true).samplingLimit, 721, 'fast preview always uses legacy cap');
  assert.match(app, /state\.detail = automaticResolution \? 'source' : \+radio\('detail'\);/);
  assert.match(app, /\$\('auto-options'\)\.hidden = !automaticResolution;/);
  assert.match(app, /\$\('advanced-options'\)\.hidden = automaticResolution;/);
});

test('bundled desktop page mirrors the simplified UI', () => {
  const built = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');
  for (const id of ['resolution-auto', 'resolution-advanced', 'auto-options',
    'advanced-options', 'sampling-limit', 'min-feature', 'preview-high']) {
    assert.ok(built.includes('id="' + id + '"'), 'Missing ' + id + ' in bundled page');
  }
  assert.match(built, /state\.detail = automaticResolution \? 'source' : \+radio\('detail'\);/);
});
