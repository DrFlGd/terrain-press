'use strict';

// Mars Global Surveyor MOLA MEGDR 64 px/degree, PDS4-maintained distribution.
// Four equidistant-cylindrical, signed 16-bit topography images (metres above
// the areoid), 0..360 degrees east; these are not planetary-radius maps.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { PNG } = require('pngjs');

const SOURCE = 'https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg064/';
const NASA_HOST = 'pds-geosciences.wustl.edu';
const PPD = 64, FILE_BYTES = 90 * 180 * PPD * PPD * 2;
const bounds = () => [90, 0].flatMap(north => [0, 180].map(west => {
  const stem = 'megt' + (north === 90 ? '90n' : '00n') +
    String(west).padStart(3, '0') + 'gb';
  return { stem, name: stem + '.img', north, south: north - 90,
    west, east: west + 180, cols: 180 * PPD, rows: 90 * PPD, bytes: FILE_BYTES };
}));
function nasaResponse(response) {
  try {
    const url = new URL(response.url);
    return url.protocol === 'https:' && url.hostname === NASA_HOST &&
      !url.username && !url.password && !url.hash;
  } catch { return false; }
}
function parseLabel(content, c) {
  function field(name, required = true) {
    const match = content.match(new RegExp('^\\s*' + name + '\\s*=\\s*([^\\r\\n]+)', 'mi'));
    if (!match) {
      if (!required) return null;
      throw new Error('MOLA label missing ' + name + ': ' + c.name);
    }
    return match[1].replace(/\/\*.*$/, '').replaceAll('"', '').trim();
  }
  const rows = Number(field('LINES')), cols = Number(field('LINE_SAMPLES'));
  const bits = Number(field('SAMPLE_BITS')), sampleType = field('SAMPLE_TYPE').toUpperCase();
  const scaleRaw = field('SCALING_FACTOR', false), offsetRaw = field('OFFSET', false);
  const scale = scaleRaw === null ? 1 : Number(scaleRaw);
  const offset = offsetRaw === null ? 0 : Number(offsetRaw);
  const objectName = field('NAME', false);
  const version = field('PRODUCT_VERSION_ID', false);
  // PDS MEGDR "T" means areoid-relative height. Never import "R" radius DN
  // or pretend 128ppd's unmapped polar bands are full global coverage.
  if (!c.name.startsWith('megt') || rows !== c.rows || cols !== c.cols ||
      bits !== 16 || !['MSB_INTEGER', 'LSB_INTEGER', 'PC_INTEGER'].includes(sampleType) ||
      scale !== 1 || offset !== 0 || (objectName && objectName.toUpperCase() === 'PLANETARY_RADIUS') ||
      (version && version !== '2.0'))
    throw new Error('Unexpected NASA MOLA topography format: ' + c.name);
  const resolution = field('MAP_RESOLUTION', false);
  if (resolution && Math.abs(Number.parseFloat(resolution) - PPD) > 0.001)
    throw new Error('Unexpected NASA MOLA map resolution');
  return { bigEndian: sampleType === 'MSB_INTEGER', scale, offset };
}
function complete(dir) {
  try {
    const receipt = JSON.parse(fs.readFileSync(path.join(dir, 'receipt.json'), 'utf8'));
    if (receipt.ppd !== PPD || receipt.body !== 'mars' ||
      !Array.isArray(receipt.files) || receipt.files.length !== 4) return false;
    return bounds().every(c => {
      const f = receipt.files.find(v => v.name === c.name);
      return f && f.bytes === c.bytes && ['MSB_INTEGER', 'LSB_INTEGER'].includes(f.type) &&
        /^[a-f0-9]{64}$/.test(f.sha256) &&
        fs.statSync(path.join(dir, c.name)).size === c.bytes &&
        fs.existsSync(path.join(dir, c.stem + '.lbl'));
    });
  } catch { return false; }
}
async function getLabel(c, signal) {
  const res = await fetch(SOURCE + c.stem + '.lbl', { signal });
  if (!res.ok || !nasaResponse(res)) throw new Error('NASA MOLA label download failed: ' + c.name);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > 200000) throw new Error('Oversized NASA MOLA label');
  const label = await res.text();
  if (label.length > 200000) throw new Error('Oversized NASA MOLA label');
  return { label, metadata: parseLabel(label, c) };
}
async function fetchImage(c, dir, signal, onBytes) {
  const target = path.join(dir, c.name), partial = target + '.part';
  if (fs.existsSync(target) && fs.statSync(target).size === c.bytes) {
    onBytes(c.bytes); return target;
  }
  let offset = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  if (offset > c.bytes) { fs.rmSync(partial, { force: true }); offset = 0; }
  if (offset === c.bytes) {
    fs.renameSync(partial, target); onBytes(c.bytes); return target;
  }
  const res = await fetch(SOURCE + c.name, {
    signal, headers: offset ? { Range: 'bytes=' + offset + '-' } : {}
  });
  if (!nasaResponse(res) || !res.body || ![200, 206].includes(res.status))
    throw new Error('NASA MOLA IMG download failed: ' + c.name + ' (HTTP ' + res.status + ')');
  if (offset && res.status === 206) {
    const range = res.headers.get('content-range') || '';
    if (!range.startsWith('bytes ' + offset + '-') || !range.endsWith('/' + c.bytes))
      throw new Error('Invalid NASA MOLA resume byte range');
  } else if (offset && res.status === 200) {
    offset = 0; // Range not supported: restart safely.
  } else if (!offset && res.status === 206) {
    throw new Error('Unexpected partial NASA MOLA response');
  }
  let received = offset;
  const check = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      if (received > c.bytes) return callback(new Error('MOLA IMG larger than label size'));
      onBytes(received); callback(null, chunk);
    }
  });
  await pipeline(Readable.fromWeb(res.body), check,
    fs.createWriteStream(partial, { flags: offset ? 'a' : 'w' }), { signal });
  if (received !== c.bytes) throw new Error('Incomplete MOLA IMG: ' + c.name);
  fs.renameSync(partial, target);
  return target;
}
async function install({ staging, signal, progress, report }) {
  const files = bounds(), completed = [];
  fs.mkdirSync(staging, { recursive: true });
  progress.totalFiles = files.length;
  progress.totalBytes = files.reduce((s, c) => s + c.bytes, 0);
  progress.phase = 'downloading from NASA'; report();
  for (const c of files) {
    if (signal.aborted) throw new Error('Download cancelled');
    const { label, metadata } = await getLabel(c, signal);
    fs.writeFileSync(path.join(staging, c.stem + '.lbl'), label);
    let last = 0;
    await fetchImage(c, staging, signal, received => {
      progress.currentFileBytes = received;
      const now = Date.now();
      if (now - last > 300 || received === c.bytes) { last = now; report(); }
    });
    progress.phase = 'verifying downloaded file'; report();
    const sha256 = await new Promise((resolve, reject) => {
      const h = crypto.createHash('sha256'), f = fs.createReadStream(path.join(staging, c.name));
      f.on('data', v => h.update(v)); f.on('error', reject);
      f.on('end', () => resolve(h.digest('hex')));
    });
    completed.push({ name: c.name, bytes: c.bytes, sha256,
      type: metadata.bigEndian ? 'MSB_INTEGER' : 'LSB_INTEGER' });
    progress.doneFiles++; progress.downloadedBytes += c.bytes;
    progress.currentFileBytes = 0; progress.phase = 'downloading from NASA'; report();
  }
  const receipt = { schemaVersion: 1, body: 'mars', ppd: PPD, source: SOURCE,
    provider: 'NASA PDS Geosciences Node — MGS MOLA MEGDR Topography',
    datum: 'topography relative to Martian areoid, metres',
    downloadedAt: new Date().toISOString(), files: completed };
  fs.writeFileSync(path.join(staging, 'receipt.json'), JSON.stringify(receipt, null, 2));
  return receipt;
}
function tileInfo(tileName) {
  const match = /^t(\d+)_(\d+)\.png$/.exec(tileName);
  if (!match) throw new Error('Unexpected MOLA tile name');
  const row = Number(match[1]), col = Number(match[2]);
  const w = PPD * 360, h = PPD * 180, tile = 1024;
  if (!Number.isSafeInteger(row) || !Number.isSafeInteger(col) ||
      row >= Math.ceil(h / tile) || col >= Math.ceil(w / tile))
    throw new Error('MOLA tile outside Mars grid');
  return { x: col * tile, y: row * tile,
    width: Math.min(tile, w - col * tile),
    height: Math.min(tile, h - row * tile), w, h };
}
function findComponent(x, y) {
  const W = PPD * 360, H = PPD * 180;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= W || y < 0 || y >= H)
    throw new Error('MOLA pixel outside Mars grid');
  const nx = (x + W / 2) % W; // Terrain Press starts -180 E; NASA starts 0 E.
  const north = y < H / 2 ? 90 : 0;
  const west = nx < W / 2 ? 0 : 180;
  const c = bounds().find(c => c.north === north && c.west === west);
  return { c, x: nx - west * PPD, y: y - (90 - north) * PPD };
}
function encodeHeight(dn) {
  // MOLA topography DN is signed metres above areoid, unlike LOLA radius.
  // Terrain Press stores encoded integer metres as R*256 + G - 32768.
  if (!Number.isInteger(dn) || dn === -32768 || dn < -32767 || dn > 32767)
    throw new Error('NASA MOLA raster contains invalid or NoData height');
  return dn + 32768;
}
function generateTile(dir, tileName) {
  const { x, y, width, height } = tileInfo(tileName);
  const receipt = JSON.parse(fs.readFileSync(path.join(dir, 'receipt.json'), 'utf8'));
  const png = new PNG({ width, height, colorType: 6, inputColorType: 6, bitDepth: 8 });
  const handles = new Map();
  try {
    for (let r = 0; r < height; r++) {
      let k = 0;
      while (k < width) {
        const pos = findComponent(x + k, y + r);
        let info = handles.get(pos.c.name);
        if (!info) {
          const descriptor = receipt.files.find(f => f.name === pos.c.name);
          if (!descriptor || !['MSB_INTEGER', 'LSB_INTEGER'].includes(descriptor.type))
            throw new Error('Missing MOLA source metadata');
          info = { fd: fs.openSync(path.join(dir, pos.c.name), 'r'), be: descriptor.type === 'MSB_INTEGER' };
          handles.set(pos.c.name, info);
        }
        const run = Math.min(width - k, pos.c.cols - pos.x);
        const row = Buffer.allocUnsafe(run * 2);
        const bytes = fs.readSync(info.fd, row, 0, row.length, (pos.y * pos.c.cols + pos.x) * 2);
        if (bytes !== row.length) throw new Error('Incomplete NASA MOLA raster row');
        for (let j = 0; j < run; j++) {
          const dn = info.be ? row.readInt16BE(j * 2) : row.readInt16LE(j * 2);
          const n = encodeHeight(dn), o = 4 * (r * width + k + j);
          png.data[o] = n >>> 8; png.data[o + 1] = n & 255;
          png.data[o + 2] = 0; png.data[o + 3] = 255;
        }
        k += run;
      }
    }
    return PNG.sync.write(png, { colorType: 6 });
  } finally {
    for (const fd of handles.values()) fs.closeSync(fd.fd);
  }
}
module.exports = { SOURCE, PPD, FILE_BYTES, bounds, parseLabel, complete,
  install, tileInfo, findComponent, encodeHeight, generateTile };
