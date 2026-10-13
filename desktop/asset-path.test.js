'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { resolveAssetPath } = require('./asset-path');

const root = path.resolve('site');

test('maps the app root to the built index', () => {
  assert.equal(resolveAssetPath(root, 'terrain://app/'), path.join(root, 'index.html'));
});

test('resolves worker, terrain data and query strings inside the site', () => {
  assert.equal(resolveAssetPath(root, 'terrain://app/worker.js?v=123'), path.join(root, 'worker.js'));
  assert.equal(resolveAssetPath(root, 'terrain://app/data/moon/t0_0.webp'), path.join(root, 'data', 'moon', 't0_0.webp'));
});

test('rejects other origins and malformed addresses', () => {
  for (const url of ['https://app/index.html', 'terrain://other/index.html',
    'terrain://app.evil/index.html', 'not a URL', 'terrain://app/%00secret',
    'terrain://app/%5cWindows%5csystem.ini', 'terrain://app/%2e%2e%2fsecret']) {
    assert.equal(resolveAssetPath(root, url), null, url);
  }
});
