// Terrain Press worker: decodes elevation tiles, builds meshes and print files off the main thread.
importScripts('lib/poly2tri.min.js', 'lib/clipper.js', 'core.js' + self.location.search);
const C = self.TPCore;
let meta = null, store = null;
const fonts = {};

async function decode(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error('Could not load ' + path);
  const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = new OffscreenCanvas(bmp.width, bmp.height), ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data, out = new Float32Array(bmp.width * bmp.height);
  for (let i = 0, k = 0; i < out.length; i++, k += 4) out[i] = px[k] * 256 + px[k + 1] - 32768;
  if (path.endsWith('overview.webp')) {
    const body = path.split('/')[1], w = bmp.width; let s = 0;
    for (let x = 0; x < w; x++) s += out[512 * w + x];
    if (meta[body].check !== undefined && Math.round(s) !== meta[body].check) self.postMessage({ type: 'warn', text: 'This browser changed the elevation images while decoding them, so heights may be slightly off.' });
  }
  return out;
}

async function heights(q, onProgress) {
  const N = Math.min(721, Math.round(q.widthMm / q.step) + 1);
  const s = await store.sample(q.world, q.lat, q.lon, q.size, N, onProgress);
  return { heights: s.heights, N, sizeKm: q.size, source: s.source };
}

const cache = { key: '', hf: null };
async function getHF(q, id) {
  const N = Math.min(721, Math.round(q.widthMm / q.step) + 1);
  const key = [q.world, q.lat, q.lon, q.size, N].join('|');
  if (cache.key !== key) {
    const hf = await heights(q, (d, n) => n > 1 && self.postMessage({ type: 'progress', id, text: `Loading elevation · ${d}/${n}` }));
    cache.key = key; cache.hf = hf;
  }
  return cache.hf;
}

function pack(model, forPreview) {
  const parts = [], transfer = [];
  for (const p of model.parts) {
    if (forPreview) {
      const w = C.weld(p.tris), v = new Float32Array(w.verts);
      parts.push({ name: p.name, role: p.role, cell: p.cell || null, verts: v, idx: w.idx }); transfer.push(v.buffer, w.idx.buffer);
    } else parts.push(p);
  }
  return { parts, transfer };
}

async function deflate(u8) {
  if (typeof CompressionStream === 'undefined') return u8;
  const s = new Response(u8).body.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// one piece on its own: centred on the plate, flat on z = 0
function centre(o) {
  const t = o.tris; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity;
  for (let i = 0; i < t.length; i += 3) { if (t[i] < x0) x0 = t[i]; if (t[i] > x1) x1 = t[i]; if (t[i + 1] < y0) y0 = t[i + 1]; if (t[i + 1] > y1) y1 = t[i + 1]; if (t[i + 2] < z0) z0 = t[i + 2]; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, out = new Float32Array(t.length);
  for (let i = 0; i < t.length; i += 3) { out[i] = t[i] - cx; out[i + 1] = t[i + 1] - cy; out[i + 2] = t[i + 2] - z0; }
  return { ...o, tris: out };
}
function ctr(r) { let x = 0, y = 0, A = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const c = r[j][0] * r[i][1] - r[i][0] * r[j][1]; A += c; x += (r[j][0] + r[i][0]) * c; y += (r[j][1] + r[i][1]) * c; } return A ? [x / (3 * A), y / (3 * A)] : r[0]; }
function inside(r, x, y) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function edgeDist(r, x, y) {
  let m = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[j], b = r[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)), ex = a[0] + u * dx - x, ey = a[1] + u * dy - y;
    m = Math.min(m, ex * ex + ey * ey);
  }
  return Math.sqrt(m);
}
function labelPoint(r) { // the roomiest spot in the piece, so the number never lands on a tab or outside
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let best = [(x0 + x1) / 2, (y0 + y1) / 2], bd = -1; const n = 24;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * j / n;
    if (!inside(r, x, y)) continue; const d = edgeDist(r, x, y); if (d > bd) { bd = d; best = [x, y]; }
  }
  return { at: best, room: bd };
}
function pieceMap(pcs, p, slug) {
  const W = p.widthMm, m = 8, sz = W + 2 * m, f = v => v.toFixed(2);
  const path = r => 'M' + r.map(([x, y]) => f(x) + ' ' + f(-y)).join('L') + 'Z';
  const out = C.shapeOutline(p.shape, W);
  const g = [`<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(-W / 2 - m)} ${f(-W / 2 - m)} ${f(sz)} ${f(sz + 10)}" width="${f(sz * 2)}mm" height="${f((sz + 10) * 2)}mm" font-family="Helvetica, Arial, sans-serif">`,
    `<rect x="${f(-W / 2 - m)}" y="${f(-W / 2 - m)}" width="${f(sz)}" height="${f(sz + 10)}" fill="#fff"/>`,
    `<path d="${path(out)}" fill="none" stroke="#999" stroke-width="0.3" stroke-dasharray="1.5 1"/>`];
  pcs.forEach((o, k) => {
    if (!o.ring) return;
    const lp = labelPoint(o.ring), fs = Math.max(2.2, Math.min(7, lp.room * 1.1));
    g.push(`<path d="${path(o.ring)}" fill="#f1efe9" stroke="#333" stroke-width="0.35"/>`);
    g.push(`<text x="${f(lp.at[0])}" y="${f(-lp.at[1])}" font-size="${f(fs)}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#222">${k + 1}</text>`);
  });
  g.push(`<text x="0" y="${f(W / 2 + m + 4)}" font-size="3.2" text-anchor="middle" fill="#555">${slug.replace(/&/g, '&amp;').replace(/</g, '&lt;')} · seen from above · numbers match the piece files</text>`, '</svg>');
  return g.join('\n');
}

