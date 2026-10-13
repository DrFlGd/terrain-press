'use strict';

// Direct NASA PDS LOLA IMG support: original signed 16-bit GDR rasters, not
// repackaged mirrors. The NASA PDS Geosciences Node is an official PDS archive.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const crypto = require('node:crypto');

const SOURCE = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/';
const FILE_BYTES = 2123366400;
const TIERS = [128, 256, 512];
const NASA_HOST = 'pds-geosciences.wustl.edu';
const nameLat = n => String(Math.abs(n)).padStart(2, '0') + (n < 0 ? 's' : 'n');
const bounds = ppd => {
  if (!TIERS.includes(ppd)) throw new Error('Unknown LOLA resolution');
  const bands = ppd === 128 ? [[90, -90]] :
    ppd === 256 ? [[90, 0], [0, -90]] :
      [[90, 45], [45, 0], [0, -45], [-45, -90]];
  const zones = ppd === 128 ? [[0, 360]] :
    ppd === 256 ? [[0, 180], [180, 360]] :
      [[0, 90], [90, 180], [180, 270], [270, 360]];
  return bands.flatMap(([north, south]) => zones.map(([west, east]) => {
    const stem = ppd === 128 ? 'ldem_128' :
      'ldem_' + ppd + '_' + nameLat(south) + '_' + nameLat(north) + '_' +
      String(west).padStart(3, '0') + '_' + String(east).padStart(3, '0');
    return { north, south, west, east, stem, name: stem + '.img',
      rows: (north - south) * ppd, cols: (east - west) * ppd, bytes: FILE_BYTES };
  }));
};
function nasaResponse(response) {
  try {
    const u = new URL(response.url);
    return u.protocol === 'https:' && u.hostname === NASA_HOST &&
      !u.username && !u.password;
  } catch { return false; }
}
function parseLabel(content, c) {
  function read(name) {
    const m = content.match(new RegExp('^\\s*' + name + '\\s*=\\s*([^\\r\\n]+)', 'mi'));
    if (!m) throw new Error('NASA PDS label missing ' + name + ': ' + c.name);
    return m[1].replace(/\/\*.*$/, '').trim();
  }
  const lines = Number.parseInt(read('LINES'), 10);
  const samples = Number.parseInt(read('LINE_SAMPLES'), 10);
  const bits = Number.parseInt(read('SAMPLE_BITS'), 10);
  const type = read('SAMPLE_TYPE').replace(/"/g, '').toUpperCase();
  const scale = Number.parseFloat(read('SCALING_FACTOR'));
  const offset = Number.parseFloat(read('OFFSET'));
  if (lines !== c.rows || samples !== c.cols || bits !== 16 ||
      !['MSB_INTEGER', 'LSB_INTEGER', 'PC_INTEGER'].includes(type) ||
      Math.abs(scale - 0.5) > 1e-8 || Math.abs(offset - 1737400) > 0.01) {
    throw new Error('Unexpected NASA PDS data format: ' + c.name);
  }
  return { bigEndian: type === 'MSB_INTEGER', scale, offset };
}
function complete(dir, ppd) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'receipt.json'), 'utf8'));
    if (manifest.ppd !== ppd || !Array.isArray(manifest.files)) return false;
    const entries = bounds(ppd);
    if (manifest.files.length !== entries.length) return false;
    return entries.every(c => {
      const m = manifest.files.find(f => f.name === c.name);
      return m && m.bytes === c.bytes && m.type && /^[a-f0-9]{64}$/.test(m.sha256) &&
        fs.statSync(path.join(dir, c.name)).size === c.bytes &&
        fs.existsSync(path.join(dir, c.stem + '.lbl'));
    });
  } catch { return false; }
}
async function getLabel(c, signal) {
  const url = SOURCE + c.stem + '.lbl';
  const res = await fetch(url, { signal });
  if (!res.ok || !nasaResponse(res)) throw new Error('NASA PDS label download failed: ' + c.name);
  const header = res.headers.get('content-length');
  if (header && Number(header) > 200000) throw new Error('Unexpected NASA label size');
  const label = await res.text();
  if (label.length > 200000) throw new Error('Unexpected NASA label size');
  const metadata = parseLabel(label, c);
  return { label, metadata };
}
async function fetchImage(c, dir, signal, onBytes) {
  const target = path.join(dir, c.name);
  const partial = target + '.part';
  if (fs.existsSync(target) && fs.statSync(target).size === c.bytes) {
    onBytes(c.bytes);
    return target;
  }
  let offset = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  if (offset > c.bytes) { fs.rmSync(partial, { force: true }); offset = 0; }
  if (offset === c.bytes) {
    fs.renameSync(partial, target);
    onBytes(c.bytes);
    return target;
  }
  const headers = offset ? { Range: 'bytes=' + offset + '-' } : {};
  const res = await fetch(SOURCE + c.name, { signal, headers });
  if (!nasaResponse(res) || !res.body || ![200, 206].includes(res.status))
    throw new Error('NASA PDS image download failed: ' + c.name + ' (HTTP ' + res.status + ')');
  if (offset && res.status === 206) {
    const range = res.headers.get('content-range') || '';
    if (!range.startsWith('bytes ' + offset + '-') || !range.endsWith('/' + c.bytes))
      throw new Error('NASA returned an unexpected resume byte range');
  } else if (offset && res.status === 200) {
    // Server ignored Range; restart safely rather than appending duplicate data.
    offset = 0;
  } else if (!offset && res.status === 206) {
    throw new Error('Unexpected partial response for full IMG download');
  }
  let received = offset;
  const check = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      if (received > c.bytes) return callback(new Error('NASA IMG is larger than its PDS label'));
      onBytes(received);
      callback(null, chunk);
    }
  });
  // Preserve .part on failure: next invocation resumes at the exact byte offset.
  await pipeline(Readable.fromWeb(res.body), check,
    fs.createWriteStream(partial, { flags: offset ? 'a' : 'w' }), { signal });
  if (received !== c.bytes) throw new Error('Incomplete NASA IMG: ' + c.name);
  fs.renameSync(partial, target);
  return target;
}
async function install({ ppd, staging, signal, progress, report }) {
  const entries = bounds(ppd);
  fs.mkdirSync(staging, { recursive: true });
  progress.totalFiles = entries.length;
  progress.totalBytes = entries.length * FILE_BYTES;
  progress.phase = 'downloading from NASA';
  report();
  const finished = [];
  for (const c of entries) {
    if (signal.aborted) throw new Error('Download cancelled');
    const { label, metadata } = await getLabel(c, signal);
    fs.writeFileSync(path.join(staging, c.stem + '.lbl'), label, 'utf8');
    let lastReport = 0;
    await fetchImage(c, staging, signal, received => {
      progress.currentFileBytes = received;
      const now = Date.now();
      if (now - lastReport > 300 || received === c.bytes) {
        lastReport = now;
        report();
      }
    });
    progress.phase = 'verifying downloaded file';
    report();
    // Remember checksum of exact NASA bytes for later auditing (PDS does not publish a SHA-256 here).
    const sha256 = await new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(path.join(staging, c.name));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
    finished.push({ name: c.name, bytes: c.bytes, sha256, type: metadata.bigEndian ? 'MSB_INTEGER' : 'LSB_INTEGER' });
    progress.downloadedBytes += c.bytes;
    progress.doneFiles++;
    progress.currentFileBytes = 0;
    progress.phase = 'downloading from NASA';
    report();
  }
  const receipt = {
    schemaVersion: 1, source: SOURCE, provider: 'NASA Planetary Data System (PDS Geosciences Node)',
    ppd, referenceRadiusM: 1737400, heightScale: 0.5,
    downloadedAt: new Date().toISOString(), files: finished
  };
  fs.writeFileSync(path.join(staging, 'receipt.json'), JSON.stringify(receipt, null, 2));
  return receipt;
}
function tileInfo(ppd, tileName) {
  if (!TIERS.includes(ppd)) throw new Error('Unknown resolution');
  const m = /^t(\d+)_(\d+)\.png$/.exec(tileName);
  if (!m) throw new Error('Unexpected tile name');
  const row = Number(m[1]), col = Number(m[2]);
  const w = ppd * 360, h = ppd * 180, tile = 1024;
  if (row >= Math.ceil(h / tile) || col >= Math.ceil(w / tile))
    throw new Error('Tile outside lunar grid');
  return { x: col * tile, y: row * tile, width: Math.min(tile, w - col * tile),
    height: Math.min(tile, h - row * tile), w, h };
}
function findComponent(ppd, x, y) {
  const W = ppd * 360;
  const nasaX = (x + W / 2) % W;  // browser grids begin at -180°, NASA LDEM starts at 0°
  const lon = nasaX / ppd;
  const lat = 90 - y / ppd;
  const c = bounds(ppd).find(c =>
    lat <= c.north && lat > c.south && lon >= c.west && lon < c.east);
  if (!c) throw new Error('Unable to map NASA grid cell');
  return { c, x: nasaX - c.west * ppd, y: y - (90 - c.north) * ppd };
}
function generateTile(packDir, ppd, tileName) {
  const { x, y, width, height, w } = tileInfo(ppd, tileName);
  const png = new PNG({ width, height, colorType: 6, inputColorType: 6, bitDepth: 8 });
  const descriptors = new Map();
  const receipt = JSON.parse(fs.readFileSync(path.join(packDir, 'receipt.json'), 'utf8'));
  try {
    for (let r = 0; r < height; r++) {
      let offsetX = 0;
      while (offsetX < width) {
        const originalX = x + offsetX;
        const { c, x: srcX, y: srcY } = findComponent(ppd, originalX, y + r);
        let fd = descriptors.get(c.name);
        if (!fd) {
          const file = receipt.files.find(f => f.name === c.name);
          if (!file) throw new Error('Missing NASA image metadata');
          fd = { handle: fs.openSync(path.join(packDir, c.name), 'r'), bigEndian: file.type === 'MSB_INTEGER' };
          descriptors.set(c.name, fd);
        }
        const run = Math.min(width - offsetX, c.cols - srcX);
        const rowBytes = Buffer.allocUnsafe(run * 2);
        const pos = (srcY * c.cols + srcX) * 2;
        const read = fs.readSync(fd.handle, rowBytes, 0, rowBytes.length, pos);
        if (read !== rowBytes.length) throw new Error('Incomplete source image read');
        for (let i = 0; i < run; i++) {
          const dn = fd.bigEndian ? rowBytes.readInt16BE(i * 2) : rowBytes.readInt16LE(i * 2);
          // NASA: radius (m) = DN*0.5 + 1737400. Terrain Press encodes height relative
          // to its 1737400-m sphere, rounded to whole metres into RGB (R*256+G-32768).
          const cm = Math.max(0, Math.min(65535, Math.round(dn * 0.5) + 32768));
          const idx = (r * width + offsetX + i) * 4;
          png.data[idx] = cm >>> 8;
          png.data[idx + 1] = cm & 255;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 255;
        }
        offsetX += run;
      }
    }
    return PNG.sync.write(png, { colorType: 6 });
  } finally {
    for (const fd of descriptors.values()) fs.closeSync(fd.handle);
  }
}
module.exports = { SOURCE, FILE_BYTES, bounds, parseLabel, complete, install, generateTile, tileInfo, findComponent };
