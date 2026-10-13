'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PackStore, verifyManifest } = require('./pack-store');

const p = { id: 'moon-test-128', body: 'moon', w: 2048, h: 1024, tile: 1024 };
const manifest = { schemaVersion: 1, ...p, baseUrl: 'https://example.org/tiles/',
  files: ['t0_0.webp', 't0_1.webp'].map(name => ({
    name, bytes: 100, sha256: 'a'.repeat(64)
  }))
};

test('accepts exact global tile coverage', () => assert.equal(verifyManifest(p, manifest), 200));
test('rejects missing, duplicate and traversal tile paths', () => {
  for (const files of [manifest.files.slice(0, 1),
    [manifest.files[0], manifest.files[0]],
    [{ ...manifest.files[0], name: '../evil.webp' }, manifest.files[1]]]) {
    assert.throws(() => verifyManifest(p, { ...manifest, files }));
  }
});
test('rejects non-HTTPS manifest origins', () => {
  assert.throws(() => verifyManifest(p, { ...manifest, baseUrl: 'http://example.org/' }));
});
test('new installation is offline and has only bundled datasets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'terrain-packs-test-'));
  try {
    const store = new PackStore(root);
    assert.equal(store.status().bundled.length, 7);
    assert.deepEqual(store.status().installed, []);
    // Installed-pack asset resolution is asynchronous.
    assert.equal(store.cancel('moon-lola-128'), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('NASA direct catalog tiers and storage are present', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'terrain-packs-test-'));
  try {
    const store = new PackStore(root);
    const p=store.catalogPack('moon-lola-128');
    assert.equal(p.status,'published');
    assert.equal(p.downloadBytes,2123366400);
    assert.equal(await store.assetForUrl('terrain://app/packs/moon-lola-128/t0_0.png'),null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
