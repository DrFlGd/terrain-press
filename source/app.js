const BUILD = '__BUILD__'; // changes whenever worker.js or core.js change, so browsers never run stale code
(() => {
'use strict';
const $ = id => document.getElementById(id);

// ---------------- catalogue ----------------
const WORLDS = {
  jupiter: {name:'Jupiter',dot:'#d7ac7e',terrain:'#b5835b',grid:'Hubble OPAL color map',landingTitle:'',def:'redspot',datum:'artistic color bands, not elevation',
    credit:'Hubble OPAL, 19 January 2015. NASA, ESA, A. Simon (GSFC), M. Wong (UC Berkeley), G. Orton (JPL-Caltech). Filter composite. Map-relative longitude (image centre = 0), not calibrated System III. Planetographic latitude; spherical selection distances are approximate. No imagery beyond ±79.9°.',
    marks:[{id:'redspot',name:'Great Red Spot (2015)',note:'Approximate location in the bundled image',lat:-22.4,lon:54,size:35000,ex:1},{id:'belts',name:'Equatorial cloud bands',note:'Color bands in the 2015 image',lat:0,lon:0,size:60000,ex:1}]},
  earth: { name: 'Earth', dot: '#4d9fce', terrain: '#8ba775', grid: 'NOAA ETOPO 2022', landingTitle: '', def: 'himalaya',
    datum: 'relative to the EGM2008 geoid (approximately mean sea level)',
    credit: 'NOAA NCEI (2022), ETOPO 2022 Global Relief Model, doi:10.25921/fd45-gt74. WGS84 coordinates; EGM2008 metre heights. Ice surface and ocean-floor relief, including negative depths. Global composite with varying measured/interpolated detail. Globe colors show elevation, not satellite imagery. Regional geometry uses a mean-radius spherical approximation. Optional surface data produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.',
    marks: [
      { id: 'himalaya', name: 'Himalayas', note: 'Everest region', lat: 27.9881, lon: 86.925, size: 300, ex: 2 },
      { id: 'alps', name: 'Alps', note: 'Mont Blanc region', lat: 45.8326, lon: 6.8652, size: 200, ex: 2 },
      { id: 'hawaii', name: 'Hawaii', note: 'Volcanic island and surrounding seafloor', lat: 19.6, lon: -155.5, size: 250, ex: 2 },
      { id: 'andes', name: 'Andes', note: 'Aconcagua region', lat: -32.6532, lon: -70.0109, size: 250, ex: 2 },
      { id: 'mariana', name: 'Mariana Trench', note: 'Ocean-floor relief below sea level', lat: 11.35, lon: 142.2, size: 350, ex: 2 }
    ] },
  moon: { name: 'Moon', dot: '#bdb7a6', terrain: '#8e8d87', grid: 'LOLA LDEM_64', patchName: 'LOLA LDEM_1024', patchBadge: '83 m', landingTitle: 'Apollo landing sites', def: 'tycho',
    datum: 'above the 1737.4 km sphere',
    credit: 'NASA Lunar Reconnaissance Orbiter, Lunar Orbiter Laser Altimeter (LOLA) gridded data records LDEM_64 and LDEM_1024. LOLA Science Team, NASA GSFC; PDS Geosciences Node. Public domain. Tiles mirrored by the galaxy-3d project.',
    marks: [/*MOON*/] },
  mars: { name: 'Mars', dot: '#c0603a', terrain: '#b4552f', grid: 'MOLA MEGDR', landingTitle: 'Landers and rovers', def: 'curiosity',
    datum: 'above the reference ellipsoid',
    credit: 'NASA Mars Global Surveyor, Mars Orbiter Laser Altimeter (MOLA) Mission Experiment Gridded Data Record. MOLA Science Team; PDS Geosciences Node. Public domain. Tiles mirrored by the galaxy-3d project.',
    marks: [/*MARS*/] },
  mercury: { name: 'Mercury', dot: '#8f877c', terrain: '#8f8a82', grid: 'MESSENGER DEM', patchName: 'MESSENGER DEM, full res', patchBadge: '665 m', landingTitle: 'Spacecraft', def: 'rachmaninoff',
    datum: 'above the 2439.4 km sphere',
    credit: 'USGS Astrogeology Science Center, Mercury MESSENGER global DEM v2 (665 m, Becker et al. 2016), from NASA/JHUAPL/Carnegie Institution MESSENGER MDIS stereo images. Public domain.',
    marks: [/*MERCURY*/] },
  ceres: { name: 'Ceres', dot: '#8a9099', terrain: '#7f7f80', grid: 'Dawn HAMO DTM', patchName: 'Dawn HAMO DTM, full res', patchBadge: '180 m', landingTitle: '', def: 'occator',
    datum: 'above the 482 × 446 km reference ellipsoid',
    credit: 'NASA Dawn Framing Camera HAMO global DTM (DLR), via the PDS Small Bodies Node. Public domain. Tiles mirrored by the galaxy-3d project.',
    marks: [
      { id: 'occator', name: 'Occator', note: '92 km crater with bright salt deposits', lat: 19.82, lon: -120.67, size: 140, ex: 2 },
      { id: 'ahuna', name: 'Ahuna Mons', note: 'Lone 4 km ice volcano', lat: -10.48, lon: -43.97, size: 60, ex: 1.5 },
      { id: 'kerwan', name: 'Kerwan', note: '280 km basin, Ceres\'s largest', lat: -10.77, lon: 123.99, size: 380, ex: 2 },
      { id: 'yalode', name: 'Yalode', note: '260 km basin', lat: -42.58, lon: -67.52, size: 350, ex: 2 },
      { id: 'urvara', name: 'Urvara', note: '170 km crater with a central ridge', lat: -46.6, lon: -110.8, size: 240, ex: 2 },
      { id: 'dantu', name: 'Dantu', note: '126 km crater', lat: 24.3, lon: 138.2, size: 170, ex: 2 },
      { id: 'ernutet', name: 'Ernutet', note: '53 km crater with organic material', lat: 52.9, lon: 45.5, size: 80, ex: 2 },
      { id: 'haulani', name: 'Haulani', note: '34 km young bright crater', lat: 5.8, lon: 10.8, size: 50, ex: 2 },
    ] },
  vesta: { name: 'Vesta', dot: '#9a948a', terrain: '#8a857d', grid: 'Dawn HAMO DTM (DLR)', landingTitle: '', def: 'rheasilvia', shape: true,
    datum: 'above a best-fit smooth shape (Vesta is lumpy, so heights are relative to its overall egg shape)',
    credit: 'DLR / NASA Dawn Framing Camera HAMO global DTM (Preusker et al. 2013), PDS dataset DWNVSPG_2. Public domain. Longitudes use the Claudia double-prime system.',
    marks: [
      { id: 'rheasilvia', name: 'Rheasilvia', note: '500 km impact basin covering the south pole', lat: -75, lon: 91, size: 560, ex: 1 },
      { id: 'rheapeak', name: 'Rheasilvia central peak', note: 'About 20 km tall, one of the highest peaks in the solar system', lat: -79.8, lon: 76.4, size: 220, ex: 1 },
      { id: 'snowman', name: 'Snowman craters', note: 'Marcia, Calpurnia and Minucia in a row', lat: 15, lon: -14, size: 160, ex: 1.2 },
      { id: 'marcia', name: 'Marcia', note: '58 km young crater', lat: 9.5, lon: -20.75, size: 90, ex: 1.2 },
      { id: 'calpurnia', name: 'Calpurnia', note: '50 km crater, the snowman\'s middle', lat: 16.75, lon: -10.75, size: 90, ex: 1.2 },
      { id: 'divalia', name: 'Divalia Fossae', note: 'Giant equatorial troughs from the Rheasilvia impact', lat: -8, lon: -150, size: 300, ex: 2 },
    ] },
  venus: { name: 'Venus', dot: '#d29a55', terrain: '#b98a4f', grid: 'Magellan topography', landingTitle: 'Soviet landers (approximate)', def: 'maxwell',
    datum: 'above the 6051 km sphere',
    credit: 'USGS Astrogeology Science Center, Venus Magellan global topography (4641 m), from NASA/JPL Magellan radar altimetry. Public domain. Small radar gaps are filled smoothly.',
    marks: [
      { id: 'venera7', group: 'landing', name: 'Venera 7', note: '15 Dec 1970 · first landing on another planet', lat: -5, lon: -9, size: 700, ex: 8 },
      { id: 'venera8', group: 'landing', name: 'Venera 8', note: '22 Jul 1972', lat: -10.7, lon: -24.75, size: 700, ex: 8 },
      { id: 'venera9', group: 'landing', name: 'Venera 9', note: '22 Oct 1975 · first photo from the surface', lat: 31.0, lon: -68.4, size: 700, ex: 6 },
      { id: 'venera10', group: 'landing', name: 'Venera 10', note: '25 Oct 1975', lat: 15.4, lon: -68.5, size: 700, ex: 6 },
      { id: 'venera13', group: 'landing', name: 'Venera 13', note: '1 Mar 1982 · first colour photos', lat: -7.5, lon: -57.0, size: 700, ex: 8 },
      { id: 'venera14', group: 'landing', name: 'Venera 14', note: '5 Mar 1982', lat: -13.25, lon: -49.8, size: 700, ex: 8 },
      { id: 'vega1', group: 'landing', name: 'Vega 1', note: '11 Jun 1985 · also dropped a balloon', lat: 7.2, lon: 177.8, size: 700, ex: 8 },
      { id: 'vega2', group: 'landing', name: 'Vega 2', note: '15 Jun 1985', lat: -7.14, lon: 177.67, size: 700, ex: 8 },
      { id: 'maxwell', name: 'Maxwell Montes', note: 'Highest mountains, about 11 km', lat: 65.0, lon: 1.5, size: 900, ex: 4 },
      { id: 'maat', name: 'Maat Mons', note: 'Shield volcano, about 9 km', lat: 0.5, lon: -165.4, size: 600, ex: 6 },
      { id: 'sapas', name: 'Sapas Mons', note: 'Shield volcano with lava flows', lat: 8.5, lon: -171.7, size: 600, ex: 6 },
      { id: 'gula', name: 'Gula Mons', note: 'Volcano in western Eistla Regio', lat: 21.9, lon: -1.0, size: 600, ex: 6 },
      { id: 'sif', name: 'Sif Mons', note: 'Volcano in western Eistla Regio', lat: 22.0, lon: -7.6, size: 500, ex: 6 },
      { id: 'lakshmi', name: 'Lakshmi Planum', note: 'High plateau ringed by mountains', lat: 68.6, lon: -20.7, size: 2400, ex: 6 },
      { id: 'ishtar', name: 'Ishtar Terra', note: 'Northern highland continent', lat: 70, lon: 27.5, size: 5000, ex: 6 },
      { id: 'diana', name: 'Diana Chasma', note: 'Deep rift valley', lat: -14.6, lon: 155.8, size: 1200, ex: 6 },
      { id: 'artemis', name: 'Artemis Corona', note: '2,100 km ring-shaped corona', lat: -35, lon: 135, size: 2800, ex: 8 },
    ] },
  pluto: { name: 'Pluto', dot: '#c9a58e', terrain: '#c9b8a6', grid: 'New Horizons DEM', patchName: 'New Horizons DEM, full res', patchBadge: '300 m', landingTitle: '', def: 'sputnik', partial: true,
    datum: 'above the 1188.3 km sphere',
    credit: 'USGS Astrogeology Science Center, Pluto New Horizons global DEM (300 m, Schenk et al.), from NASA/JHUAPL/SwRI New Horizons LORRI and MVIC images. Public domain. Only the hemisphere New Horizons saw up close is mapped; the rest is a smooth fill.',
    marks: [
      { id: 'sputnik', name: 'Sputnik Planitia', note: 'Nitrogen-ice plain, the left half of the heart', lat: 18, lon: 178, size: 1300, ex: 10 },
      { id: 'tenzing', name: 'Tenzing Montes', note: 'Water-ice mountains, about 5 km', lat: -16.5, lon: 175.5, size: 260, ex: 2.5 },
      { id: 'wright', name: 'Wright Mons', note: 'Possible ice volcano with a central pit', lat: -21.5, lon: 172.5, size: 260, ex: 3 },
      { id: 'burney', name: 'Burney', note: '296 km crater', lat: 46, lon: 134, size: 400, ex: 4 },
      { id: 'tartarus', name: 'Tartarus Dorsa', note: 'Bladed terrain near the map edge', lat: 20, lon: 228, size: 500, ex: 4 },
    ] },
};
const MOON_HI = ['tycho', 'apollo11', 'apollo15'];
const PATCH_OF = { pluto: { tenzing: 'heart_west', wright: 'heart_west' } }; // landmarks served by a shared patch
const FONT_INFO = {
  worm: 'Based on Audiowide: rounded and wide, in the spirit of NASA\'s 1975 "worm" logo.',
  plaque: 'Based on Jost: an open Futura, the typeface on the plaque Apollo 11 left on the Moon.',
  technical: 'Based on Orbitron: squared-off and technical, like spacecraft labelling.',
};

// ---------------- state ----------------
const state = { world: 'moon', mark: null, lat: 0, lon: 0, size: 100, product: 'ornament', shape: 'circle', border: 'lettered', font: 'worm',
  detail: 'source', colors: { terrain: '#8e8d87', frame: '#26282c', text: '#c8915a' } };
const PREVIEW_STEP = 0.7;
let meta = null, worker = null, ready = false, lastStats = null, lastSource = null, coverage = null;
const fontsSent = {};
const exFromSlider = v => Math.round(Math.pow(40, v / 100) * 10) / 10;
const sliderFromEx = e => Math.round(Math.log(Math.max(1, e)) / Math.log(40) * 100);
const clamp = (v, a, b, d) => Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d;
const fmtLat = v => `${Math.abs(v).toFixed(4)}°${v >= 0 ? 'N' : 'S'}`;
const fmtLon = v => `${Math.abs(v).toFixed(4)}°${v >= 0 ? 'E' : 'W'}`;
const fmtM = m => (m >= 0 ? '+' : '−') + Math.abs(Math.round(m)).toLocaleString('en-US') + ' m';
const radio = name => document.querySelector(`input[name="${name}"]:checked`).value;
const setRadio = (name, v) => { const el = document.querySelector(`input[name="${name}"][value="${v}"]`); if (el) el.checked = true; };

// ---------------- theme ----------------
function syncThemeButtons() { for (const m of ['light', 'auto', 'dark']) $('th-' + m).classList.toggle('active', TPTheme.mode === m); }
for (const m of ['light', 'auto', 'dark']) $('th-' + m).onclick = () => { TPTheme.set(m); syncThemeButtons(); };
syncThemeButtons();
const css = name => getComputedStyle(document.body).getPropertyValue(name).trim();

// ---------------- toast ----------------
function toast(msg, kind) {
  const t = $('toast'); t.className = 'tp-toast alert py-2 px-3 mb-0 shadow alert-' + (kind || 'secondary'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 6000);
}

// ---------------- worker ----------------
let reqId = 0; const pending = new Map();
function call(msg, transfer) { const id = ++reqId; msg.id = id; return new Promise((res, rej) => { pending.set(id, { res, rej }); worker.postMessage(msg, transfer || []); }); }
function startWorker() {
  try { worker = new Worker('worker.js?v=' + BUILD); }
  catch (e) { toast('This browser can\'t run the model builder. Try a current version of Chrome, Safari, Firefox or Edge.', 'warning'); return; }
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === 'ready') { ready = true; schedule(true); return; }
    if (m.type === 'warn') { toast(m.text, 'warning'); return; }
    if (m.type === 'progress') { if (m.id === buildId) busy(m.text); else if (m.id === exportId) $('export').textContent = m.text; return; }
    const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
    if (m.type === 'error') p.rej(new Error(m.text)); else p.res(m);
  };
  worker.onerror = e => toast('The model builder stopped: ' + (e.message || 'unknown error'), 'danger');
  worker.postMessage({ type: 'init', meta });
}
async function ensureFont(id) {
  if (fontsSent[id]) return fontsSent[id];
  fontsSent[id] = fetch(`data/fonts/${id}.json`).then(r => r.json()).then(data => { worker.postMessage({ type: 'font', id, data }); });
  return fontsSent[id];
}

