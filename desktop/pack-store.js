'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const ID = /^[a-z][a-z0-9-]{1,63}$/;
const TILE = /^t(\d+)_(\d+)\.webp$/;
const SHA = /^[a-f0-9]{64}$/;
const MAX_MANIFEST_BYTES = 32 * 1024 * 1024;
const CATALOG = require('./packs/catalog.json');
const NASA = require('./nasa-lola');
const MOLA = require('./nasa-mola');
// Driver is selected only by a catalog-controlled format.
const rasterDriver = pack => pack.format === 'nasa-pds-img' ? NASA :
  pack.format === 'nasa-mola-img' ? MOLA : null;

function httpsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && !u.hash;
  } catch { return false; }
}
function shaFile(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('data', b => h.update(b));
    s.on('error', reject);
    s.on('end', () => resolve(h.digest('hex')));
  });
}
function verifyManifest(p, m) {
  if (!m || m.schemaVersion !== 1 || m.id !== p.id || m.body !== p.body ||
      m.w !== p.w || m.h !== p.h || m.tile !== p.tile || !httpsUrl(m.baseUrl) ||
      !Array.isArray(m.files)) throw new Error('Invalid or mismatched terrain pack manifest');
  const rows = Math.ceil(p.h / p.tile), cols = Math.ceil(p.w / p.tile);
  if (rows * cols > 50000 || m.files.length !== rows * cols) throw new Error('Incomplete global terrain grid');
  const seen = new Set();
  let total = 0;
  for (const f of m.files) {
    const match = typeof f.name === 'string' && TILE.exec(f.name);
    if (!match || Number(match[1]) >= rows || Number(match[2]) >= cols ||
        seen.has(f.name) || !Number.isSafeInteger(f.bytes) || f.bytes < 1 ||
        !SHA.test(f.sha256)) throw new Error('Invalid terrain tile metadata');
    seen.add(f.name);
    total += f.bytes;
    if (!Number.isSafeInteger(total)) throw new Error('Pack is too large');
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!seen.has('t' + r + '_' + c + '.webp')) throw new Error('Missing terrain tiles');
  }
  return total;
}
function asError(e) { return e && e.message ? e.message : String(e); }

