// Terrain Press worker: decodes elevation tiles, builds meshes and print files off the main thread.
importScripts('https://cdn.jsdelivr.net/npm/poly2tri@1.5.0/dist/poly2tri.min.js', 'https://cdn.jsdelivr.net/npm/clipper-lib@6.4.2/clipper.js', 'core.js' + self.location.search, 'panel-core.js' + self.location.search);
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
  const packId = /^packs\/([a-z0-9-]+)\//.exec(path)?.[1];
  const enc24 = packId && Object.values(meta).some(m =>
    (m.installedPacks || []).some(p => p.id === packId && p.heightEncoding === 'int24'));
  for (let i = 0, k = 0; i < out.length; i++, k += 4) {
    out[i] = enc24
      ? (px[k + 3] === 0 ? NaN : px[k] * 65536 + px[k + 1] * 256 + px[k + 2] - 8388608)
      : px[k] * 256 + px[k + 1] - 32768;
  }
  if (path.endsWith('overview.webp')) {
    const body = path.split('/')[1], w = bmp.width; let s = 0;
    for (let x = 0; x < w; x++) s += out[512 * w + x];
    if (meta[body].check !== undefined && Math.round(s) !== meta[body].check) self.postMessage({ type: 'warn', text: 'This browser changed the elevation images while decoding them, so heights may be slightly off.' });
  }
  return out;
}

// Probe the coordinate-specific DEM cheaply, before allocating large grids.
function planHeights(q) {
  if(q.world==='jupiter') {
    const N=Math.round(Math.max(24,Math.min(128,q.panelGrid||80)));
    return {plan:{N,stepMm:q.widthMm/N,limited:false,cap:128,samplingLimit:128,recommendedLimit:128,featureMm:q.widthMm/N,sourceStepMm:q.widthMm*(360/1000)/(q.size/71492*180/Math.PI),detailOptimized:false},source:{kind:'image',label:'Hubble OPAL 2015 color map',pxKm:71492*Math.PI*2/1000}};
  }
  const probeN = Math.min(201, Math.round(q.widthMm / 0.5) + 1);
  const source = store.chooseSource(q.world, q.lat, q.lon, q.size, probeN);
  const plan = C.meshPlan(q.widthMm, q.size, source.pxKm, q.step,
    q.samplingLimit === undefined ? 721 : q.samplingLimit, q.featureMm ?? 0.4);
  return { plan, source };
}
async function heights(q, onProgress) {
  const { plan } = planHeights(q);
  const s = await store.sample(q.world, q.lat, q.lon, q.size, plan.N, onProgress);
  return { heights: s.heights, N: plan.N, sizeKm: q.size, source: s.source,
    stepMm: plan.stepMm, limited: plan.limited, plan };
}
let jupiterImage;
async function colorHF(q) {
  if(!jupiterImage) {
    const response=await fetch('data/jupiter/opal-2015.jpg');if(!response.ok)throw Error('Jupiter image could not be loaded');
    const bmp=await createImageBitmap(await response.blob());
    const cv=new OffscreenCanvas(bmp.width,bmp.height),ctx=cv.getContext('2d');ctx.drawImage(bmp,0,0);
    jupiterImage={rgba:ctx.getImageData(0,0,bmp.width,bmp.height).data,w:bmp.width,h:bmp.height};bmp.close();
  }
  const {plan,source}=planHeights(q),im=jupiterImage;
  const pixels=TPPanel.crop(im.rgba,im.w,im.h,q,plan.N);
  const panel=TPPanel.quantize(pixels,plan.N,plan.N,q.panelCount||4);
  if(q.panelPalette?.length===panel.palette.length)panel.palette=q.panelPalette.map(hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)));
  return {panel,N:plan.N,heights:new Float32Array(plan.N**2),sizeKm:q.size,stepMm:plan.stepMm,plan,source,limited:false};
}
const cache = { key: '', hf: null };
async function getHF(q, id) {
  if(q.world==='jupiter')return colorHF(q);
  const key = [q.world, q.lat, q.lon, q.size, q.widthMm,
    q.step, q.samplingLimit, q.featureMm].join('|');
  if (cache.key !== key) {
    const hf = await heights(q, (d, n) => n > 1 &&
      self.postMessage({ type: 'progress', id, text: 'Loading elevation · ' + d + '/' + n }));
    cache.key = key; cache.hf = hf;
  }
  return cache.hf;
}