// ---------------- parameters ----------------
function params(step) {
  const product = state.product, border = state.border, colored = state.world === 'jupiter';
  return {
    panelLayer:+$('jp-layer').value,panelBand:+$('jp-band').value,panelBacking:+$('jp-backing').value,
    colorPanel:colored, surfaceColors:moonColorEnabled(),
    shape: state.shape, product, widthMm: +$('width-num').value, exag: exFromSlider(+$('exag').value),
    hexLayout: $('hex-layout').value, hexEdge: $('hex-edge').value,
    hexRings: +$('hex-rings').value,
    hexAcross: Math.round(clamp(+$('hex-across').value, 2, 12, 5)),
    baseMm: clamp(+$('base').value, 1, 8, 2), frameMm: clamp(+$('frame').value, 4, 14, 7), rimMm: clamp(+$('rim').value, 0.5, 30, 3), rimAuto: $('rim-auto').checked, textMm: 0.8,
    textTop: $('t-top').value.trim(), textBottom: $('t-bottom').value.trim(),
    pieces: state.shape === 'hexgrid'
      ? ($('hex-layout').value === 'square'
        ? Math.round(clamp(+$('hex-across').value,2,12,5)) ** 2
        : 1 + 3 * (+$('hex-rings').value) * (+$('hex-rings').value + 1))
      : Math.round(clamp(+$('pieces').value, 2, 12, 5)),
    gapMm: clamp(+$('gap').value, 0.1, 0.6, 0.3),
    separate: product === 'ornament' && border !== 'none' && (colored || $('separate').checked),
    loop: product === 'ornament' && border !== 'none' && $('loop').checked,
    stepMm: typeof step === 'number' ? step : 0.5, border, mergeText: $('merge').checked, back: $('back').checked, backMm: clamp(+$('back-mm').value, 0.8, 4, 1.6),
    seed: Math.abs(Math.round(state.lat * 1000) * 31 + Math.round(state.lon * 1000)) + 7,
  };
}
const query = (step, fastPreview = false) => ({
  world: state.world, lat: state.lat, lon: state.lon, size: state.size,
  widthMm: +$('width-num').value, step,
  // Fast preview stays inexpensive regardless of configured export ceiling.
  samplingLimit: fastPreview ? 721 : $('resolution-auto').checked
    ? 'auto' : +$('sampling-limit').value,
  ...(moonColorEnabled()?{surfaceColors:true,surfaceCount:+$('moon-count').value,surfaceGrid:+$('moon-grid').value,surfacePalette:moonPalette}:{}),
  ...(state.world==='jupiter'?{panelCount:+$('jp-count').value,panelGrid:+$('jp-grid').value,panelPalette:jupiterPalette}:{}),
  featureMm: +$('min-feature').value
});