class PackStore {
  constructor(userData, notify = () => {}) {
    this.userData = userData;
    this.notify = notify;
    this.settingsPath = path.join(userData, 'terrain-datasets.json');
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8')); } catch {}
    this.root = typeof saved.root === 'string' && path.isAbsolute(saved.root)
      ? path.resolve(saved.root) : path.join(userData, 'terrain-datasets');
    this.installed = new Set(Array.isArray(saved.installed) ? saved.installed.filter(id => ID.test(id)) : []);
    this.active = null;
    this.tileJobs = new Map();
    fs.mkdirSync(this.root, { recursive: true });
  }
  save() {
    fs.mkdirSync(this.userData, { recursive: true });
    const temp = this.settingsPath + '.tmp';
    fs.writeFileSync(temp, JSON.stringify({ root: this.root, installed: [...this.installed] }, null, 2));
    fs.renameSync(temp, this.settingsPath);
  }
  catalogPack(id) { return CATALOG.packs.find(p => p.id === id); }
  status() {
    const installed = [...this.installed].map(id => this.catalogPack(id)).filter(Boolean)
      .filter(p => {
        const driver = rasterDriver(p);
        return driver ? driver.complete(path.join(this.root, p.id), p.ppd)
          : fs.existsSync(path.join(this.root, p.id));
      });
    return {
      root: this.root, bundled: CATALOG.builtIn, catalog: CATALOG.packs,
      installed: installed.map(p => ({ id: p.id, body: p.body, w: p.w, h: p.h, tile: p.tile, label: p.name, imageExt: rasterDriver(p) ? 'png' : 'webp' })),
      active: this.active ? this.active.progress : null
    };
  }
  async chooseDirectory(dialog) {
    if (this.active) throw new Error('Cancel the active download before changing folders');
    if (this.installed.size) throw new Error('Remove installed optional packs before changing storage folders');
    const result = await dialog.showOpenDialog({ title: 'Choose terrain dataset storage location',
      properties: ['openDirectory', 'createDirectory'] });
    if (!result.canceled && result.filePaths[0]) {
      const chosen = path.resolve(result.filePaths[0]);
      fs.accessSync(chosen, fs.constants.W_OK);
      this.root = chosen;
      this.save();
    }
    return this.status();
  }
  async assetForUrl(requestUrl) {
    let parsed;
    try { parsed = new URL(requestUrl); } catch { return null; }
    const match = /^\/packs\/([a-z][a-z0-9-]{1,63})\/(t\d+_\d+\.(?:webp|png))$/.exec(parsed.pathname);
    if (!match || !this.installed.has(match[1])) return null;
    const pack = this.catalogPack(match[1]);
    if (!pack) return null;
    const dir = path.join(this.root, pack.id);
    const driver = rasterDriver(pack);
    if (!driver) {
      if (!match[2].endsWith('.webp') || !fs.existsSync(dir)) return null;
      return path.join(dir, match[2]);
    }
    if (!match[2].endsWith('.png') || !driver.complete(dir, pack.ppd)) return null;
    try {
      if (pack.format === 'nasa-mola-img') driver.tileInfo(match[2]);
      else driver.tileInfo(pack.ppd, match[2]);
    } catch { return null; }
    const cache = path.join(dir, 'cache'), tile = path.join(cache, match[2]);
    if (fs.existsSync(tile)) return tile;
    if (!this.tileJobs.has(tile)) {
      const job = (async () => {
        await fs.promises.mkdir(cache, { recursive: true });
        // Convert the needed native IMG cells only; never build a second whole-planet copy.
        const png = pack.format === 'nasa-mola-img'
          ? driver.generateTile(dir, match[2])
          : driver.generateTile(dir, pack.ppd, match[2]);
        const partial = tile + '.' + process.pid + '.partial';
        try {
          await fs.promises.writeFile(partial, png);
          await fs.promises.rename(partial, tile);
        } finally { await fs.promises.rm(partial, { force: true }); }
        return tile;
      })().finally(() => this.tileJobs.delete(tile));
      this.tileJobs.set(tile, job);
    }
    return this.tileJobs.get(tile);
  }
  async remove(id) {
    if (this.active) throw new Error('Cannot remove packs during a download');
    if (!ID.test(id) || !this.installed.has(id)) throw new Error('Pack not installed');
    fs.rmSync(path.join(this.root, id), { recursive: true, force: true });
    this.installed.delete(id);
    this.save();
    return this.status();
  }
  cancel(id) {
    if (!this.active || this.active.id !== id) return false;
    this.active.controller.abort();
    return true;
  }
  async downloadNasa(pack) {
    if (this.active) throw new Error('Another dataset download is active');
    if (this.installed.has(pack.id)) throw new Error('Dataset is already installed');
    const controller = new AbortController();
    const progress = { id: pack.id, phase: 'connecting to NASA', doneFiles: 0,
      totalFiles: 0, downloadedBytes: 0, totalBytes: pack.downloadBytes, currentFileBytes: 0 };
    this.active = { id: pack.id, controller, progress };
    const report = () => this.notify({ ...progress });
    report();
    const staging = path.join(this.root, pack.id + '.incomplete');
    const destination = path.join(this.root, pack.id);
    try {
      if (fs.existsSync(destination)) throw new Error('Destination already exists');
      const driver = rasterDriver(pack);
      if (!driver) throw new Error('Unknown NASA terrain format');
      await driver.install({ ppd: pack.ppd, staging, signal: controller.signal, progress, report });
      if (!driver.complete(staging, pack.ppd)) throw new Error('Dataset verification failed');
      fs.renameSync(staging, destination);
      this.installed.add(pack.id);
      this.save();
      progress.phase = 'complete';
      report();
      return this.status();
    } catch (e) {
      progress.phase = controller.signal.aborted ? 'paused' : 'error';
      progress.error = asError(e);
      report();
      throw new Error(progress.error);
    } finally { this.active = null; }
  }
  async download(id) {
    const pack = this.catalogPack(id);
    if (pack && pack.status === 'published' && rasterDriver(pack)) {
      return this.downloadNasa(pack);
    }
    if (!pack || pack.status !== 'published' || !httpsUrl(pack.manifestUrl) ||
        !SHA.test(pack.manifestSha256 || '')) throw new Error('This dataset is not published yet');
    if (this.active) throw new Error('Another dataset download is active');
    if (this.installed.has(id)) throw new Error('Dataset is already installed');
    const controller = new AbortController();
    const progress = { id, phase: 'manifest', doneFiles: 0, totalFiles: 0, downloadedBytes: 0, totalBytes: 0 };
    this.active = { id, controller, progress };
    const report = () => this.notify({ ...progress });
    report();
    try {
      const res = await fetch(pack.manifestUrl, { signal: controller.signal });
      if (!res.ok || !httpsUrl(res.url)) throw new Error('Could not download the dataset manifest (HTTP ' + res.status + ')');
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength > MAX_MANIFEST_BYTES ||
          crypto.createHash('sha256').update(bytes).digest('hex') !== pack.manifestSha256)
        throw new Error('Dataset manifest checksum mismatch');
      const manifest = JSON.parse(bytes.toString('utf8'));
      progress.totalBytes = verifyManifest(pack, manifest);
      progress.totalFiles = manifest.files.length;
      progress.phase = 'downloading';
      report();

      const staging = path.join(this.root, id + '.incomplete');
      const destination = path.join(this.root, id);
      fs.mkdirSync(staging, { recursive: true });
      // Complete verified tiles are retained across cancellation and process restarts.
      for (const tile of manifest.files) {
        if (controller.signal.aborted) throw new Error('Download cancelled');
        const file = path.join(staging, tile.name);
        if (fs.existsSync(file) && fs.statSync(file).size === tile.bytes &&
            await shaFile(file) === tile.sha256) {
          progress.doneFiles++; progress.downloadedBytes += tile.bytes; report(); continue;
        }
        const temp = file + '.part';
        try {
          const url = new URL(encodeURIComponent(tile.name), manifest.baseUrl.endsWith('/') ? manifest.baseUrl : manifest.baseUrl + '/').href;
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok || !httpsUrl(response.url) || !response.body) throw new Error('Tile download failed: ' + tile.name);
          let size = 0;
          const hash = crypto.createHash('sha256');
          const inspect = new Transform({
            transform(chunk, encoding, done) {
              size += chunk.length;
              hash.update(chunk);
              if (size > tile.bytes) return done(new Error('Tile exceeds declared size'));
              progress.currentFileBytes = size;
              report();
              done(null, chunk);
            }
          });
          await pipeline(Readable.fromWeb(response.body), inspect, fs.createWriteStream(temp), { signal: controller.signal });
          if (size !== tile.bytes || hash.digest('hex') !== tile.sha256) throw new Error('Tile checksum mismatch: ' + tile.name);
          fs.renameSync(temp, file);
        } catch (e) {
          fs.rmSync(temp, { force: true });
          throw e;
        }
        progress.currentFileBytes = 0;
        progress.doneFiles++;
        progress.downloadedBytes += tile.bytes;
        report();
      }
      if (fs.existsSync(destination)) throw new Error('Destination already exists');
      fs.renameSync(staging, destination);
      this.installed.add(id);
      this.save();
      progress.phase = 'complete';
      report();
      return this.status();
    } catch (e) {
      progress.phase = controller.signal.aborted ? 'paused' : 'error';
      progress.error = asError(e);
      report();
      throw new Error(progress.error);
    } finally {
      this.active = null;
    }
  }
}
module.exports = { PackStore, verifyManifest, httpsUrl };