function pack(model, forPreview) {
  const parts = [], transfer = [];
  for (const p of model.parts) {
    if (forPreview) {
      const w = C.weld(p.tris), v = new Float32Array(w.verts);
      parts.push({ name: p.name, role: p.role, cell: p.cell || null, palette:p.palette, faceColors:p.faceColors, verts: v, idx: w.idx }); transfer.push(v.buffer, w.idx.buffer);
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

// volume (mm³) and surface area (mm²) of a closed triangle mesh, for filament estimates
function measure(parts) {
  let V = 0, A = 0;
  for (const o of parts) { const t = o.tris;
    for (let i = 0; i < t.length; i += 9) {
      const ax = t[i], ay = t[i + 1], az = t[i + 2], bx = t[i + 3], by = t[i + 4], bz = t[i + 5], cx = t[i + 6], cy = t[i + 7], cz = t[i + 8];
      V += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      A += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    } }
  return { volume: Math.abs(V), area: A };
}
// number puzzle pieces in reading order: squares row by row; circles and hexagons centre first, then ring by ring
// clockwise from 12 o'clock. The guide's piece map and the single-piece files share this numbering.
function numberPieces(model, p) {
  const pcs = model.parts.filter(o => o.cell);
  const cw = model.grid ? Math.min(model.grid.cellW || 1e9, model.grid.cellH || 1e9) : p.widthMm / 5;
  if (p.shape === 'square' || p.shape === 'hexgrid') pcs.sort((a, b) => Math.round(ctr(b.ring)[1] / cw) - Math.round(ctr(a.ring)[1] / cw) || ctr(a.ring)[0] - ctr(b.ring)[0]);
  else {
    const key = o => { const c = ctr(o.ring); return [o.cell[1], o.cell[1] === 0 ? -1 : (Math.atan2(c[0], c[1]) + 2 * Math.PI) % (2 * Math.PI)]; };
    pcs.sort((a, b) => { const ka = key(a), kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1]; });
  }
  return pcs.map((o, k) => ({ ...o, name: 'Piece ' + (k + 1) }));
}

function exportFiles(model, p, x) {
  // x: {slug, colors, spread, spreadGap, perPiece}
  // Returns the files plus a description of every print plate, for the print guide.
  const files = [], plates = [], byRole = r => model.parts.filter(o => o.role === r);
  const drop = (list, dz) => list.map(o => { const t = new Float32Array(o.tris); for (let i = 2; i < t.length; i += 3) t[i] -= dz; return { ...o, tris: t }; });
  const three = async (name, parts, title) => files.push([name, await C.zip(C.model3mf(parts, x.colors, title), deflate)]);
  const plate = (key, title, parts, names, extra) => plates.push({ key, title, parts, files: names, ...measure(parts), ...(extra || {}) });
  const puzzle = p.product === 'puzzle', tray = p.border !== 'none' && p.back;
  return (async () => {
    const s = x.slug, rest = model.parts.filter(o => o.role !== 'terrain'), restTitle = puzzle ? (tray ? 'Tray' : 'Frame') : 'Frame';
    if (puzzle && x.spread && model.grid) {
      const sp = C.spreadPieces(model.parts, model.grid, x.spreadGap, model.floorZ || 0);
      await three(`${s}-pieces-spread.3mf`, sp.parts, s + '-pieces'); files.push([`${s}-pieces-spread.stl`, C.stl(sp.parts)]);
      plate('pieces', 'Puzzle pieces', sp.parts, [`${s}-pieces-spread.stl`, `${s}-pieces-spread.3mf`], { count: sp.parts.length, spread: true });
      if (rest.length) { await three(`${s}-frame.3mf`, rest, s + '-frame'); files.push([`${s}-frame.stl`, C.stl(rest)]); plate('frame', restTitle, rest, [`${s}-frame.stl`, `${s}-frame.3mf`]); }
      await three(`${s}-assembled.3mf`, model.parts, s);
      plate('assembled', 'Assembled', model.parts, [], { reference: true }); // only for the guide's pictures
    } else if (p.separate || (puzzle && model.floorZ > 0)) {
      const terr = drop(byRole('terrain'), model.floorZ || 0), a = p.separate ? '1-terrain' : 'pieces', b = p.separate ? '2-frame' : 'tray';
      files.push([`${s}-${a}.stl`, C.stl(terr)]); await three(`${s}-${a}.3mf`, terr, `${s}-${a}`);
      plate(puzzle ? 'pieces' : 'terrain', puzzle ? 'Puzzle pieces' : 'Terrain', terr, [`${s}-${a}.stl`, `${s}-${a}.3mf`], { count: terr.length, dz: model.floorZ || 0 });
      if (rest.length) { files.push([`${s}-${b}.stl`, C.stl(rest)]); await three(`${s}-${b}.3mf`, rest, `${s}-${b}`); plate('frame', restTitle, rest, [`${s}-${b}.stl`, `${s}-${b}.3mf`]); }
      await three(`${s}-assembled.3mf`, model.parts, s);
    } else {
      await three(`${s}.3mf`, model.parts, s); files.push([`${s}-all.stl`, C.stl(model.parts)]);
      files.push([`${s}-${puzzle ? 'pieces' : 'terrain'}.stl`, C.stl(byRole('terrain'))]);
      if (byRole('frame').length) files.push([`${s}-frame.stl`, C.stl(byRole('frame'))]);
      if (byRole('text').length) files.push([`${s}-lettering.stl`, C.stl(byRole('text'))]);
      plate('all', puzzle ? 'Puzzle' : 'Ornament', model.parts, [`${s}.3mf`, `${s}-all.stl`], { count: puzzle ? byRole('terrain').length : 1, together: true });
    }
    let pieces = null;
    if (puzzle && model.grid) {
      const pcs = numberPieces(model, p), pad = Math.max(2, String(pcs.length).length);
      pieces = { outline: C.shapeOutline(p.shape === 'hexgrid' && p.hexLayout !== 'square' ? 'hexagon' : p.shape, p.widthMm), list: pcs.map((o, k) => { const lp = labelPoint(o.ring); return { n: k + 1, ring: o.ring, at: lp.at, room: lp.room }; }) };
      if (x.perPiece) {
        pcs.forEach((o, k) => files.push([`single-pieces/${s}-piece-${String(k + 1).padStart(pad, '0')}.stl`, C.stl([centre(o)])]));
        files.push([`single-pieces/${s}-piece-map.svg`, pieceMap(pcs, p, s)]);
        pieces.files = `single-pieces/${s}-piece-01.stl … ${String(pcs.length).padStart(pad, '0')}.stl`;
      }
    }
    return { files, plates, pieces };
  })();
}
// geometry for the guide's renders: welded, and only what the page needs
function plateForGuide(pl, transfer) {
  const parts = pl.parts.map(o => { const w = C.weld(o.tris), v = new Float32Array(w.verts); transfer.push(v.buffer, w.idx.buffer); return { role: o.role, palette:o.palette, faceColors:o.faceColors, verts: v, idx: w.idx }; });
  return { ...pl, parts };
}

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'init') { meta = m.meta; store = C.makeStore(meta, p => decode(p)); self.postMessage({ type: 'ready' }); return; }
    if (m.type === 'font') { fonts[m.id] = m.data; return; }
    if (m.type === 'plan') {
      const { plan, source } = planHeights(m.q);
      self.postMessage({ type: 'planned', id: m.id, plan,
        source: { pxKm: source.pxKm, label: source.label, kind: source.kind } });
      return;
    }
    if (m.type === 'build') {
      const hf = await getHF(m.q, m.id);
      self.postMessage({ type: 'progress', id: m.id, text: 'Building mesh…' });
      const model = C.buildModel({ ...m.p, stepMm: hf.stepMm }, hf, fonts[m.font] || null);
      if (m.spread && model.grid) {
        // preview the print layout: pieces packed apart, frame set beside them
        model.parts = C.spreadPreview(model.parts, model.grid, m.spreadGap, model.floorZ || 0);
      }
      const { parts, transfer } = pack(model, true);
      self.postMessage({ type: 'built', id: m.id, parts, stats: { hMin: model.hMin, hMax: model.hMax, reliefMm: model.reliefMm, frameTop: model.frameTop, floorZ: model.floorZ, widthMm: model.widthMm, depthMm: model.depthMm,
        actualPieces: model.actualPieces, grid: model.grid ? { cellW: model.grid.cellW, cellH: model.grid.cellH } : null }, mesh: { N: hf.N, stepMm: hf.stepMm, limited: hf.limited, cap: hf.plan.cap,
        detailOptimized: hf.plan.detailOptimized }, source: { kind: hf.source.kind, pxKm: hf.source.pxKm, label: hf.source.label,
        validFraction: hf.source.validFraction } }, transfer);
      return;
    }
    if (m.type === 'export') {
      const hf = await getHF(m.q, m.id);
      self.postMessage({ type: 'progress', id: m.id, text: 'Building print mesh…' });
      const printParams = { ...m.p, stepMm: hf.stepMm };
      const model = C.buildModel(printParams, hf, fonts[m.font] || null);
      self.postMessage({ type: 'progress', id: m.id, text: 'Packing files…' });
      const readme = mdl => m.readme.replace('{{RELIEF}}', mdl.reliefMm.toFixed(1))
        .replace('{{LOW}}', Math.round(mdl.hMin)).replace('{{HIGH}}', Math.round(mdl.hMax))
        .replace('{{FRAMETOP}}', (mdl.frameTop || 0).toFixed(2))
        .replace('{{PX}}', (hf.source.pxKm * 1000).toFixed(0))
        .replace('{{SOURCE}}', hf.source.label).replace('{{STEP}}', hf.stepMm.toFixed(3))
        .replace('{{COVERAGE}}', hf.source.validFraction === null ||
          hf.source.validFraction === undefined ? 'Not measured at export resolution'
          : (hf.source.validFraction*100).toFixed(1) + '% valid higher-resolution DEM samples' +
            ' (remaining samples use next available installed or included elevation)')
        .replaceAll('{{GRID}}', String(hf.N))
        .replace('{{LIMIT}}', hf.limited
          ? 'Sampling ceiling ' + hf.plan.cap + ' x ' + hf.plan.cap + ' was reached; some requested detail may be lost.'
          : hf.plan.detailOptimized
            ? 'Auto removed redundant detail beyond the DEM / selected printable feature.'
            : 'Requested mesh detail is within the sampling limit.')
        .replaceAll('{{CAP}}', String(hf.plan.cap))
        .replace('{{FEATURE}}', hf.plan.featureMm.toFixed(2))
        .replace('{{SOURCESTEP}}', hf.plan.sourceStepMm.toFixed(3))
        .replace('{{SAMPLEMODE}}', String(hf.plan.samplingLimit));
      const out = await exportFiles(model, printParams, m.x), transfer = [];
      if(hf.panel) {
        const palette=hf.panel.palette, steps=TPPanel.schedule(palette,m.p.panelLayer,m.p.panelBand,m.p.panelBacking);
        out.files.push(['color-changes.csv','color,hex,start_layer,change_at_z_mm\n'+steps.map(s=>[s.color,s.hex,s.startLayer,s.startHeightMM.toFixed(3)].join(',')).join('\n')]);
        out.files.push(['JUPITER-PRINTING.txt',`Print terrain/pieces files separately from frame/tray/lettering. The assembled 3MF is a reference. Use ${m.p.panelLayer} mm for ALL layers including the first; disable adaptive layers. CSV layers are 1-based: change before that layer, at the listed completed Z. All pieces use the same palette and backing. STL has no color metadata. 3MF carries surface display assignments; slicers may ignore them. The manual height-change CSV is authoritative. Heights are artistic color bands, not real terrain. Longitude is image-relative (image centre = 0), not calibrated System III. Latitude follows the source map; spherical distances are approximate. Source: Hubble OPAL 2015-01-19, https://science.nasa.gov/asset/hubble/jupiter-global-map-from-hubble-opal-data-rotation-1/ . Credit: NASA, ESA, A. Simon (GSFC), M. Wong (UC Berkeley), G. Orton (JPL-Caltech).`]);
        out.files.push(['jupiter-settings.json',JSON.stringify({query:m.q,print:m.p,palette},null,2)]);
      }
      const plates = out.plates.map(pl => plateForGuide(pl, transfer));
      for (const f of out.files) if (f[1] instanceof Uint8Array) transfer.push(f[1].buffer);
      const stats = {
        reliefMm: model.reliefMm, hMin: model.hMin, hMax: model.hMax,
        frameTop: model.frameTop || 0, floorZ: model.floorZ || 0,
        pxM: hf.source.pxKm * 1000, sourceKind: hf.source.kind,
        sourceLabel: hf.source.label, validFraction: hf.source.validFraction,
        widthMm: model.widthMm, depthMm: model.depthMm,
        meshN: hf.N, meshStepMm: hf.stepMm
      };
      self.postMessage({ type: 'exported', id: m.id,
        files: out.files, plates, pieces: out.pieces, stats,
        readmeFallback: hf.panel ? out.files.find(f=>f[0]==='JUPITER-PRINTING.txt')[1] : readme(model) }, transfer);
      return;
    }
    if (m.type === 'zip') {
      const z = await C.zip(m.files, deflate);
      self.postMessage({ type: 'zipped', id: m.id, zip: z }, [z.buffer]);
      return;
    }
  } catch (err) { self.postMessage({ type: 'error', id: m.id, text: String(err && err.message || err) }); }
};