// ---------------- build ----------------
let jupiterPalette = null, moonPalette = null;
function moonColorEnabled(){return state.world==='moon' && $('moon-color').checked;}
let timer = null, buildId = 0, exportId = 0, building = false, again = false;
let planSequence = 0;
async function refreshPlan() {
  if (!ready) return;
  const seq = ++planSequence;
  try {
    const r = await call({ type: 'plan', q: query(state.detail) });
    if (seq !== planSequence) return;
    if(state.world==='jupiter') { $('grid-plan').textContent=`Color sampling: ${r.plan.N} × ${r.plan.N} cells · ${r.plan.stepMm.toFixed(2)} mm per cell`; $('grid-plan-note').textContent='Source image: 3600 × 1598. '+(r.plan.N>=384?'High detail: longer builds and larger files. ':'')+'Small islands may need coarser sampling for your nozzle.'; return; }
    const p = r.plan, samples = (p.N * p.N).toLocaleString('en-US');
    $('grid-plan').textContent = 'Export: ' + p.N.toLocaleString('en-US') +
      ' × ' + p.N.toLocaleString('en-US') + ' (' + samples + ' heights) · ' +
      p.stepMm.toFixed(3) + ' mm/grid step · source ' +
      p.sourceStepMm.toFixed(3) + ' mm/pixel on print';
    $('grid-plan-note').textContent = (p.samplingLimit === 'auto'
      ? 'Auto: avoids detail beyond DEM or printed feature; recommended tier ' + p.recommendedLimit + '. '
      : 'Manual ceiling: ' + p.cap + ' × ' + p.cap + '. ') +
      (p.detailOptimized ? 'Redundant geometry reduced. ' : '') +
      (p.limited ? 'Sampling limit reached. ' : '') +
      (p.N > 1441 ? 'Large mesh: high RAM/CPU and large STL/3MF expected.' : '');
  } catch (e) {
    if (seq === planSequence) $('grid-plan-note').textContent = 'Could not estimate mesh: ' + e.message;
  }
}
function schedule(fast) {
  clearTimeout(timer);
  timer = setTimeout(() => { void refreshPlan(); void build(); }, fast ? 30 : 160);
}
function busy(t) { $('busy').hidden = !t; if (t) $('busy-text').textContent = t; }
async function build() {
  if (!ready) return;
  if (building) { again = true; return; }
  building = true; again = false;
  busy(state.world==='jupiter'?'Sampling cloud colors…':'Loading elevation…');
  try {
    if (state.border === 'lettered') await ensureFont(state.font);
    const step = $('preview-high').checked ? state.detail : PREVIEW_STEP;
    const p = params(step);
    const spread = false; // Keep the preview assembled; exports are always spread.
    const msg = { type: 'build', q: query(step, !$('preview-high').checked), p, font: state.border === 'lettered' ? state.font : null, spread, spreadGap: clamp(+$('spread-gap').value, 1, 15, 3) };
    const pr = call(msg); buildId = reqId;
    const r = await pr;
    if (!again) { lastStats = r.stats; lastSource = r.source; bench.setParts(r.parts, spread); showStats(p, r); if(state.world==='jupiter')renderJupiterPalette(r.parts.find(p=>p.palette)?.palette); if(moonColorEnabled())renderMoonPalette(r.parts.find(p=>p.palette)?.palette); }
  } catch (e) { console.error(e); toast('Could not build this region: ' + e.message, 'danger'); }
  finally { building = false; busy(null); if (again) build(); }
}
function showStats(p, r) {
  const W = WORLDS[state.world], src = r.source, s = r.stats, pxM = src.pxKm * 1000;
  $('chip-src').innerHTML = `<b>${src.kind === 'pack' ? src.label : (src.kind === 'patch' ? (W.patchName || W.grid) : W.grid)}</b> · ${pxM < 1000 ? Math.round(pxM) + ' m' : (pxM / 1000).toFixed(2) + ' km'} per sample` +
    (state.world==='venus' && src.kind==='pack' && Number.isFinite(src.validFraction)
      ? ' · '+Math.round(src.validFraction*100)+'% observed stereo heights in selected region' : '');
  const high = $('preview-high').checked, mesh = r.mesh;
  $('chip-mesh').textContent = (high ? 'Export-matched' : 'Fast') + ' · ' +
    mesh.N + ' × ' + mesh.N + ' · ' + mesh.stepMm.toFixed(2) + ' mm' +
    (mesh.limited ? ' · sampling cap' : '');
  $('preview-hint').textContent = high
    ? 'Showing export-detail geometry (' + mesh.N + ' × ' + mesh.N + ' grid, ' +
      mesh.stepMm.toFixed(3) + ' mm spacing).' +
      (mesh.limited ? ' Limited to ' + mesh.cap + ' × ' + mesh.cap + ' sampled heights.' : '')
    : 'Fast preview for responsive editing. Enable to see the selected export mesh before downloading.';
  $('st-low').textContent = fmtM(s.hMin); $('st-high').textContent = fmtM(s.hMax);
  $('st-relief').innerHTML = `${s.reliefMm.toFixed(1)} mm <small>${((s.hMax - s.hMin) / 1000).toFixed(1)} km real</small>`;
  const H = r.stats.depthMm || (p.shape === 'hexagon' ? p.widthMm * Math.sqrt(3) / 2 : p.widthMm),
    terrainW = r.stats.widthMm || p.widthMm, fr = p.border === 'none' ? 0 : p.frameMm;
  $('st-foot').innerHTML = `${Math.round(terrainW + 2 * fr)} × ${Math.round(H + 2 * fr + (p.loop ? 11 : 0))} <small>mm</small>`;
  const n = r.parts.filter(x => x.role === 'terrain').length;
  $('st-parts').innerHTML = p.product === 'puzzle' ? `${n} pieces <small>${p.shape === 'hexgrid' ? 'hex tessellation' : (p.border === 'none' ? 'no frame' : (p.back && p.border !== 'none' ? '+ tray' : '+ frame'))}</small>` : `${(p.separate ? 2 : r.parts.length)} <small>${p.separate ? 'prints' : 'colours'}</small>`;
  if (p.shape === 'hexgrid') $('hex-count-hint').textContent =
    (p.hexLayout === 'square' ? p.hexAcross + ' × ' + p.hexAcross + ' whole hexes'
      : p.hexRings + ' ring(s) · ' + p.pieces + ' nominal hexes') +
    ' · rendered ' + n + ' printable pieces.';
  if(state.world==='jupiter') { $('st-low').textContent='Color 1';$('st-high').textContent='Color '+$('jp-count').value;$('st-relief').textContent=s.reliefMm.toFixed(2)+' mm color steps'; }
  const rel = s.reliefMm;
  $('exag-hint').textContent = `${p.exag}× · 1× is true scale. ` + (rel < 2 ? 'Relief is shallow; try more exaggeration.' : rel > 25 ? 'Tall; check the slicer for steep walls.' : 'Reads well at this width.');
  // Pluto: warn when the region strays into the unmapped half
  const warn = $('chip-warn'); warn.hidden = true;
  if (W.partial && coverage) { const c = coverageAt(state.lat, state.lon); if (c < 0.9) { warn.hidden = false; warn.textContent = c < 0.2 ? 'Not mapped by New Horizons: this is a smooth fill' : 'Partly outside the mapped area'; } }
  if(state.world==='venus' && src.kind==='pack' && Number.isFinite(src.validFraction) && src.validFraction<0.999){
    warn.hidden=false;
    warn.textContent=src.validFraction===0
      ? 'No Magellan stereo elevation here: using bundled Venus terrain'
      : 'Mixed terrain: '+Math.round(src.validFraction*100)+'% stereo, remainder bundled elevation';
  }
}

// ---------------- 3D bench ----------------
const bench = (() => {
  const canvas = $('bench');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 1, 4000); cam.up.set(0, 0, 1); cam.position.set(0, -190, 170);
  const ctl = new THREE.OrbitControls(cam, canvas); ctl.target.set(0, 0, 4); ctl.maxPolarAngle = Math.PI * 0.49; ctl.enableDamping = false;
  const hemi = new THREE.HemisphereLight(0xb8c4d6, 0x1a1510, 0.4); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 1, far: 900 }); sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const plateMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), plateMat); plate.position.z = -0.02; plate.receiveShadow = true; scene.add(plate);
  let grid = null, group = new THREE.Group(); scene.add(group);
  let pendingFrame = false;
  const render = () => { if (pendingFrame) return; pendingFrame = true; requestAnimationFrame(() => { pendingFrame = false; if (!canvas.parentElement.hidden) renderer.render(scene, cam); }); };
  ctl.addEventListener('change', render);
  function theme() {
    scene.background = new THREE.Color(css('--tp-stage') || '#0d1014'); plateMat.color.set(css('--tp-plate') || '#161a20');
    if (grid) { scene.remove(grid); grid.geometry.dispose(); }
    grid = new THREE.GridHelper(400, 40, new THREE.Color(css('--tp-grid1')), new THREE.Color(css('--tp-grid2'))); grid.rotation.x = Math.PI / 2; grid.position.z = 0.01; scene.add(grid);
    const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark'; hemi.intensity = dark ? 0.38 : 0.62;
    render();
  }
  function setSun(deg) { const a = deg * Math.PI / 180, az = -2.3; sun.position.set(Math.cos(az) * Math.cos(a) * 320, Math.sin(az) * Math.cos(a) * 320, Math.sin(a) * 320); render(); }
  function resize() { const r = canvas.parentElement.getBoundingClientRect(); if (!r.width || !r.height) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); render(); }
  new ResizeObserver(resize).observe(canvas.parentElement);
  let framed = '';
  function frameTo(size) {
    const k = String(Math.round(size / 20)); if (framed === k) return; framed = k;
    const effective = Math.max(size, 100), d = effective / 100;
    // The model can now be 1,000 mm wide (or wider when puzzle pieces spread).
    // Size the virtual build plate, shadows and clipping planes to fit the model.
    plate.geometry.dispose();
    plate.geometry = new THREE.PlaneGeometry(Math.max(800, effective * 1.2), Math.max(800, effective * 1.2));
    cam.far = Math.max(4000, 4000 * d);
    cam.updateProjectionMatrix();
    const shadowExtent = Math.max(160, effective * 0.7);
    Object.assign(sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, far: Math.max(900, effective * 3) });
    sun.shadow.camera.updateProjectionMatrix();
    ctl.target.set(0, 0, 4); cam.position.set(0, -190 * d, 170 * d); ctl.update();
  }
  function setParts(parts, spread) {
    scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    group = new THREE.Group();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of parts) {
      let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p.verts, 3)); g.setIndex(new THREE.BufferAttribute(p.idx, 1));
      if (p.role !== 'terrain' || p.faceColors) g = g.toNonIndexed();
      if(p.faceColors){const c=new Float32Array(p.faceColors.length*9);p.faceColors.forEach((k,i)=>{const rgb=new THREE.Color(p.palette[k]).convertSRGBToLinear();for(let j=0;j<3;j++)c.set([rgb.r,rgb.g,rgb.b],i*9+j*3);});g.setAttribute('color',new THREE.BufferAttribute(c,3));}          // crisp edges on the frame and letters
      g.computeVertexNormals(); g.computeBoundingBox();
      const b = g.boundingBox; minX = Math.min(minX, b.min.x); maxX = Math.max(maxX, b.max.x); minY = Math.min(minY, b.min.y); maxY = Math.max(maxY, b.max.y);
      const m = new THREE.MeshStandardMaterial({ color: p.faceColors?'#ffffff':state.colors[p.role], vertexColors:!!p.faceColors, roughness: p.role === 'text' ? 0.45 : 0.88, metalness: p.role === 'text' ? 0.25 : 0 });
      const mesh = new THREE.Mesh(g, m); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.role = p.role; group.add(mesh);
    }
    scene.add(group);
    frameTo(Math.max(maxX - minX, maxY - minY, 100));
    render();
  }
  function recolor() { group.children.forEach(m => m.material.color.set(m.material.vertexColors?'#ffffff':state.colors[m.userData.role])); render(); }
  TPTheme.listeners.push(() => setTimeout(theme, 0));
  theme(); setSun(18);
  return { setParts, recolor, setSun, resize, render };
})();