function exportFiles(model, p, x) {
  // x: {slug, colors, spread, spreadGap, readme}
  const files = [], byRole = r => model.parts.filter(o => o.role === r);
  const drop = (list, dz) => list.map(o => { const t = new Float32Array(o.tris); for (let i = 2; i < t.length; i += 3) t[i] -= dz; return { ...o, tris: t }; });
  const three = async (name, parts, title) => files.push([name, await C.zip(C.model3mf(parts, x.colors, title), deflate)]);
  return (async () => {
    const s = x.slug, rest = model.parts.filter(o => o.role !== 'terrain');
    if (p.product === 'puzzle' && x.spread && model.grid) {
      const sp = C.spreadPieces(model.parts, model.grid, x.spreadGap, model.floorZ || 0);
      await three(`${s}-pieces-spread.3mf`, sp.parts, s + '-pieces'); files.push([`${s}-pieces-spread.stl`, C.stl(sp.parts)]);
      if (rest.length) { await three(`${s}-frame.3mf`, rest, s + '-frame'); files.push([`${s}-frame.stl`, C.stl(rest)]); }
      await three(`${s}-assembled.3mf`, model.parts, s);
    } else if (p.separate || (p.product === 'puzzle' && model.floorZ > 0)) {
      const terr = drop(byRole('terrain'), model.floorZ || 0), a = p.separate ? '1-terrain' : 'pieces', b = p.separate ? '2-frame' : 'tray';
      files.push([`${s}-${a}.stl`, C.stl(terr)]); await three(`${s}-${a}.3mf`, terr, `${s}-${a}`);
      if (rest.length) { files.push([`${s}-${b}.stl`, C.stl(rest)]); await three(`${s}-${b}.3mf`, rest, `${s}-${b}`); }
      await three(`${s}-assembled.3mf`, model.parts, s);
    } else {
      await three(`${s}.3mf`, model.parts, s); files.push([`${s}-all.stl`, C.stl(model.parts)]);
      files.push([`${s}-${p.product === 'puzzle' ? 'pieces' : 'terrain'}.stl`, C.stl(byRole('terrain'))]);
      if (byRole('frame').length) files.push([`${s}-frame.stl`, C.stl(byRole('frame'))]);
      if (byRole('text').length) files.push([`${s}-lettering.stl`, C.stl(byRole('text'))]);
    }
    if (p.product === 'puzzle' && x.perPiece) {
      // number in reading order: squares row by row; circles and hexagons centre first, then ring by ring clockwise from 12 o'clock
      const pcs = model.parts.filter(o => o.cell).map(o => ({ o, lp: o.ring ? labelPoint(o.ring).at : [0, 0] })), pad = String(pcs.length).length;
      const cw = model.grid ? Math.min(model.grid.cellW || 1e9, model.grid.cellH || 1e9) : p.widthMm / 5;
      if (p.shape === 'square') pcs.sort((a, b) => Math.round(b.o.ring ? ctr(b.o.ring)[1] / cw : 0) - Math.round(a.o.ring ? ctr(a.o.ring)[1] / cw : 0) || ctr(a.o.ring)[0] - ctr(b.o.ring)[0]);
      else {
        const key = q => { const c = ctr(q.o.ring); return [q.o.cell[1], q.o.cell[1] === 0 ? -1 : (Math.atan2(c[0], c[1]) + 2 * Math.PI) % (2 * Math.PI)]; };
        pcs.forEach(q => q.k = key(q)); pcs.sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1]);
      }
      pcs.forEach((q, k) => q.o = { ...q.o, name: 'Piece ' + (k + 1) });
      pcs.forEach(({ o }, k) => files.push([`single-pieces/${s}-piece-${String(k + 1).padStart(Math.max(2, pad), '0')}.stl`, C.stl([centre(o)])]));
      files.push([`single-pieces/${s}-piece-map.svg`, pieceMap(pcs.map(q => q.o), p, s)]);
    }
    files.push(['README.txt', x.readme(model)]);
    return C.zip(files, deflate);
  })();
}

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'init') { meta = m.meta; store = C.makeStore(meta, p => decode(p)); self.postMessage({ type: 'ready' }); return; }
    if (m.type === 'font') { fonts[m.id] = m.data; return; }
    if (m.type === 'build') {
      const hf = await getHF(m.q, m.id);
      self.postMessage({ type: 'progress', id: m.id, text: 'Building mesh…' });
      const model = C.buildModel(m.p, hf, fonts[m.font] || null);
      if (m.spread && model.grid) {
        // preview the print layout: pieces packed apart, frame set beside them
        const sp = C.spreadPieces(model.parts, model.grid, m.spreadGap, model.floorZ || 0);
        const rest = model.parts.filter(o => !o.cell);
        let fMin = Infinity, fMax = -Infinity; for (const o of rest) for (let i = 0; i < o.tris.length; i += 3) { if (o.tris[i] < fMin) fMin = o.tris[i]; if (o.tris[i] > fMax) fMax = o.tris[i]; }
        const shift = sp.maxX + 12 - fMin, cx = (sp.minX + sp.maxX + 12 + (fMax - fMin)) / 2;
        const mv = (o, dx) => { const t = new Float32Array(o.tris); for (let i = 0; i < t.length; i += 3) t[i] += dx; return { ...o, tris: t }; };
        model.parts = [...sp.parts.map(o => mv(o, -cx)), ...rest.map(o => mv(o, shift - cx))];
      }
      const { parts, transfer } = pack(model, true);
      self.postMessage({ type: 'built', id: m.id, parts, stats: { hMin: model.hMin, hMax: model.hMax, reliefMm: model.reliefMm, frameTop: model.frameTop, floorZ: model.floorZ, grid: model.grid ? { cellW: model.grid.cellW, cellH: model.grid.cellH } : null }, source: { kind: hf.source.kind, pxKm: hf.source.pxKm, label: hf.source.label } }, transfer);
      return;
    }
    if (m.type === 'export') {
      const hf = await getHF(m.q, m.id);
      self.postMessage({ type: 'progress', id: m.id, text: 'Building print mesh…' });
      const model = C.buildModel(m.p, hf, fonts[m.font] || null);
      self.postMessage({ type: 'progress', id: m.id, text: 'Packing files…' });
      const readme = mdl => m.readme.replace('{{RELIEF}}', mdl.reliefMm.toFixed(1)).replace('{{LOW}}', Math.round(mdl.hMin)).replace('{{HIGH}}', Math.round(mdl.hMax)).replace('{{FRAMETOP}}', (mdl.frameTop || 0).toFixed(2)).replace('{{PX}}', (hf.source.pxKm * 1000).toFixed(0));
      const z = await exportFiles(model, m.p, { ...m.x, readme });
      self.postMessage({ type: 'exported', id: m.id, zip: z }, [z.buffer]);
    }
  } catch (err) { self.postMessage({ type: 'error', id: m.id, text: String(err && err.message || err) }); }
};