// ---------------- globe (lazy) ----------------
let globe = null;
function makeGlobe() {
  const canvas = $('globe');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100); cam.position.set(0, 0, 3.4);
  const ctl = new THREE.OrbitControls(cam, canvas); ctl.enablePan = false; ctl.minDistance = 1.25; ctl.maxDistance = 6; ctl.rotateSpeed = 0.5;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }), sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), mat); scene.add(sphere);
  // irregular bodies (Vesta): push each vertex out to the body's real radius
  const unitPos = sphere.geometry.attributes.position.array.slice(), shapes = {};
  let rAt = () => 1;
  function shapeFn(g) {
    let m = 0; for (const v of g.r) if (v > m) m = v; // largest radius = 1, so it frames like the other worlds
    return (lat, lon) => { // bilinear, wraps in longitude
      const x = ((lon + 180) / 360 * g.w - 0.5 + g.w) % g.w, y = Math.max(0, Math.min(g.h - 1.001, (90 - lat) / 180 * g.h - 0.5));
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, x1 = (x0 + 1) % g.w, R = (i, j) => g.r[j * g.w + i];
      return ((R(x0, y0) * (1 - fx) + R(x1, y0) * fx) * (1 - fy) + (R(x0, y0 + 1) * (1 - fx) + R(x1, y0 + 1) * fx) * fy) / m;
    };
  }
  function applyShape(fn) {
    rAt = fn || (() => 1);
    const pos = sphere.geometry.attributes.position, a = pos.array;
    for (let i = 0; i < a.length; i += 3) {
      const x = unitPos[i], y = unitPos[i + 1], z = unitPos[i + 2];
      const k = fn ? fn(Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI, Math.atan2(-z, x) * 180 / Math.PI) : 1;
      a[i] = x * k; a[i + 1] = y * k; a[i + 2] = z * k;
    }
    pos.needsUpdate = true; sphere.geometry.computeBoundingSphere();
    // Keep overlay shaped to the same non-spherical world surface.
    const covPos=covShape.geometry.attributes.position;
    for(let i=0;i<a.length;i++)covPos.array[i]=a[i]*1.008;
    covPos.needsUpdate=true; covShape.geometry.computeBoundingSphere();
  }
  const sg = new THREE.BufferGeometry(), sp = []; let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1400; i++) { const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, d = 30 + rnd() * 20; sp.push(Math.sqrt(1 - u * u) * Math.cos(t) * d, u * d, Math.sqrt(1 - u * u) * Math.sin(t) * d); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.08 })); scene.add(stars);
  // footprint drawn like a map route: dark casing, white core, faint tint inside, so it reads on any terrain
  const fpCase = new THREE.MeshBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const fpCore = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const fpFill = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  let fp = null, dots = null, fpPts = null, fpCentre = null, fpDist = 0;
  function ribbon(pts, w) { // closed band of width w (world units) lying on the surface along pts
    const pos = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], t = pts[(i + 1) % n].clone().sub(pts[(i - 1 + n) % n]).normalize(), side = t.cross(p.clone().normalize()).normalize().multiplyScalar(w / 2);
      pos.push(p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z);
    }
    const idx = []; for (let i = 0; i < n; i++) { const a = 2 * i, b = 2 * ((i + 1) % n); idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  }
  function drawFootprint() {
    if (fp) { scene.remove(fp); fp.traverse(o => o.geometry && o.geometry.dispose()); fp = null; }
    if (!fpPts) return;
    fpDist = cam.position.length();
    let span = 0; for (const q of fpPts) span = Math.max(span, q.distanceTo(fpCentre));
    const px = Math.min(fpDist * 0.0042, span * 0.12); // ~constant on-screen width while zooming, thinner for tiny regions
    const fill = new THREE.BufferGeometry(), fv = [fpCentre.x, fpCentre.y, fpCentre.z], fi = [];
    for (const q of fpPts) fv.push(q.x, q.y, q.z);
    for (let i = 0; i < fpPts.length; i++) fi.push(0, 1 + i, 1 + (i + 1) % fpPts.length);
    fill.setAttribute('position', new THREE.Float32BufferAttribute(fv, 3)); fill.setIndex(fi);
    fp = new THREE.Group();
    fp.add(new THREE.Mesh(fill, fpFill), new THREE.Mesh(ribbon(fpPts, px * 2.6), fpCase), new THREE.Mesh(ribbon(fpPts, px), fpCore));
    fp.children[1].renderOrder = 1; fp.children[2].renderOrder = 2; scene.add(fp);
  }
  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 6; x.stroke(); return new THREE.CanvasTexture(c); })();
  const dotMat = new THREE.PointsMaterial({ size: 13, sizeAttenuation: false, map: dotTex, alphaTest: 0.4, transparent: true });
  const toVec = (lat, lon, r = 1) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return new THREE.Vector3(Math.cos(a) * Math.cos(b) * r, Math.sin(a) * r, -Math.cos(a) * Math.sin(b) * r); };
  const tex = {}, loader = new THREE.TextureLoader();

  // Semi-transparent texture shares the globe's equirectangular UVs. Pixels
  // are painted from installed DEM *validity* masks, never the raw rectangle
  // of the Magellan file. Nominal global-pack extent is labelled separately.
  const covCanvas = document.createElement('canvas');
  covCanvas.width = 720; covCanvas.height = 360;
  const covCtx = covCanvas.getContext('2d', { willReadFrequently:true });
  const covTexture = new THREE.CanvasTexture(covCanvas);
  const covMaterial = new THREE.MeshBasicMaterial({
    map:covTexture, transparent:true, depthWrite:false, side:THREE.FrontSide,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
  });
  const covShape = new THREE.Mesh(sphere.geometry.clone(),covMaterial);
  scene.add(covShape);
  const coverKey = (color,label) => {
    const row = document.createElement('div');row.className='tp-coverage-key';
    const swatch=document.createElement('i');swatch.style.background=color;
    const text=document.createElement('span');text.textContent=label;
    row.append(swatch,text);$('coverage-legend-key').appendChild(row);
  };
  const latLonIndex = (lat,lon) => {
    const x=Math.max(0,Math.min(719,Math.floor((((lon+180)%360+360)%360)/360*720)));
    const y=Math.max(0,Math.min(359,Math.floor((90-lat)/180*360)));
    return y*720+x;
  };
  let coveragePixels=null,coverageFor=null,activeLayer=0,coverageFlavor='none';
  function coveragePoint() {
    if(!meta||!meta[state.world])return;
    const installed=(meta[state.world].installedPacks||[]);
    if(state.world==='venus') {
      if(!installed.some(p=>p.coverageMaskUrl)) {
        $('coverage-at-point').textContent='Venus stereo pack not installed — bundled DEM in use.';
      } else if(!coveragePixels) {
        $('coverage-at-point').textContent='Reading actual observed-pixel coverage…';
      } else {
        const v=coveragePixels[latLonIndex(state.lat,state.lon)];
        $('coverage-at-point').textContent=v>0
          ? 'Here: ~'+Math.round(v/255*100)+'% stereo samples in nearby 0.5° cell; remainder uses bundled Venus DEM.'
          : 'Here: no measured stereo samples; bundled Venus DEM is used.';
      }
    } else if(state.world==='jupiter') {
      $('coverage-at-point').textContent='2015 imagery · no data beyond ±79.9°. Longitude is image-relative, not System III. Heights are color bands.';
    } else if(state.world==='earth') {
      $('coverage-at-point').textContent='Earth: NOAA global relief plus saved Copernicus surface regions where available. Boxes show installed cells, not survey confidence. Grid spacing is not uniform survey accuracy.';
    } else if(state.world==='pluto') {
      $('coverage-at-point').textContent='Pluto: green indicates mapped New Horizons areas; elsewhere is filled terrain.';
    } else if(installed.length) {
      $('coverage-at-point').textContent='Optional global DEM installed; its real NoData pixels can still use bundled elevation.';
    } else {
      $('coverage-at-point').textContent='Using included world elevation; local sharper patches are highlighted where present.';
    }
  }
  function coveragePaint(image,flavor,sequence){
    if(sequence!==activeLayer)return;
    const temp=document.createElement('canvas');temp.width=720;temp.height=360;
    const context=temp.getContext('2d',{willReadFrequently:true});
    context.drawImage(image,0,0,720,360);
    const read=context.getImageData(0,0,720,360).data;
    const out=covCtx.createImageData(720,360);coveragePixels=new Uint8Array(720*360);
    for(let k=0;k<coveragePixels.length;k++){
      const val=read[4*k];
      coveragePixels[k]=val;
      if(val===0)continue;
      const alpha=Math.round(val*(flavor==='venus'?.55:.40));
      out.data[4*k]=flavor==='venus'?58:84;
      out.data[4*k+1]=flavor==='venus'?218:192;
      out.data[4*k+2]=flavor==='venus'?164:207;
      out.data[4*k+3]=alpha;
    }
    covCtx.putImageData(out,0,0);
    covTexture.needsUpdate=true;
    coveragePoint();render();
  }
  function coverageUpdate() {
    const world=state.world,m=meta[world],installed=m.installedPacks||[];
    const seq=++activeLayer;
    coveragePixels=null;coverageFor=world;
    covCtx.clearRect(0,0,720,360);
    $('coverage-legend-key').textContent='';
    if(world==='venus') {
      const pack=installed.find(p=>p.coverageMaskUrl);
      if(pack) {
        coverKey('rgba(58,218,164,.65)','Actual Magellan stereo measurements · 600 m pixels, ~1–2 km effective detail');
        coverKey('#7a818a','Bundled Venus DEM / missing stereo elevations');
        const image=new Image();
        image.onload=()=>coveragePaint(image,'venus',seq);
        image.onerror=()=>{
          if(seq!==activeLayer)return;
          coveragePixels=null;coveragePoint();render();
          $('coverage-at-point').textContent='Coverage mask could not be loaded; no higher-fidelity areas are claimed.';
        };
        image.src=pack.coverageMaskUrl;
      } else {
        coverKey('#7a818a','Bundled Venus DEM (global)');
        coverKey('transparent','Stereo-derived terrain is available as an optional download; no map mask installed');
      }
    } else if(world==='jupiter') {
      coverKey('#394049','Unmapped poles · imagery ends at ±79.9°');
      coverKey('transparent','2015 Hubble color map · not elevation');
    } else if(world==='pluto') {
      coverKey('rgba(84,192,207,.50)','New Horizons mapped surface (bundled mask)');
      coverKey('#7a818a','Unmapped / filled area');
      const image=new Image();
      image.onload=()=>coveragePaint(image,'pluto',seq);
      image.src='data/pluto/coverage.png';
    } else {
      if(installed.some(p=>!p.regional)){
        covCtx.fillStyle='rgba(65,132,225,.20)';
        covCtx.fillRect(0,0,720,360);
        coverKey('rgba(65,132,225,.60)','Installed global higher-resolution DEM · nominal extent; pixel gaps not mapped');
      }
      const regions=installed.filter(p=>p.regional);
      if(regions.length){
        covCtx.fillStyle='rgba(174,121,235,.60)';
        for(const p of regions)for(const r of p.coverage||[])
          covCtx.fillRect((r.west+180)*2,(90-r.north)*2,(r.east-r.west)*2,(r.north-r.south)*2);
        coverKey('rgba(174,121,235,.60)','Saved Copernicus land cells · surface model; not a measured-pixel mask');
      }
      const patches=m.patches||{};
      if(Object.keys(patches).length){
        covCtx.fillStyle='rgba(241,183,62,.45)';
        for(const p of Object.values(patches)){
          const top=Math.max(0,(90-p.north)/180*360);
          const bot=Math.min(360,(90-p.south)/180*360);
          if(!Number.isFinite(top)||!Number.isFinite(bot)||top>=bot)continue;
          let west=p.west,east=p.east;
          while(west < -180){west+=360;east+=360;}
          while(west>=180){west-=360;east-=360;}
          for(const shift of [-360,0,360]){
            const l=(west+shift+180)/360*720,r=(east+shift+180)/360*720;
            covCtx.fillRect(l,top,r-l,bot-top);
          }
        }
        coverKey('rgba(241,183,62,.8)','Bundled higher-detail local elevation patch');
      }
      coverKey('#7a818a','Bundled global elevation / fallback for missing samples');
    }
    covTexture.needsUpdate=true;coveragePoint();render();
  }
  $('show-coverage').addEventListener('change',()=>{
    covShape.visible=$('show-coverage').checked;render();
  });

  let pendingFrame = false;
  const render = () => { if (pendingFrame) return; pendingFrame = true; requestAnimationFrame(() => { pendingFrame = false; if (!canvas.parentElement.hidden) renderer.render(scene, cam); }); };
  ctl.addEventListener('change', () => { const d = cam.position.length(); if (fpPts && Math.abs(d - fpDist) / fpDist > 0.08) drawFootprint(); render(); });
  function theme() { scene.background = new THREE.Color(css('--tp-stage') || '#0d1014'); stars.material.color.set(document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 0x8a919b : 0x9a958c); refresh(); }
  function setWorld(w) {
    if(w==='jupiter'&&!tex[w]) {
      const cv=document.createElement('canvas');cv.width=Math.min(3600,renderer.capabilities.maxTextureSize);cv.height=cv.width/2;const ctx=cv.getContext('2d');ctx.fillStyle='#394049';ctx.fillRect(0,0,cv.width,cv.height);
      tex[w]=new THREE.CanvasTexture(cv);tex[w].encoding=THREE.sRGBEncoding;
      const im=new Image();im.onload=()=>{ctx.drawImage(im,0,(90-79.9)/180*cv.height,cv.width,159.8/180*cv.height);tex[w].needsUpdate=true;render();};im.src='data/jupiter/opal-2015-3600.jpg';
    }
    if (!tex[w]) { $('gbusy').hidden = false; tex[w] = loader.load(w==='moon'?'data/moon/lroc-color-2025-8k.jpg':`data/${w}/globe.jpg`, () => { $('gbusy').hidden = true; render(); }); tex[w].encoding = THREE.sRGBEncoding; tex[w].anisotropy = 4; }
    mat.map = tex[w]; mat.needsUpdate = true;
    coverageUpdate();
    if (WORLDS[w].shape) {
      if (!shapes[w]) shapes[w] = fetch(`data/${w}/shape.json?v=` + BUILD).then(r => r.json()).then(shapeFn).catch(() => null);
      shapes[w].then(fn => { if (state.world === w) { applyShape(fn); refresh(); } });
    } else applyShape(null);
    refresh();
  }
  function inv(x, y, lat0, lon0, R) {
    const p0 = lat0 * Math.PI / 180, l0 = lon0 * Math.PI / 180, rho = Math.hypot(x, y); if (rho < 1e-9) return [lat0, lon0];
    const c = rho / R, sc = Math.sin(c), cc = Math.cos(c);
    return [Math.asin(Math.max(-1, Math.min(1, cc * Math.sin(p0) + y * sc * Math.cos(p0) / rho))) * 180 / Math.PI, (l0 + Math.atan2(x * sc, rho * Math.cos(p0) * cc - y * Math.sin(p0) * sc)) * 180 / Math.PI];
  }
  function outline(shape) { const n = shape === 'circle' ? 96 : (shape === 'hexagon' || shape === 'hexgrid') ? 6 : 4, pts = []; for (let i = 0; i < n; i++) { const a = shape === 'square' ? Math.PI / 4 + i * Math.PI / 2 : i * 2 * Math.PI / n, r = shape === 'square' ? Math.SQRT1_2 : 0.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return pts; }
  function refresh() {
    const R = meta[state.world].radiusKm, S = state.size, ring = outline(state.shape), pts = [], per = Math.max(4, Math.round(192 / ring.length));
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; for (let k = 0; k < per; k++) { const t = k / per, ll = inv((a[0] + (b[0] - a[0]) * t) * S, (a[1] + (b[1] - a[1]) * t) * S, state.lat, state.lon, R); pts.push(toVec(ll[0], ll[1], 1.004 * rAt(ll[0], ll[1]))); } }
    fpPts = pts; fpCentre = toVec(state.lat, state.lon, 1.004 * rAt(state.lat, state.lon)); drawFootprint();
    if (dots) { scene.remove(dots); dots.geometry.dispose(); }
    const sites = WORLDS[state.world].marks.filter(m => m.group === 'landing');
    dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(sites.map(L => toVec(L.lat, L.lon, 1.004 * rAt(L.lat, L.lon)))), dotMat); dotMat.color.set(css('--tp-accent') || '#fff'); scene.add(dots);
    coveragePoint(); render();
  }
  function lookAt(lat, lon) { const d = cam.position.length(); cam.position.copy(toVec(lat, lon, d)); ctl.update(); render(); }
  function resize() { const r = canvas.parentElement.getBoundingClientRect(); if (!r.width || !r.height) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); render(); }
  new ResizeObserver(resize).observe(canvas.parentElement);
  const ray = new THREE.Raycaster(); let down = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const rr = canvas.getBoundingClientRect(), nx = (e.clientX - rr.left) / rr.width * 2 - 1, ny = -(e.clientY - rr.top) / rr.height * 2 + 1;
    const sites = WORLDS[state.world].marks.filter(m => m.group === 'landing');
    const near = sites.map(L => { const v = toVec(L.lat, L.lon, rAt(L.lat, L.lon)), p = v.clone().project(cam); return { L, d: Math.hypot((p.x - nx) * rr.width / 2, (p.y - ny) * rr.height / 2), front: v.dot(cam.position) > 0 }; }).filter(o => o.front && o.d < 12).sort((a, b) => a.d - b.d)[0];
    if (near) { selectMark(near.L, true); return; }
    ray.setFromCamera({ x: nx, y: ny }, cam); const hit = ray.intersectObject(sphere)[0]; if (!hit) return;
    const v = hit.point.clone().normalize();
    state.lat = +(Math.asin(v.y) * 180 / Math.PI).toFixed(4); state.lon = +(Math.atan2(-v.z, v.x) * 180 / Math.PI).toFixed(4); state.mark = null;
    $('t-top').value = WORLDS[state.world].name.toUpperCase(); $('t-bottom').value = `${fmtLat(state.lat)}  ${fmtLon(state.lon)}`;
    syncInputs(); renderMarks(); refresh(); updateCoord(); schedule(true);
    $('pickhint').textContent = 'Region set · open Model to see it, or tap again';
  });
  TPTheme.listeners.push(() => setTimeout(theme, 0)); theme();
  return { setWorld, refresh, lookAt, resize };
}

// ---------------- landmarks ----------------
function hasPatch(L) {
  if (state.world === 'moon') return MOON_HI.includes(L.id);
  const pats = meta[state.world].patches || {}; return !!(pats[L.id] || (PATCH_OF[state.world] && PATCH_OF[state.world][L.id]));
}
function renderMarks() {
  const W = WORLDS[state.world], f = $('mark-filter').value.trim().toLowerCase();
  const box = $('marks'); box.textContent = '';
  const list = W.marks.filter(L => !f || (L.name + ' ' + L.note).toLowerCase().includes(f));
  $('mark-count').textContent = `${W.marks.length} sites`;
  const groups = [[W.landingTitle, list.filter(x => x.group === 'landing'), true], ['Landmarks', list.filter(x => x.group !== 'landing'), false]];
  for (const [title, items, dot] of groups) {
    if (!items.length) continue;
    const h = document.createElement('div'); h.className = 'grp'; if (dot) h.appendChild(document.createElement('i')); h.appendChild(document.createTextNode(title)); box.appendChild(h);
    for (const L of items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tp-mark'; b.id = 'mk-' + L.id; b.setAttribute('aria-pressed', String(state.mark === L.id));
      const nb = document.createElement('b'); nb.textContent = L.name; const ns = document.createElement('span'); ns.textContent = L.note; b.append(nb, ns);
      if (hasPatch(L)) { const e = document.createElement('em'); e.textContent = W.patchBadge || 'HI-RES'; b.appendChild(e); }
      b.onclick = () => selectMark(L); box.appendChild(b);
    }
  }
  if (!list.length) { const p = document.createElement('div'); p.className = 'p-3 tp-hint'; p.textContent = 'No landmark matches that search.'; box.appendChild(p); }
}
function selectMark(L, fromGlobe) {
  state.mark = L.id; state.lat = L.lat; state.lon = L.lon; state.size = L.size;
  $('exag').value = sliderFromEx(L.ex); $('o-exag').textContent = exFromSlider(+$('exag').value) + '×';
  $('t-top').value = L.name.toUpperCase(); $('t-bottom').value = `${fmtLat(L.lat)}  ${fmtLon(L.lon)}`;
  syncInputs(); renderMarks(); updateCoord(); if (globe) { globe.refresh(); if (!fromGlobe && !$('globe').parentElement.hidden) globe.lookAt(state.lat, state.lon); } schedule(true);
  if (fromGlobe) showTab('model');
}
function syncInputs() { $('lat').value = +state.lat.toFixed(4); $('lon').value = +state.lon.toFixed(4); $('size').value = Math.round(state.size); }
function updateCoord() { $('coord').innerHTML = `<span><b>${WORLDS[state.world].name}</b></span><span>${fmtLat(state.lat)} ${fmtLon(state.lon)}${state.world==='jupiter'?' (map-relative)':''}</span><span>${Math.round(state.size)} km wide</span>`; }

function syncMoonColors(){
  $('moon-color-options').hidden=state.world!=='moon';
  $('moon-color-controls').hidden=!moonColorEnabled();
  $('c-terrain').disabled=state.world==='jupiter'||moonColorEnabled();
}
function renderMoonPalette(palette){
  if(!palette)return;
  $('moon-palette').replaceChildren(...palette.map((hex,k)=>{const input=document.createElement('input');input.type='color';input.value=hex;input.setAttribute('aria-label','Moon filament '+(k+1));input.onchange=()=>{moonPalette=Array.from($('moon-palette').children,x=>x.value);schedule();};return input;}));
}
$('moon-color').onchange=()=>{syncMoonColors();schedule();};
for(const id of ['moon-count','moon-grid'])$(id).onchange=()=>{moonPalette=null;schedule();};
function syncJupiter() {
  const yes=state.world==='jupiter';$('jupiter-options').hidden=!yes;
  $('exag').disabled=$('base').disabled=$('c-terrain').disabled=yes;
  $('exag').parentElement.hidden=yes;
  $('separate').disabled=yes;
  $('size').max=yes?120000:9000;
  if(yes)$('separate').checked=true;
  syncMoonColors();
}
function renderJupiterPalette(palette) {
  if(!palette)return;
  $('jp-palette').replaceChildren(...palette.map((hex,k)=>{const input=document.createElement('input');input.type='color';input.value=hex;input.setAttribute('aria-label','Jupiter filament '+(k+1));input.onchange=()=>{jupiterPalette=Array.from($('jp-palette').children,x=>x.value);schedule();};return input;}));
}
for(const id of ['jp-count','jp-grid','jp-layer','jp-band','jp-backing'])$(id).onchange=()=>{jupiterPalette=null;schedule();};

// ---------------- worlds ----------------
function renderWorlds() {
  const box = $('worlds'); box.textContent = '';
  for (const [id, W] of Object.entries(WORLDS)) {
    if (!meta[id]) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-tp tp-world' + (state.world === id ? ' active' : ''); b.id = 'w-' + id;
    b.setAttribute('aria-pressed', String(state.world === id));
    const i = document.createElement('i'); i.style.background = W.dot; b.append(i, document.createTextNode(W.name)); b.onclick = () => setWorld(id); box.appendChild(b);
  }
}

function setWorld(id) {
  state.world = id; jupiterPalette=null; moonPalette=null; syncJupiter(); document.body.dataset.world = id; renderWorlds();
  state.colors.terrain = WORLDS[id].terrain; $('c-terrain').value = WORLDS[id].terrain;
  $('mark-filter').value = '';
  $('credits').innerHTML = '';
  const c = document.createElement('div'); c.textContent = WORLDS[id].credit + ' Decorative representation, not survey grade. Not endorsed by NASA or the USGS.'; $('credits').appendChild(c);
  const o = document.createElement('div'); o.style.marginTop = '6px';
  const a = document.createElement('a'); a.href = 'https://github.com/IanBauters/terrain-press'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'source code on GitHub';
  o.append('Terrain Press is free, open-source software (AGPL-3.0) · ', a, '.'); $('credits').appendChild(o);
  if (id === 'pluto' && !coverage) loadCoverage();
  if (globe) globe.setWorld(id);
  selectMark(WORLDS[id].marks.find(m => m.id === WORLDS[id].def));
}
function loadCoverage() {
  const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); coverage = { w: img.width, h: img.height, d: x.getImageData(0, 0, img.width, img.height).data }; schedule(); };
  img.src = 'data/pluto/coverage.png';
}
function coverageAt(lat, lon) { const x = Math.floor((lon + 180) / 360 * coverage.w) % coverage.w, y = Math.min(coverage.h - 1, Math.floor((90 - lat) / 180 * coverage.h)); return coverage.d[(y * coverage.w + x) * 4] / 255; }

// ---------------- UI wiring ----------------
function showTab(t) {
  const g = t === 'globe';
  $('tab-model').classList.toggle('active', !g); $('tab-globe').classList.toggle('active', g);
  $('tab-model').setAttribute('aria-selected', String(!g)); $('tab-globe').setAttribute('aria-selected', String(g));
  $('view-model').hidden = g; $('view-globe').hidden = !g;
  if (g) { if (!globe) { globe = makeGlobe(); globe.setWorld(state.world); } globe.resize(); globe.lookAt(state.lat, state.lon); } else bench.resize();
}
$('tab-model').onclick = () => showTab('model'); $('tab-globe').onclick = () => showTab('globe');
function syncMode() {
  syncJupiter();
  state.product = radio('product'); state.shape = radio('shape');
  state.border = state.shape === 'hexgrid' ? 'none' : radio('border'); state.font = radio('font');
  const automaticResolution = radio('resolution-mode') === 'auto';
  state.detail = automaticResolution ? 'source' : +radio('detail');
  $('auto-options').hidden = !automaticResolution;
  $('advanced-options').hidden = automaticResolution;
  const orn = state.product === 'ornament', framed = state.border !== 'none', sep = orn && framed && $('separate').checked;
  const hex = state.shape === 'hexgrid', clippedHex = hex && ['edge','alternating'].includes($('hex-layout').value);
  $('hex-opts').hidden = !hex;
  $('hex-edge-wrap').hidden = !clippedHex;
  $('hex-rings-wrap').hidden = !hex || $('hex-layout').value === 'square';
  // Ring presets show the ACTUAL counts for each orientation. The symmetric
  // alternating lattice can have a different number of clipped perimeter
  // panels than the flat-top layout at the same ring tier.
  const ringCounts = $('hex-layout').value === 'alternating'
    ? [7,19,43,55,91,133] : [7,19,37,61,91,127];
  for (const option of $('hex-rings').options) {
    const n = Number(option.value);
    option.textContent = n + (n === 1 ? ' ring' : ' rings') +
      ' · ' + ringCounts[n - 1] + ' pieces';
  }
  $('hex-square-wrap').hidden = !hex || $('hex-layout').value !== 'square';
  $('frame-options-section').hidden = hex;
  $('orn-opts').hidden = !orn || !framed; $('loop-wrap').hidden = !orn || !framed;
  $('fit-row').hidden = !(state.product === 'puzzle' || sep);
  $('pieces-wrap').hidden = state.product !== 'puzzle' || hex;
  $('spread-opts').hidden = state.product !== 'puzzle';
  $('back-opts').hidden = !framed; $('back-row').hidden = !$('back').checked;
  $('letter-opts').hidden = state.border !== 'lettered';
  $('frame').disabled = $('rim').disabled = !framed; $('rim-auto-wrap').hidden = !framed;
  $('loop-note').hidden = !(orn && state.border === 'lettered' && $('loop').checked);
  $('font-hint').textContent = FONT_INFO[state.font];
  const back = framed && $('back').checked;
  $('model-hint').textContent = state.product === 'puzzle'
    ? (state.shape === 'hexgrid' ? 'Hexagon tiles tessellate edge to edge with printable clearance. Downloads include spread print plates, single-tile STLs and a numbered map; no frame is generated.' :
      (back ? 'Pieces drop into the tray. The pieces and the tray come as separate files so the pieces don\'t fuse to its floor.' : 'Downloads include spread print plates, single-piece STLs and a numbered map.'))
    : (sep ? 'Two single-colour prints: the terrain drops into the frame' + (back ? ' tray.' : '.') : (back ? 'The terrain prints fused to the tray floor, so the ornament is one solid piece.' : 'Terrain and frame print together.'));
  $('export-note').textContent = state.product === 'puzzle'
    ? 'ZIP with spread plates (STL/3MF), single-piece STLs, numbered map and PDF print guide.'
    : (sep ? 'ZIP with separate print plates and PDF print guide.' : 'ZIP with STL, multicolour 3MF and PDF print guide.');
}
document.querySelectorAll('input[type=radio]').forEach(el => el.addEventListener('change', () => {
  if (el.name === 'shape' && el.value === 'hexgrid') $('p-puzzle').checked = true;
  if (el.name === 'product' && el.value === 'ornament' && $('s-hexgrid').checked)
    $('s-hexagon').checked = true;
  syncMode();
  if (el.name === 'shape' && globe) globe.refresh();
  const resolutionSetting = el.name === 'detail' || el.name === 'resolution-mode';
  if (!resolutionSetting || $('preview-high').checked) schedule();
  else void refreshPlan();
}));
$('preview-high').addEventListener('change', async () => {
  if ($('preview-high').checked && ready) {
    try {
      const result = await call({ type: 'plan', q: query(state.detail) });
      if (result.plan.N > 1441 && !confirm(
        'High-detail preview will build a ' + result.plan.N.toLocaleString('en-US') +
        ' × ' + result.plan.N.toLocaleString('en-US') +
        ' height grid and can require substantial memory. Continue?')) {
        $('preview-high').checked = false;
      }
    } catch (e) {
      $('preview-high').checked = false;
      toast('Could not estimate preview detail: ' + e.message, 'warning');
    }
  }
  schedule(true);
});
for (const id of ['sampling-limit', 'min-feature']) {
  $(id).addEventListener('change', () => {
    if ($('preview-high').checked) schedule();
    else void refreshPlan();
  });
}
['separate', 'loop', 'back', 'merge', 'rim-auto'].forEach(id => $(id).addEventListener('change', () => { syncMode(); schedule(); }));
['base', 'frame', 'rim', 'pieces', 'gap', 'spread-gap', 'back-mm', 't-top', 't-bottom'].forEach(id => $(id).addEventListener('input', () => schedule()));
$('hex-layout').addEventListener('change', () => { syncMode(); schedule(); });
$('hex-rings').addEventListener('change', schedule);
$('hex-across').addEventListener('change', () => {
  $('hex-across').value = String(Math.round(clamp(+$('hex-across').value,2,12,5)));
  schedule();
});
$('hex-edge').addEventListener('change', schedule);
const updateWidth = value => {
  const max = $('unlock-size').checked ? 5000 : 1000;
  const mm = clamp(Math.round(Number(value)), 60, max, 100);
  $('width').max = $('width-num').max = String(max);
  // The range slider still travels in 5 mm increments. The editable number
  // field is authoritative, preserving exact 1 mm steps for printed sizes.
  $('width').value = String(Math.round(mm / 5) * 5);
  $('width-num').value = String(mm);
  $('o-width').textContent = mm + ' mm';
  $('size-warning').hidden = !$('unlock-size').checked;
  schedule();
};
$('width').addEventListener('input', () => updateWidth($('width').value));
$('width-num').addEventListener('change', () => updateWidth($('width-num').value));
$('unlock-size').addEventListener('change', () => {
  if ($('unlock-size').checked && !confirm(
    'Unlock terrain widths up to 5,000 mm? Large meshes and hex grids can use multiple gigabytes of RAM, take a long time to export, and exceed printer build volumes.')) {
    $('unlock-size').checked = false;
  }
  updateWidth($('width-num').value);
});
// Native number fields stay text-editable; these extra arrows are persistent
// even when Chromium's built-in numeric spinners are hidden by OS styling.
document.querySelectorAll('.tp-step-button').forEach(button => {
  button.addEventListener('click', () => {
    const field = $(button.dataset.stepTarget);
    if (button.dataset.stepDirection === 'up') field.stepUp();
    else field.stepDown();
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.focus();
  });
});
$('exag').addEventListener('input', () => { $('o-exag').textContent = exFromSlider(+$('exag').value) + '×'; schedule(); });
$('sun').addEventListener('input', () => { $('o-sun').textContent = $('sun').value + '°'; bench.setSun(+$('sun').value); });
$('mark-filter').addEventListener('input', renderMarks);
for (const id of ['lat', 'lon', 'size']) $(id).addEventListener('change', () => {
  state.lat = clamp(+$('lat').value, -90, 90, state.lat); state.lon = clamp(+$('lon').value, -180, 180, state.lon); state.size = clamp(+$('size').value, 10, state.world==='jupiter'?120000:9000, state.size);
  state.mark = null; syncInputs(); renderMarks(); updateCoord(); if (globe) globe.refresh(); schedule(true);
});
for (const k of ['terrain', 'frame', 'text']) $('c-' + k).addEventListener('input', e => { state.colors[k] = e.target.value; bench.recolor(); });

// ---------------- export ----------------
function readmeTemplate(p, slug) {
  const W = WORLDS[state.world], spread = state.product === 'puzzle', back = p.border !== 'none' && p.back;
  const L = [`Terrain Press — ${slug}`, '',
    `World: ${W.name}`, `Centre: ${fmtLat(state.lat)} ${fmtLon(state.lon)}`, `Region width: ${state.size} km (azimuthal equidistant projection)`,
    `Elevation range: {{LOW}} m to {{HIGH}} m (${W.datum})`,
    `Model: ${p.product}, ${p.shape}, ${p.widthMm} mm terrain, ${p.exag}x relief exaggeration, {{RELIEF}} mm printed relief`,
    ...(p.shape === 'hexgrid' ? [`Hex layout: ${p.hexLayout}; ${p.hexLayout==='square' ? p.hexAcross+' across and down' : p.hexRings+' rings'}; ${p.pieces} nominal pieces; ${p.hexLayout==='round'||p.hexLayout==='square' ? 'all whole hexes' : 'lattice-aligned edge cuts, including half-hex border pieces'}; edge surface: ${p.hexEdge}.`] : []),
    ...(p.widthMm > 1000 ? ['OVERSIZE: width exceeds 1,000 mm; check RAM and printer build volume before slicing.'] : []),
    `Terrain resolution: ${$('resolution-auto').checked ? 'Automatic (DEM and printer-aware)' : 'Advanced (manual mesh spacing and sample limit)'}`,
    `Export detail: ${state.detail === 'source' ? 'Source-matched' : 'Fixed spacing'}`,
    'Mesh detail: {{STEP}} mm grid; {{GRID}} x {{GRID}} sampled heights; source {{SOURCE}} at {{PX}} m per sample',
    'Sampling control: {{SAMPLEMODE}} (ceiling {{CAP}} x {{CAP}})',
    ...($('resolution-auto').checked ? ['Smallest printable feature: {{FEATURE}} mm'] : ['Manual spacing overrides printable-feature optimization']),
    'Source raster spacing on print: {{SOURCESTEP}} mm/pixel',
    'Detail planning: {{LIMIT}}', '', 'Files'];
  if (spread) {
    L.push('  *-pieces-spread — the pieces only, spaced for separate printing on one or more build plates.');
    if (p.border !== 'none') L.push(`  *-frame — the frame${p.border === 'lettered' ? ' and lettering' : ''}, a separate plate.`);
    L.push('  *-assembled.3mf — everything in place, for reference only.');
  }
  else if (p.separate) L.push('  *-1-terrain — the terrain on its own, flat on the plate.', '  *-2-frame — the frame' + (p.border === 'lettered' && p.mergeText ? ' with its lettering' : '') + ', flat on the plate.', '  *-assembled.3mf — both in place, for reference only.');
  else if (p.product === 'puzzle' && back) L.push('  *-pieces — the pieces in their assembled positions, on their own plate.', '  *-tray — the tray' + (p.border === 'lettered' ? ' and lettering' : '') + ', on a second plate.', '  *-assembled.3mf — everything in place, for reference only.');
  else L.push(`  ${slug}.3mf — one object with separate parts; assign a filament to each part in your slicer.`, '  *-all.stl — everything in one file, single colour.', '  The other STLs are the same parts on their own, positioned to load together.');
  if (p.product === 'puzzle') L.push('  single-pieces/ — every piece as its own STL, centred and flat on the plate. Lost one? Print just that file.', '  single-pieces/*-piece-map.svg — the puzzle seen from above, each piece numbered to match its file.');
  L.push('', 'Print settings', '  Layer height 0.12–0.16 mm · 15% gyroid infill · no supports · every part prints flat on its base.');
  if (p.product === 'puzzle') L.push(`  Puzzle pieces have ${p.gapMm} mm total clearance` + (spread ? ` and are spread ${clamp(+$('spread-gap').value, 1, 15, 3)} mm beyond their tabs.` : '.'));
  if (p.separate) L.push(`  The terrain has ${p.gapMm} mm clearance to the frame; a drop of glue holds it.`);
  if (back) L.push(`  The frame has a closed ${p.backMm} mm back.`);
  if (p.border === 'lettered') L.push(p.mergeText ? '  Lettering is part of the frame. For coloured letters, add a filament change at {{FRAMETOP}} mm.' : '  Lettering is a separate part; or add a filament change at {{FRAMETOP}} mm.');
  if (W.partial) L.push('', 'Note: only part of Pluto was mapped by New Horizons; areas outside the mapped side are a smooth fill.');
  if (state.world === 'venus') L.push('', 'Magellan stereo source validity on this export grid: {{COVERAGE}}.',
    'The optional stereo source has 600 m raster pixels but approximately 1–2 km effective detail. NoData pixels are replaced by the bundled Venus DEM; green Globe coverage is derived from native observed samples.');
  L.push('', 'Data', '  ' + W.credit, '  Decorative representation, not survey grade. Not endorsed by NASA or the USGS.');
  return L.join('\n');
}
// the print guide loads on demand: jsPDF and the guide script only arrive when someone downloads
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const scripts = {};
function loadScript(src) {
  return scripts[src] || (scripts[src] = new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => { delete scripts[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(el); }));
}
async function printGuide(r, p, slug) {
  await Promise.all([loadScript(JSPDF_URL), loadScript('guide.js?v=' + BUILD)]);
  const W = WORLDS[state.world], L = W.marks.find(x => x.id === state.mark);
  const H = p.shape === 'hexagon' ? p.widthMm * Math.sqrt(3) / 2 : (r.stats.depthMm || p.widthMm), fr = p.border === 'none' ? 0 : p.frameMm;
  const font = await fetch('data/fonts/worm.json').then(x => x.json()).catch(() => null);
  const shape = { circle: 'Circle', square: 'Square', hexagon: 'Hexagon', hexgrid: 'Hex Grid' }[p.shape];
  return TPGuide.make({
    p, slug, colors: state.colors, plates: r.plates, pieces: r.pieces, stats: r.stats, world: { ...W, radiusKm: meta[state.world]?.radiusKm },
    place: L ? L.name : `${fmtLat(state.lat)} ${fmtLon(state.lon)}`, landmark: L || null, coords: `${fmtLat(state.lat)}  ${fmtLon(state.lon)}`,
    lat: state.lat, lon: state.lon, size: state.size, kind: `${shape} ${p.product}`,
    footprint: `${Math.round((r.stats.widthMm || p.widthMm) + 2 * fr)} × ${Math.round(H + 2 * fr + (p.loop ? 11 : 0))} mm`,
    hasAssembled: r.files.some(f => f[0].endsWith('-assembled.3mf')), font });
}
$('export').onclick = async () => {
  const btn = $('export'); if (btn.disabled || !ready) return; btn.disabled = true; const old = 'Download print files';
  try {
    if (state.border === 'lettered') await ensureFont(state.font);
    const p = params(state.detail);
    const preflight = await call({ type: 'plan', q: query(state.detail) });
    if (preflight.plan.N > 1441 && !confirm(
      'This export will sample ' + preflight.plan.N.toLocaleString('en-US') +
      ' × ' + preflight.plan.N.toLocaleString('en-US') +
      ' heights and may require substantial RAM and processing time. Continue?')) return;
    const L = WORLDS[state.world].marks.find(x => x.id === state.mark);
    if (p.widthMm > 1000 && !confirm(
      'Export a ' + p.widthMm.toLocaleString('en-US') + ' mm-wide model? Hex pieces and high-detail meshes may use substantial RAM and produce very large print files. Continue?')) return;
    const slug = ((L ? L.name : WORLDS[state.world].name + ' ' + fmtLat(state.lat) + ' ' + fmtLon(state.lon)) + ' ' + p.product + ' ' + p.shape).toLowerCase().replace(/°/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    btn.textContent = state.world==='jupiter'?'Sampling cloud colors…':'Loading elevation…';
    const pr = call({ type: 'export', q: query(state.detail), p, font: state.border === 'lettered' ? state.font : null, readme: readmeTemplate(p, slug),
      x: { slug, colors: state.colors, spread: state.product === 'puzzle', spreadGap: clamp(+$('spread-gap').value, 1, 15, 3), perPiece: state.product === 'puzzle' } });
    exportId = reqId;
    const r = await pr, files = r.files;
    btn.textContent = 'Writing the print guide…';
    try { files.push([`${slug}-print-guide.pdf`, await printGuide(r, p, slug)]); }
    catch (e) {
      console.warn('Print guide failed; including the full export metadata README', e);
      files.push(['README.txt', r.readmeFallback]);
    }
    btn.textContent = 'Packing files…';
    const transfer = files.map(f => f[1]).filter(d => d instanceof Uint8Array).map(d => d.buffer);
    const zr = await call({ type: 'zip', files }, transfer);
    const blob = new Blob([zr.zip], { type: 'application/zip' });
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
    if (dl) {
      try { await dl.save({ filename: slug + '.zip', data: blob }); toast('Saved ' + slug + '.zip', 'success'); }
      catch (e) { if (e && e.code !== 'declined') toast('The download was blocked here (' + (e.code || 'error') + ').', 'warning'); }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = slug + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
    }
  } catch (e) { console.error(e); toast('Export failed: ' + e.message, 'danger'); }
  finally { btn.disabled = false; btn.textContent = old; }
};

// ---------------- desktop terrain data manager ----------------
function initTerrainDataManager() {
  const api = window.terrainPacks;
  if (!api) return;
  const open = $('manage-data'), dialog = $('data-dialog'), list = $('data-packs');
  const progress = $('data-progress'), folder = $('data-folder');
  open.hidden = false;
  const make = (tag, text, cls) => {
    const el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const format = b => b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + ' GiB'
    : (b / 1024 ** 2).toFixed(1) + ' MiB';
  // Every included or optional dataset is tied to exactly one planetary body.
  // Use the same world IDs as the renderer rather than inferring it from
  // acronyms such as LOLA, MOLA, MESSENGER or Dawn.
  const worldKind = {
    earth: 'planet', moon: "Earth's moon", mars: 'planet', mercury: 'planet',
    venus: 'planet', ceres: 'dwarf planet', vesta: 'asteroid',
    pluto: 'dwarf planet'
  };
  const worldName = id => WORLDS[id]?.name || id;
  const worldLabel = id => 'Applies to: ' + worldName(id) +
    (worldKind[id] ? ' (' + worldKind[id] + ')' : '');
  const error = e => { progress.textContent = e && e.message ? e.message : String(e); };
  function updateProgress(p) {
    if (!p) return;
    const percent = p.totalBytes ? Math.min(100, Math.floor(100 * (p.downloadedBytes + (p.currentFileBytes || 0)) / p.totalBytes)) : 0;
    progress.textContent = p.phase + ' · ' + p.doneFiles + '/' + p.totalFiles +
      ' tiles' + (p.totalBytes ? ' · ' + percent + '%' : '') + (p.error ? ' · ' + p.error : '');
    $('data-cancel').hidden = !['checking regional availability', 'downloading regional terrain', 'manifest', 'connecting to NASA', 'connecting to USGS', 'connecting to NOAA', 'downloading', 'downloading from NASA', 'downloading from USGS', 'downloading from NOAA NCEI', 'verifying downloaded file', 'validating GeoTIFF'].includes(p.phase);
    $('data-cancel').onclick = () => api.cancel(p.id);
  }
  async function render() {
    const s = await api.status();
    list.replaceChildren();
    folder.textContent = 'Storage: ' + s.root;
    list.appendChild(make('h3', 'Included offline', 'h6 mt-3'));
    for (const built of s.bundled) {
      const row = make('div', '', 'tp-data-row');
      const details = make('div', '', 'tp-data-entry');
      details.appendChild(make('strong', built.name + ' · Included'));
      details.appendChild(make('div', worldLabel(built.body), 'tp-data-world'));
      details.appendChild(make('div', built.w + ' × ' + built.h +
        ' · ' + format(built.bytes) + ' compressed', 'tp-data-muted'));
      row.appendChild(details);
      list.appendChild(row);
    }
    list.appendChild(make('h3','Earth · download a selected area','h6 mt-3'));
    const region=make('div','','tp-data-row'),entry=make('div','','tp-data-entry');
    entry.appendChild(make('p',state.world==='earth'
      ? `Current selection: ${state.lat.toFixed(3)}°, ${state.lon.toFixed(3)}° · ${state.size} km wide`
      : 'Select Earth and choose coordinates and a region width, then reopen this manager.','tp-data-muted'));
    entry.appendChild(make('p','Copernicus surface heights include vegetation/buildings. Downloads contain whole land cells; missing cells use lower-resolution terrain. Maximum 500 km width and 64 cells.','tp-data-muted'));
    const resolution=make('select','','form-select form-select-sm');
    resolution.setAttribute('aria-label','Earth regional terrain resolution');
    for(const r of [30,90]){const o=make('option',r+' m surface terrain');o.value=r;resolution.appendChild(o);}
    const check=make('button','Check availability and size','btn btn-sm btn-tp'),download=make('button','Download region','btn btn-sm btn-tp');
    check.type=download.type='button';check.disabled=state.world!=='earth'||!!s.active;download.disabled=true;
    const info=make('p','','tp-data-muted');let plan=null;
    resolution.onchange=()=>{plan=null;info.textContent='';download.disabled=true;};
    check.onclick=async()=>{
      check.disabled=resolution.disabled=true;download.disabled=true;plan=null;
      try{
        plan=await api.planRegion({lat:state.lat,lon:state.lon,sizeKm:state.size,resolution:Number(resolution.value)});
        const already=s.installed.some(p=>p.id===plan.id);
        info.textContent=`${plan.fileCount} land cells · ${format(plan.downloadBytes)} plus cache · ${plan.missingCells} unavailable cells use fallback.`+(already?' Already installed.':'');
        download.disabled=already;progress.textContent='Availability checked';
      }catch(e){error(e);}finally{check.disabled=resolution.disabled=false;$('data-cancel').hidden=true;}
    };
    download.onclick=async()=>{
      if(!plan||!confirm(`Download ${plan.name} (${format(plan.downloadBytes)}) to ${s.root}? Leave space for the terrain cache.`))return;
      check.disabled=resolution.disabled=download.disabled=true;
      try{await api.downloadRegion(plan.id);location.reload();}
      catch(e){error(e);await render();}finally{$('data-cancel').hidden=true;}
    };
    entry.append(resolution,check,info,download);region.appendChild(entry);list.appendChild(region);
    list.appendChild(make('h3', 'Optional planetary downloads', 'h6 mt-3'));
    list.appendChild(make('p', 'Earth uses NOAA ETOPO 2022 ice-surface and ocean-floor relief (60 or 30 arc-seconds); source detail varies. Selected land regions can use Copernicus 30 m or 90 m surface terrain, available offline after download. Moon LOLA, Mars MOLA, and regional Venus Magellan stereo elevations come directly from NASA PDS. Mercury MESSENGER and Ceres/Vesta Dawn beta upgrades use USGS GeoTIFFs. Native files are kept offline; tiles are converted locally on demand. Venus stereo detail covers only measured patches (~20% of the globe); see the observed-pixel legend on Globe. Pluto finer detail is geographically limited.', 'tp-data-muted'));
    const installed = new Set(s.installed.map(p => p.id));
    for (const pack of s.catalog) {
      const row = make('div', '', 'tp-data-row');
      const details = make('div', '', 'tp-data-entry');
      details.appendChild(make('strong', pack.name));
      details.appendChild(make('div', worldLabel(pack.body), 'tp-data-world'));
      details.appendChild(make('div', pack.note || pack.body, 'tp-data-muted'));
      if (pack.downloadBytes) details.appendChild(make('div',
        (pack.format === 'copernicus-region' ? 'Copernicus GeoTIFF region' : pack.format === 'noaa-geotiff' ? 'NOAA GeoTIFF' : pack.format === 'usgs-geotiff' ? 'USGS GeoTIFF' : 'NASA IMG') + ' download: ~' + format(pack.downloadBytes) + ' plus local tile cache', 'tp-data-muted'));
      row.appendChild(details);
      const button = make('button', installed.has(pack.id) ? 'Remove' :
        pack.status === 'published' ? 'Download' : 'Planned', 'btn btn-sm btn-tp');
      button.type = 'button';
      button.disabled = !!s.active || (pack.status !== 'published' && !installed.has(pack.id));
      button.onclick = async () => {
        if (!installed.has(pack.id) && pack.downloadBytes &&
            !confirm('Download ' + pack.name + ' for ' + worldName(pack.body) +
              ' (' + format(pack.downloadBytes) + ') to ' + s.root +
              '? Leave space for the local terrain tile cache.')) return;
        button.disabled = true;
        progress.textContent = installed.has(pack.id) ? 'Removing dataset…' : 'Downloading dataset…';
        try {
          if (installed.has(pack.id)) await api.remove(pack.id);
          else await api.download(pack.id);
          location.reload(); // Refresh worker metadata and resume using best installed source.
        } catch (e) { error(e); await render(); }
      };
      row.appendChild(button);
      list.appendChild(row);
    }
    if (s.active) updateProgress(s.active);
  }
  api.onProgress(updateProgress);
  open.onclick = async () => {
    dialog.showModal();
    try { await render(); } catch (e) { error(e); }
  };
  $('data-close').onclick = () => dialog.close();
  $('data-dir').onclick = async () => {
    try { await api.chooseDirectory(); await render(); }
    catch (e) { error(e); }
  };
}

// ---------------- boot ----------------
(async () => {
  $('width-num').value = $('width').value;
  $('o-width').textContent = $('width-num').value + ' mm'; $('o-sun').textContent = $('sun').value + '°'; $('o-exag').textContent = exFromSlider(+$('exag').value) + '×';
  busy('Loading…');
  try {
    meta = await fetch('data/meta.json?v=' + BUILD).then(r => r.json());
    meta.jupiter={radiusKm:71492};
    if (window.terrainPacks) {
      try {
        const status = await window.terrainPacks.status();
        for (const p of status.installed) {
          if (meta[p.body]) (meta[p.body].installedPacks ||= []).push(p);
        }
      } catch (e) { console.warn('Optional terrain packs unavailable:', e); }
    }
    initTerrainDataManager();
    renderWorlds(); syncMode(); startWorker(); setWorld('moon');
  } catch (e) { console.error(e); busy(null); toast('The elevation data did not load. Reload the page to try again.', 'danger'); }
})();
})();
