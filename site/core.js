// Terrain Press core: elevation sampling, solids, jigsaw cuts, lettering, STL/3MF/ZIP writers.
// Runs in a worker (or the page as a fallback). Needs poly2tri and ClipperLib.
(function (root) {
  const P2T = root.poly2tri, CL = root.ClipperLib;
  const SCALE = 1000; // clipper units per mm
  // ---------- elevation store ----------
  // Global grids are pixel-registered: 8192 x 4096, tiles 512, row 0 at the north.
  function makeStore(meta, loader) {
    // loader(path) -> Promise<Float32Array> (decoded, row-major)
    const cache = new Map();
    function get(path) {
      if (!cache.has(path)) {
        const promise = Promise.resolve().then(() => loader(path));
        cache.set(path, promise.catch(error => {
          cache.delete(path); // A transient read failure must not poison later exports.
          throw error;
        }));
      }
      return cache.get(path);
    }
    function nodeGrid(lat0, lon0, sizeKm, N, R) {
      // returns arrays of lat/lon for an N x N azimuthal-equidistant grid (row 0 = north edge)
      const lats = new Float64Array(N * N), lons = new Float64Array(N * N);
      const p0 = lat0 * Math.PI / 180, l0 = lon0 * Math.PI / 180;
      const sp = Math.sin(p0), cp = Math.cos(p0);
      for (let i = 0; i < N; i++) {
        const y = sizeKm / 2 - i * sizeKm / (N - 1);
        for (let j = 0; j < N; j++) {
          const x = -sizeKm / 2 + j * sizeKm / (N - 1);
          const rho = Math.hypot(x, y);
          let lat, lon;
          if (rho < 1e-9) { lat = p0; lon = l0; } else {
            const c = rho / R, sc = Math.sin(c), cc = Math.cos(c);
            lat = Math.asin(Math.max(-1, Math.min(1, cc * sp + y * sc * cp / rho)));
            lon = l0 + Math.atan2(x * sc, rho * cp * cc - y * sp * sc);
          }
          let ld = lon * 180 / Math.PI;
          ld = ((ld + 180) % 360 + 360) % 360 - 180;
          lats[i * N + j] = lat * 180 / Math.PI; lons[i * N + j] = ld;
        }
      }
      return { lats, lons };
    }
    function chooseSource(body, lat0, lon0, sizeKm, N, ignoreInstalled = false) {
      const m = meta[body], R = m.radiusKm;
      const spacingKm = sizeKm / (N - 1);
      const g = nodeGrid(lat0, lon0, sizeKm, N, R);
      // hi-res patch if region falls entirely inside one
      let candidatePatch = null;
      if (m.patches) {
        for (const [id, p] of Object.entries(m.patches)) {
          let inside = true;
          for (let k = 0; k < g.lats.length && inside; k += 7) {
            const la = g.lats[k], lo = g.lons[k] < p.west ? g.lons[k] + 360 : g.lons[k]; // patches may cross 180°
            if (la > p.north || la < p.south || lo < p.west || lo > p.east) inside = false;
          }
          if (inside) {
            const pxKm = (Math.PI * R / 180) / p.ppd;
            if (!candidatePatch || pxKm < candidatePatch.pxKm)
              candidatePatch = { kind: 'patch', id, grid: g, pxKm, label: `${p.ppd.toFixed(0)} px/deg`, paths: [`data/${body}/patch_${id}.webp`] };
          }
        }
      }
      // Use the sharpest installed global pack, retaining any sharper included landmark patch.
      const packs = (ignoreInstalled ? [] : m.installedPacks || []).filter(p =>
        p && Number.isInteger(p.w) && Number.isInteger(p.h) && Number.isInteger(p.tile) &&
        p.w > m.w && p.h > 0 && p.tile > 0 && /^[a-z][a-z0-9-]{1,63}$/.test(p.id)
      ).sort((a, b) => b.w - a.w);
      if (packs.length) {
        const p = packs[0], pxKm = 2 * Math.PI * R / p.w;
        if (!candidatePatch || pxKm < candidatePatch.pxKm) {
          const set = new Set();
          for (let k = 0; k < g.lats.length; k++) {
            const fy = (90 - g.lats[k]) / 180 * p.h - 0.5;
            const fx = (g.lons[k] + 180) / 360 * p.w - 0.5;
            for (const yy of [Math.floor(fy), Math.floor(fy) + 1])
              for (const xx of [Math.floor(fx), Math.floor(fx) + 1]) {
                const y = Math.max(0, Math.min(p.h - 1, yy));
                const x = ((xx % p.w) + p.w) % p.w;
                set.add('t' + ((y / p.tile) | 0) + '_' + ((x / p.tile) | 0) + '.webp');
              }
          }
          const prefix = 'packs/' + p.id;
          const extension = p.imageExt === 'png' ? 'png' : 'webp';
          return { kind: 'pack', id: p.id, grid: g, w: p.w, h: p.h,
            tile: p.tile, prefix, imageExt: extension, pxKm,
            label: p.label || (p.w / 360).toFixed(0) + ' px/deg',
            paths: [...set].map(name => prefix + '/' + name.replace(/\.webp$/, '.' + extension)) };
        }
      }
      if (candidatePatch) return candidatePatch;
      const fullPxKm = (2 * Math.PI * R) / m.w;
      const ovPxKm = (2 * Math.PI * R) / m.ovw;
      if (spacingKm > ovPxKm * 0.7) {
        return { kind: 'overview', grid: g, pxKm: ovPxKm, label: `${(m.ovw / 360).toFixed(1)} px/deg`, paths: [`data/${body}/overview.webp`] };
      }
      const T = m.tile, set = new Set();
      for (let k = 0; k < g.lats.length; k++) {
        const fy = (90 - g.lats[k]) / 180 * m.h - 0.5, fx = (g.lons[k] + 180) / 360 * m.w - 0.5;
        for (const yy of [Math.floor(fy), Math.floor(fy) + 1]) for (const xx of [Math.floor(fx), Math.floor(fx) + 1]) {
          const y = Math.max(0, Math.min(m.h - 1, yy)), x = ((xx % m.w) + m.w) % m.w;
          set.add(`${(y / T) | 0}_${(x / T) | 0}`);
        }
      }
      return { kind: 'tiles', grid: g, pxKm: fullPxKm, label: `${(m.w / 360).toFixed(1)} px/deg`, paths: [...set].map(s => `data/${body}/t${s}.webp`) };
    }
    async function sample(body, lat0, lon0, sizeKm, N, onProgress, ignoreInstalled = false) {
      const m = meta[body];
      const src = chooseSource(body, lat0, lon0, sizeKm, N, ignoreInstalled);
      let done = 0;
      const arrays = await Promise.all(src.paths.map(p => get(p).then(a => { done++; onProgress && onProgress(done, src.paths.length); return a; })));
      const byPath = new Map(src.paths.map((p, i) => [p, arrays[i]]));
      const out = new Float32Array(N * N);
      const { lats, lons } = src.grid;
      let W, H, read;
      if (src.kind === 'patch') {
        const p = m.patches[src.id], A = arrays[0];
        W = p.w; H = p.h;
        for (let k = 0; k < out.length; k++) {
          const fy = (p.north - lats[k]) / (p.north - p.south) * H - 0.5;
          const lo = lons[k] < p.west ? lons[k] + 360 : lons[k];
          const fx = (lo - p.west) / (p.east - p.west) * W - 0.5;
          out[k] = bilinear(A, W, H, fx, fy, false);
        }
      } else if (src.kind === 'overview') {
        const A = arrays[0]; W = m.ovw; H = m.ovh;
        for (let k = 0; k < out.length; k++) {
          const fy = (90 - lats[k]) / 180 * H - 0.5, fx = (lons[k] + 180) / 360 * W - 0.5;
          out[k] = bilinear(A, W, H, fx, fy, true);
        }
      } else {
        W = src.w || m.w; H = src.h || m.h; const T = src.tile || m.tile;
        const prefix = src.prefix || `data/${body}`;
        const extension = src.imageExt || 'webp';
        const px = (x, y) => {
          y = Math.max(0, Math.min(H - 1, y)); x = ((x % W) + W) % W;
          const col = Math.floor(x / T), row = Math.floor(y / T);
          const key = prefix + '/t' + row + '_' + col + '.' + extension;
          const pixels = byPath.get(key);
          if (!pixels) throw new Error('Missing terrain tile ' + key + ' for the selected coordinates');
          const tileWidth = Math.min(T, W - col * T);
          const offset = (y % T) * tileWidth + (x % T);
          if (offset >= pixels.length) throw new Error('Invalid terrain tile dimensions for ' + key);
          return pixels[offset];
        };
        for (let k = 0; k < out.length; k++) {
          const fy = (90 - lats[k]) / 180 * H - 0.5, fx = (lons[k] + 180) / 360 * W - 0.5;
          const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
          const a = px(x0, y0), b = px(x0 + 1, y0), c = px(x0, y0 + 1), d = px(x0 + 1, y0 + 1);
          out[k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
        }
      }
      // Some published DTMs have shadows/NoData. Preserve measured heights,
      // substituting built-in terrain only at genuinely missing pixels.
      if (!ignoreInstalled && src.kind === 'pack' && out.some(v => !Number.isFinite(v))) {
        const fallback = await sample(body, lat0, lon0, sizeKm, N, null, true);
        for (let k = 0; k < out.length; k++)
          if (!Number.isFinite(out[k])) out[k] = fallback.heights[k];
      }
      return { heights: out, N, source: src };
    }
    async function globeSampler(body) {
      const m = meta[body], A = await get(`data/${body}/overview.webp`);
      return (lat, lon) => bilinear(A, m.ovw, m.ovh, (lon + 180) / 360 * m.ovw - 0.5, (90 - lat) / 180 * m.ovh - 0.5, true);
    }
    return { sample, chooseSource, globeSampler };
  }
  function bilinear(A, W, H, fx, fy, wrap) {
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const cy = y => Math.max(0, Math.min(H - 1, y));
    const cx = x => wrap ? ((x % W) + W) % W : Math.max(0, Math.min(W - 1, x));
    const g = (x, y) => A[cy(y) * W + cx(x)];
    return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
  }

  // Resolution-aware uniform heightfield planner (not adaptive triangulation).
  // The DEM spacing is projected into print-space millimetres. A ~1.5x raster
  // oversampling factor supports interpolation; ~2 nodes per printable feature
  // avoid meshing detail a printer cannot show. The larger spacing wins.
  //
  // samplingLimit='auto': avoid geometry beyond *both* DEM and printable detail.
  // Explicit 721/1441/2881: honor selected print-detail preset up to that cap.
  // Omitting samplingLimit preserves the legacy 721-node behavior for callers.
  function meshPlan(widthMm, sizeKm, sourcePxKm, detail, samplingLimit = 721, featureMm = 0.4) {
    const HARD_MAX = 2881, LEVELS = [721, 1441, 2881];
    if (!(Number.isFinite(widthMm) && widthMm > 0 &&
      Number.isFinite(sizeKm) && sizeKm > 0 &&
      Number.isFinite(sourcePxKm) && sourcePxKm > 0))
      throw new Error('Invalid dimensions or elevation resolution');
    const autoCap = samplingLimit === 'auto';
    if (!autoCap && !LEVELS.includes(samplingLimit))
      throw new Error('Unsupported terrain sampling limit');
    if (!(Number.isFinite(featureMm) && featureMm >= 0.1 && featureMm <= 2))
      throw new Error('Invalid printable feature size');
    const sourceStepMm = widthMm * sourcePxKm / sizeKm;
    const usefulStepMm = Math.max(sourceStepMm / 1.5, featureMm / 2);
    const usefulN = Math.max(3, Math.ceil(widthMm / usefulStepMm) + 1);
    const nativeN = Math.ceil(1.5 * sizeKm / sourcePxKm) + 1;
    let requestedN;
    if (detail === 'source') {
      // Auto detail in automatic-limit mode is *not* forced to Standard density.
      // Manual ceilings preserve the prior source-matched, Standard-minimum path.
      requestedN = autoCap ? usefulN : Math.max(Math.round(widthMm / 0.5) + 1, nativeN);
    } else {
      if (!(Number.isFinite(detail) && detail > 0)) throw new Error('Invalid mesh detail');
      requestedN = Math.round(widthMm / detail) + 1;
    }
    requestedN = Math.max(3, requestedN);
    const cap = autoCap ? HARD_MAX : samplingLimit;
    const N = Math.max(3, Math.min(requestedN, cap, autoCap ? usefulN : Infinity));
    const gridLimit = requestedN > cap || (autoCap && usefulN > cap && requestedN >= cap);
    const detailOptimized = autoCap && requestedN > usefulN;
    const recommendedLimit = LEVELS.find(n => n >= Math.min(usefulN, HARD_MAX)) || HARD_MAX;
    return {
      N, stepMm: widthMm / (N - 1), limited: gridLimit,
      mode: detail === 'source' ? 'source' : 'fixed',
      samplingLimit, cap, recommendedLimit, featureMm, sourceStepMm, usefulStepMm,
      usefulN, requestedN, detailOptimized, hardwareCap: usefulN > HARD_MAX && N === HARD_MAX
    };
  }
  // ---------- 2D helpers (mm) ----------
  const toCL = pts => pts.map(p => ({ X: Math.round(p[0] * SCALE), Y: Math.round(p[1] * SCALE) }));
  const fromCL = path => path.map(p => [p.X / SCALE, p.Y / SCALE]);
  function area(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return -a / 2; }
  function ccw(pts) { return area(pts) >= 0 ? pts : pts.slice().reverse(); }
  function cw(pts) { return area(pts) < 0 ? pts : pts.slice().reverse(); }

  function shapeOutline(shape, W) {
    const pts = [];
    if (shape === 'circle') {
      const n = 240; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([Math.cos(a) * W / 2, Math.sin(a) * W / 2]); }
    } else if (shape === 'hexagon') {
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; pts.push([Math.cos(a) * W / 2, Math.sin(a) * W / 2]); }
    } else {
      pts.push([-W / 2, -W / 2], [W / 2, -W / 2], [W / 2, W / 2], [-W / 2, W / 2]);
    }
    return pts;
  }
  function densify(pts, maxLen) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push(a);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / maxLen);
      for (let k = 1; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
  }
  function cleanRing(pts, minD) {
    const out = [];
    for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > minD) out.push(p); }
    while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= minD) out.pop();
    // drop collinear points
    const res = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cr) > 1e-7) res.push(b);
    }
    return res;
  }
  function offset(paths, delta, join) {
    const co = new CL.ClipperOffset(2, 0.05 * SCALE);
    co.AddPaths(paths.map(toCL), join === 'miter' ? CL.JoinType.jtMiter : CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    const sol = new CL.Paths(); co.Execute(sol, delta * SCALE);
    return sol.map(fromCL);
  }
  function boolOp(type, subj, clip) {
    const c = new CL.Clipper();
    c.AddPaths(subj.map(toCL), CL.PolyType.ptSubject, true);
    c.AddPaths(clip.map(toCL), CL.PolyType.ptClip, true);
    const tree = new CL.PolyTree();
    c.Execute(type, tree, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    return polyTreeToExPolys(tree);
  }
  function exPolysFrom(paths) { // normalize a set of rings into outer+holes
    const c = new CL.Clipper(); c.AddPaths(paths.map(toCL), CL.PolyType.ptSubject, true);
    const tree = new CL.PolyTree(); c.Execute(CL.ClipType.ctUnion, tree, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    return polyTreeToExPolys(tree);
  }
  function polyTreeToExPolys(tree) {
    const res = [];
    const walk = node => {
      for (const ch of node.Childs()) {
        if (!ch.IsHole()) {
          res.push({ outer: ccw(fromCL(ch.Contour())), holes: ch.Childs().map(h => cw(fromCL(h.Contour()))) });
          for (const h of ch.Childs()) walk(h);
        }
      }
    };
    walk(tree);
    return res;
  }
  const exArea = e => area(e.outer) + e.holes.reduce((s, h) => s + area(h), 0);

  // ---------- solid builder ----------
  // ex: {outer, holes}; topZ: number | fn(x,y); bottomZ number; step: Steiner grid spacing (0 = none)
  function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function distToRing(x, y, ring) {
    let best = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ring[j][0], ay = ring[j][1], bx = ring[i][0], by = ring[i][1];
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      let t = L ? ((x - ax) * dx + (y - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy); if (d < best) best = d;
    }
    return best;
  }
  function triangulate(ex, steiner) {
    const contour = ex.outer.map(p => new P2T.Point(p[0], p[1]));
    const sw = new P2T.SweepContext(contour, { cloneArrays: false });
    for (const h of ex.holes) sw.addHole(h.map(p => new P2T.Point(p[0], p[1])));
    if (steiner && steiner.length) sw.addPoints(steiner.map(p => new P2T.Point(p[0], p[1])));
    sw.triangulate();
    return sw.getTriangles().map(t => t.getPoints().map(p => [p.x, p.y]));
  }
  function steinerPoints(ex, step) {
    const pts = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ex.outer) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const rings = [ex.outer, ...ex.holes];
    // bucket edges for fast distance test
    const gs = step * 2, edges = new Map();
    const key = (i, j) => i + ',' + j;
    for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[j], b = r[i];
      const i0 = Math.floor(Math.min(a[0], b[0]) / gs) - 1, i1 = Math.floor(Math.max(a[0], b[0]) / gs) + 1;
      const j0 = Math.floor(Math.min(a[1], b[1]) / gs) - 1, j1 = Math.floor(Math.max(a[1], b[1]) / gs) + 1;
      for (let u = i0; u <= i1; u++) for (let v = j0; v <= j1; v++) { const k = key(u, v); if (!edges.has(k)) edges.set(k, []); edges.get(k).push([a, b]); }
    }
    const minD = step * 0.45;
    const x0 = Math.ceil(minX / step) * step, y0 = Math.ceil(minY / step) * step;
    for (let y = y0; y <= maxY; y += step) {
      for (let x = x0; x <= maxX; x += step) {
        if (!pointInRing(x, y, ex.outer)) continue;
        let inHole = false; for (const h of ex.holes) if (pointInRing(x, y, h)) { inHole = true; break; }
        if (inHole) continue;
        const near = edges.get(key(Math.floor(x / gs), Math.floor(y / gs)));
        let ok = true;
        if (near) for (const [a, b] of near) {
          const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
          let t = L ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
          if (Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < minD) { ok = false; break; }
        }
        if (ok) pts.push([x + 1e-6 * ((x * 7.3 + y * 3.1) % 1), y + 1e-6 * ((x * 1.7 + y * 5.9) % 1)]);
      }
    }
    return pts;
  }
  function solid(ex, topZ, bottomZ, step, out) {
    ex = { outer: ccw(cleanRing(ex.outer, 0.02)), holes: ex.holes.map(h => cw(cleanRing(h, 0.02))).filter(h => h.length >= 3) };
    if (ex.outer.length < 3) return;
    const tz = typeof topZ === 'function' ? topZ : () => topZ;
    let tris;
    const st = step ? steinerPoints(ex, step) : [];
    try { tris = triangulate(ex, st); }
    catch (e) {
      try { tris = triangulate(ex, st.filter((_, i) => i % 2 === 0)); }
      catch (e2) { tris = triangulate(ex, []); }
    }
    const push = (a, b, c) => { out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); };
    const zc = new Map();
    const z = p => { const k = p[0] + ',' + p[1]; let v = zc.get(k); if (v === undefined) { v = tz(p[0], p[1]); zc.set(k, v); } return v; };
    for (const t of tris) {
      let [a, b, c] = t;
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) [b, c] = [c, b];
      push([a[0], a[1], z(a)], [b[0], b[1], z(b)], [c[0], c[1], z(c)]);
    }
    // bottom: flat triangulation, reversed
    let btris = step ? null : tris;
    if (!btris) { try { btris = triangulate(ex, []); } catch (e) { btris = tris; } }
    for (const t of btris) {
      let [a, b, c] = t;
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) [b, c] = [c, b];
      push([a[0], a[1], bottomZ], [b[0], b[1], bottomZ], [c[0], c[1], bottomZ]);
    }
    for (const ring of [ex.outer, ...ex.holes]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const at = [a[0], a[1], z(a)], bt = [b[0], b[1], z(b)], ab = [a[0], a[1], bottomZ], bb = [b[0], b[1], bottomZ];
        push(ab, bb, bt); push(ab, bt, at);
      }
    }
  }

  // body: {outer ccw, holes cw} (holes = through-holes such as the hanging loop); pocket: ccw rings recessed down to floorZ
  function traySolid(body, pocket, topZ, floorZ, out) {
    const push = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const face = (ex, z, up) => {
      for (const t of triangulate(ex, [])) {
        let [a, b, c] = t;
        const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if ((cr < 0) === up) [b, c] = [c, b];
        push([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]);
      }
    };
    const walls = (ring, z0, z1) => {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        push([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1]); push([a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]);
      }
    };
    face(body, 0, false);
    face({ outer: body.outer, holes: [...body.holes, ...pocket.map(r => cw(r))] }, topZ, true);
    for (const r of pocket) face({ outer: r, holes: [] }, floorZ, true);
    walls(body.outer, 0, topZ);
    for (const h of body.holes) walls(h, 0, topZ);
    for (const r of pocket) walls(cw(r), floorZ, topZ);
  }

  // ---------- jigsaw ----------
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function chaikin(pts, it) {
    for (let k = 0; k < it; k++) {
      const o = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
      }
      o.push(pts[pts.length - 1]); pts = o;
    }
    return pts;
  }
  function tabEdge(a, b, dir, r) {
    const j = () => (r() - 0.5) * 0.06;
    const c = 0.5 + j();
    const T = [[0, 0], [c - 0.14, 0], [c - 0.07, 0.02], [c - 0.10, 0.10], [c - 0.16, 0.20], [c - 0.10, 0.30], [c, 0.32 + j() * .5], [c + 0.10, 0.30], [c + 0.16, 0.20], [c + 0.10, 0.10], [c + 0.07, 0.02], [c + 0.14, 0], [1, 0]];
    const s = chaikin(T, 4);
    const dx = b[0] - a[0], dy = b[1] - a[1], nx = -dy * dir, ny = dx * dir;
    return s.map(([u, v]) => [a[0] + dx * u + nx * v, a[1] + dy * u + ny * v]);
  }
  function jigsawCells(W, H, across, seed) {
    const cell = W / across, cols = across, rows = Math.max(1, Math.round(H / cell));
    const ch = H / rows, r = rng(seed);
    const X = i => -W / 2 + i * cell, Y = j => -H / 2 + j * ch;
    const hE = [], vE = [];
    for (let j = 0; j <= rows; j++) { hE[j] = []; for (let i = 0; i < cols; i++) { const a = [X(i), Y(j)], b = [X(i + 1), Y(j)]; hE[j][i] = (j === 0 || j === rows) ? [a, b] : tabEdge(a, b, r() < .5 ? 1 : -1, r); } }
    for (let i = 0; i <= cols; i++) { vE[i] = []; for (let j = 0; j < rows; j++) { const a = [X(i), Y(j)], b = [X(i), Y(j + 1)]; vE[i][j] = (i === 0 || i === cols) ? [a, b] : tabEdge(a, b, r() < .5 ? 1 : -1, r); } }
    const cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const p = [];
      p.push(...hE[j][i].slice(0, -1));
      p.push(...vE[i + 1][j].slice(0, -1));
      p.push(...hE[j + 1][i].slice().reverse().slice(0, -1));
      p.push(...vE[i][j].slice().reverse().slice(0, -1));
      cells.push({ i, j, pts: p });
    }
    return { cells, cellArea: cell * ch, cellW: cell, cellH: ch, cols, rows };
  }

  // ---------- shaped jigsaw (rings for circles, nested hexagons for hexagons) ----------
  let TAB_UNIT = null;
  function tabTemplate() {
    if (!TAB_UNIT) {
      const T = [[0.36, 0], [0.43, 0.02], [0.40, 0.10], [0.34, 0.20], [0.40, 0.30], [0.5, 0.32], [0.60, 0.30], [0.66, 0.20], [0.60, 0.10], [0.57, 0.02], [0.64, 0]];
      TAB_UNIT = chaikin(T, 4);
    }
    return TAB_UNIT;
  }
  // put a tab in the middle of a polyline; s = tab scale in mm, dir = +1/-1 side
  function tabOnPolyline(pts, s, dir, r) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    const at = u => {
      let i = 1; while (i < cum.length - 1 && cum[i] < u) i++;
      const a = pts[i - 1], b = pts[i], seg = (cum[i] - cum[i - 1]) || 1, t = (u - cum[i - 1]) / seg;
      const tx = (b[0] - a[0]) / seg, ty = (b[1] - a[1]) / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, -ty, tx];
    };
    const mid = L / 2 + (r() - 0.5) * 0.08 * L, u0 = mid - 0.14 * s, u1 = mid + 0.14 * s;
    const out = [];
    for (let i = 0; i < pts.length; i++) if (cum[i] < u0) out.push(pts[i]);
    for (const [tu, tv] of tabTemplate()) {
      const p = at(mid + (tu - 0.5) * s);
      out.push([p[0] + p[2] * tv * s * dir, p[1] + p[3] * tv * s * dir]);
    }
    for (let i = 0; i < pts.length; i++) if (cum[i] > u1) out.push(pts[i]);
    return out;
  }
  function radialCells(kind, W, across, seed) {
    const a = W / across, r = rng(seed);
    const isHex = kind === 'hex';
    // C(rho, phi): point on the ring of size rho at perimeter fraction phi (0..1, ccw from +x)
    const V = isHex ? [...Array(7)].map((_, i) => [Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3)]) : null;
    const C = (rho, phi) => {
      phi = ((phi % 1) + 1) % 1;
      if (!isHex) return [rho * Math.cos(phi * 2 * Math.PI), rho * Math.sin(phi * 2 * Math.PI)];
      const f = phi * 6, s = Math.min(5, Math.floor(f)), t = f - s;
      return [rho * (V[s][0] * (1 - t) + V[s + 1][0] * t), rho * (V[s][1] * (1 - t) + V[s + 1][1] * t)];
    };
    const thick = isHex ? a / Math.cos(Math.PI / 6) : a;          // ring thickness along the size axis
    const Rout = W / 2 + 1.5;                                       // beyond the outline; clipping makes the edge
    // a generous centre piece: the landmark usually sits right in the middle, so keep it whole
    const rho1 = Math.max(a * 0.8, Math.min(thick * 1.2, Rout - thick * 0.9));
    const nR = Math.max(1, Math.round((Rout - rho1) / thick));
    const t = (Rout - rho1) / nR;
    const rho = [0, rho1]; for (let k = 1; k <= nR; k++) rho.push(rho1 + k * t);
    const K = rho.length - 1; // rho[K] = Rout
    // segment boundaries per ring k (between rho[k] and rho[k+1]), k = 1..K-1
    const B = [];
    for (let k = 1; k < K; k++) {
      const mid = (rho[k] + rho[k + 1]) / 2;
      let b = [];
      if (isHex) {
        let m = Math.max(1, Math.round(mid / a));
        if (k === 1 && K > 2) m = Math.max(1, Math.min(m, Math.floor(rho1 / (0.9 * a)))); // long centre edges = full-size knobs
        for (let s = 0; s < 6; s++) for (let j = 0; j < m; j++) b.push((s + j / m) / 6);
      } else {
        let m = Math.max(3, Math.round(2 * Math.PI * mid / a)); const off = r();
        if (k === 1 && K > 2) m = Math.max(3, Math.min(m, Math.floor(2 * Math.PI * rho1 / (0.9 * a))));
        for (let j = 0; j < m; j++) b.push(((off + j) / m) % 1);
      }
      B[k] = b.sort((x, y) => x - y);
    }
    // nodes on each ring circle rho[k], k = 1..K-1
    const N = [];
    for (let k = 1; k < K; k++) {
      const s = [...B[k], ...(k > 1 ? B[k - 1] : [])].sort((x, y) => x - y);
      const u = []; for (const v of s) if (!u.length || v - u[u.length - 1] > 1e-6) u.push(v);
      if (u.length > 1 && 1 + u[0] - u[u.length - 1] < 1e-6) u.pop();
      N[k] = u;
    }
    const ringPts = (k, p0, p1) => { // polyline on ring k from phi p0 to p1 (p1 > p0)
      const pts = [], steps = isHex ? null : Math.max(2, Math.ceil((p1 - p0) * 360));
      if (isHex) {
        pts.push(C(rho[k], p0));
        for (let s = Math.floor(p0 * 6 + 1e-9) + 1; s / 6 < p1 - 1e-9; s++) pts.push(C(rho[k], s / 6));
        pts.push(C(rho[k], p1));
      } else for (let i = 0; i <= steps; i++) pts.push(C(rho[k], p0 + (p1 - p0) * i / steps));
      return pts;
    };
    const polyLen = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);
    // ring edges: key k:i  (from N[k][i] to N[k][i+1])
    const ringEdge = new Map();
    for (let k = 1; k < K; k++) {
      const n = N[k];
      for (let i = 0; i < n.length; i++) {
        const p0 = n[i], p1 = i + 1 < n.length ? n[i + 1] : n[0] + 1;
        let pts = ringPts(k, p0, p1);
        const L = polyLen(pts);
        const cap = Math.min(k === 1 ? rho1 * 1.1 : t, t) * 0.95;
        // ring edges run ccw, so dir -1 pushes the knob outward; the centre piece always gets outward knobs
        if (k === 1 ? L > a * 0.3 : L > a * 0.6) pts = tabOnPolyline(pts, Math.min(L * 0.9, cap), k === 1 ? -1 : (r() < 0.5 ? 1 : -1), r);
        ringEdge.set(k + ':' + i, pts);
      }
    }
    const radEdge = new Map(); // ring k, boundary phi: inner -> outer
    for (let k = 1; k < K; k++) for (const p of B[k]) {
      const outer = k + 1 === K;
      const end = outer ? W / 2 : rho[k + 1];               // the outline, for the clipped outer ring
      let pts = [C(rho[k], p), C(end, p)];
      const L = end - rho[k];
      const seg = isHex ? a : 2 * Math.PI * (rho[k] + end) / 2 / B[k].length;
      if (L > a * 0.45) pts = tabOnPolyline(pts, Math.min(L, seg) * 0.8, r() < 0.5 ? 1 : -1, r);
      if (outer) pts.push(C(rho[K] + 2, p));
      radEdge.set(k + ':' + p.toFixed(9), pts);
    }
    const ringPath = (k, p0, p1) => { // ring k from p0 to p1 ccw, through stored edges
      if (k === K) { const pts = ringPts(K, p0, p1 > p0 ? p1 : p1 + 1).map(q => q); return pts.map(([x, y]) => { const l = Math.hypot(x, y) || 1; return [x * (l + 2) / l, y * (l + 2) / l]; }); }
      const n = N[k], out = [];
      let i = n.findIndex(v => Math.abs(v - p0) < 1e-6);
      const target = n.findIndex(v => Math.abs(v - p1) < 1e-6);
      do {
        const e = ringEdge.get(k + ':' + i);
        out.push(...(out.length ? e.slice(1) : e));
        i = (i + 1) % n.length;
      } while (i !== target);
      return out;
    };
    const cells = [];
    // centre
    { const n = N[1], pts = []; for (let i = 0; i < n.length; i++) pts.push(...ringEdge.get('1:' + i).slice(0, -1)); cells.push({ i: 0, j: 0, pts }); }
    for (let k = 1; k < K; k++) {
      const b = B[k];
      for (let j = 0; j < b.length; j++) {
        const pa = b[j], pb = b[(j + 1) % b.length];
        const inner = ringPath(k, pa, pb);
        const outer = ringPath(k + 1, pa, pb).slice().reverse();
        const rb = radEdge.get(k + ':' + pb.toFixed(9)), ra = radEdge.get(k + ':' + pa.toFixed(9)).slice().reverse();
        const pts = [...inner.slice(0, -1), ...rb.slice(0, -1), ...outer.slice(0, -1), ...ra.slice(0, -1)];
        cells.push({ i: j, j: k, pts });
      }
    }
    return { cells, cellArea: a * a, cellW: a, cellH: a, cols: 1, rows: 1 };
  }


  // ---------- Hex Grid: true edge-to-edge regular hex tessellation ----------
  // 'edge' and 'alternating' are regular hex-shaped boards with cropped edge
  // hexes; 'round' and 'square' use ONLY complete regular hexagons.
  // Requested piece count is approximate where complete rings/rows are needed.
  function hexGridCells(W, wanted, layout = 'edge') {
    if (!Number.isFinite(W) || W <= 0) throw new Error('Invalid hex grid width');
    if (!['edge', 'alternating', 'round', 'square'].includes(layout))
      throw new Error('Unknown hex grid layout');
    const target = Math.max(7, Math.min(150, Math.round(Number(wanted) || 19)));
    const root3 = Math.sqrt(3);
    const ring = (x, y, side) => {
      const out = [];
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        out.push([x + side * Math.cos(a), y + side * Math.sin(a)]);
      }
      return out;
    };
    const bounds = paths => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const poly of paths) for (const [x,y] of poly) {
        x0 = Math.min(x0,x); x1 = Math.max(x1,x);
        y0 = Math.min(y0,y); y1 = Math.max(y1,y);
      }
      return { minX:x0,maxX:x1,minY:y0,maxY:y1,width:x1-x0,depth:y1-y0 };
    };
    const total = k => 1 + 3 * k * (k + 1);
    let paths, cells, side;
    if (layout === 'round') {
      let rings = 1;
      for (let r=2; r<=6; r++) if (Math.abs(total(r)-target) < Math.abs(total(rings)-target)) rings=r;
      side = W/(3 * rings + 2);
      cells = [];
      for (let q=-rings;q<=rings;q++) for (let r=-rings;r<=rings;r++) {
        if (Math.abs(q+r)>rings) continue;
        const x = 1.5 * side * q, y = root3 * side * (r + q/2);
        cells.push({i:q,j:r,pts:ring(x,y,side),partial:false});
      }
    } else if (layout === 'square') {
      const cols = Math.max(2,Math.round(Math.sqrt(target)));
      const rows = Math.max(2,Math.round(target / cols));
      const spanX = 1.5 * (cols - 1) + 2, spanY = root3 * (rows + 0.5);
      side = W / Math.max(spanX,spanY);
      cells = [];
      for (let col=0; col<cols;col++) for (let row=0;row<rows;row++) {
        const x = 1.5*side*(col-(cols-1)/2);
        const y = root3*side*(row-(rows-1)/2+(col%2 ? 0.25 : -0.25));
        cells.push({i:col,j:row,pts:ring(x,y,side),partial:false});
      }
    } else {
      const outer = ccw(shapeOutline('hexagon',W));
      const board = [outer], fullArea = s => 1.5 * root3 * s * s;
      const build = s => {
        const result = [];
        const qMax = Math.ceil((W/2 + s)/(1.5*s)) + 1;
        const rMax = Math.ceil(W/(root3*s)) + qMax;
        const shiftX = layout==='alternating' ? s * 0.75 : 0;
        const shiftY = layout==='alternating' ? root3*s * 0.34 : 0;
        for (let q=-qMax;q<=qMax;q++) for (let r=-rMax;r<=rMax;r++) {
          const x = 1.5*s*q+shiftX, y = root3*s*(r+q/2)+shiftY;
          if (Math.abs(x)>W/2+s || Math.abs(y)>W*root3/4+s) continue;
          const intersections = boolOp(CL.ClipType.ctIntersection,[ring(x,y,s)],board);
          for (const shape of intersections) {
            const ar = exArea(shape);
            if (ar <= 1e-5) continue;
            result.push({i:q,j:r,pts:shape.outer,partial:ar < 0.985*fullArea(s)});
          }
        }
        return result;
      };
      side = W/(2*Math.sqrt(target));
      let best = null, score = Infinity;
      for (let k=0;k<7;k++) {
        const candidate = build(side);
        const cost = Math.abs(candidate.length-target);
        if (candidate.length && cost < score) {
          best = {side,cells:candidate};score=cost;
        }
        if (cost===0) break;
        side *= Math.max(0.78,Math.min(1.22,Math.sqrt(Math.max(1,candidate.length)/target)));
      }
      side = best.side; cells = best.cells;
    }
    if (!cells.length) throw new Error('Hex grid produced no printable cells');
    // Whole-hex clusters have a stepped external silhouette. Union the actual
    // tiles rather than clipping them to a hex/square and creating half-pieces.
    const clipped = layout==='edge' || layout==='alternating';
    const outline = clipped ? shapeOutline('hexagon',W)
      : exPolysFrom(cells.map(c=>c.pts)).sort((a,b)=>exArea(b)-exArea(a))[0].outer;
    const bb = bounds(cells.map(c=>c.pts));
    return {cells,outline,clip:clipped,side,cellW:2*side,cellH:root3*side,
      width:bb.width,depth:bb.depth,target,actual:cells.length,layout};
  }

  // ---------- text ----------
  function exPolysEO(paths) { // even-odd: right for any outline direction (TrueType or CFF)
    const c = new CL.Clipper(); c.AddPaths(paths.map(toCL), CL.PolyType.ptSubject, true);
    const tree = new CL.PolyTree(); c.Execute(CL.ClipType.ctUnion, tree, CL.PolyFillType.pftEvenOdd, CL.PolyFillType.pftEvenOdd);
    return polyTreeToExPolys(tree);
  }
  // font: {resolution, capHeight, glyphs:{ch:{ha, c:[[x,y,x,y,...]]}}} in font units, y up
  function glyphRings(font, text, size) {
    const scale = size / font.resolution;
    const res = []; let x = 0;
    for (const ch of text) {
      const g = font.glyphs[ch] || (ch === '·' && font.glyphs['.']) || font.glyphs[ch.normalize('NFD')[0]] || font.glyphs['?'];
      if (!g) { x += size * 0.3; continue; }
      const rings = g.c.map(f => { const r = []; for (let i = 0; i < f.length; i += 2) r.push([f[i] * scale, f[i + 1] * scale]); return r; });
      res.push({ ch, x, exs: rings.length ? exPolysEO(rings) : [], adv: g.ha * scale });
      x += g.ha * scale;
    }
    return { glyphs: res, width: x };
  }
  function placeText(font, text, opts, out) {
    // opts: {mode:'arcBottom'|'arcTop'|'line', radius, y, capH, z0, z1}
    if (!text || !text.trim()) return;
    const size = opts.capH / ((font.capHeight || font.resolution * 0.7) / font.resolution);
    const { glyphs, width } = glyphRings(font, text, size);
    let usedWidth = width, sc = 1;
    if (opts.maxWidth && width > opts.maxWidth) sc = opts.maxWidth / width;
    usedWidth = width * sc;
    for (const g of glyphs) {
      const cx = (g.x + g.adv / 2) * sc - usedWidth / 2; // glyph centre along the line
      for (const ex of g.exs) {
        const tf = pts => pts.map(([u, v]) => {
          const lu = (u - g.adv / 2) * sc, lv = v * sc - opts.capH * sc / 2;
          if (opts.mode === 'line') return [cx + lu, opts.y + lv];
          const R = opts.radius;
          if (opts.mode === 'arcBottom') {
            const a = -Math.PI / 2 + cx / R;
            const t = [-Math.sin(a), Math.cos(a)], n = [-Math.cos(a), -Math.sin(a)];
            return [R * Math.cos(a) + lu * t[0] + lv * n[0], R * Math.sin(a) + lu * t[1] + lv * n[1]];
          }
          const a = Math.PI / 2 - cx / R;
          const t = [Math.sin(a), -Math.cos(a)], n = [Math.cos(a), Math.sin(a)];
          return [R * Math.cos(a) + lu * t[0] + lv * n[0], R * Math.sin(a) + lu * t[1] + lv * n[1]];
        });
        for (const e of exPolysFrom([tf(ex.outer), ...ex.holes.map(tf)])) solid(e, opts.z1, opts.z0, 0, out);
      }
    }
  }

  // ---------- model ----------
  // p: {shape, widthMm, product:'ornament'|'puzzle', exag, baseMm, frameMm, rimMm, textTop, textBottom, pieces, gapMm, loop, stepMm, seed}
  // hf: {heights Float32Array, N, sizeKm}
  function buildModel(p, hf, font) {
    const W = p.widthMm, N = hf.N, sizeKm = hf.sizeKm;
    const hex = p.shape === 'hexgrid' && p.product === 'puzzle'
      ? hexGridCells(W, p.pieces, p.hexLayout || 'edge') : null;
    const outline = hex ? hex.outline : shapeOutline(p.shape, W);
    const H = hex ? hex.depth : p.shape === 'hexagon' ? W * Math.sqrt(3) / 2 : W;
    const mmPerM = W / (sizeKm * 1000);
    // reference height = lowest point inside outline
    let hMin = Infinity, hMax = -Infinity;
    const gx = j => -W / 2 + j * W / (N - 1), gy = i => W / 2 - i * W / (N - 1);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (!pointInRing(gx(j), gy(i), outline) && distToRing(gx(j), gy(i), outline) > W / (N - 1) * 1.5) continue;
      const h = hf.heights[i * N + j]; if (h < hMin) hMin = h; if (h > hMax) hMax = h;
    }
    const base = p.baseMm, k = mmPerM * p.exag;
    const backed = p.back && (p.border || 'lettered') !== 'none';
    const floorZ = backed ? p.backMm : 0;
    const topZ = (x, y) => {
      const fj = (x + W / 2) / W * (N - 1), fi = (W / 2 - y) / W * (N - 1);
      const j0 = Math.max(0, Math.min(N - 2, Math.floor(fj))), i0 = Math.max(0, Math.min(N - 2, Math.floor(fi)));
      const tx = Math.max(0, Math.min(1, fj - j0)), ty = Math.max(0, Math.min(1, fi - i0));
      const A = hf.heights;
      const h = (A[i0 * N + j0] * (1 - tx) + A[i0 * N + j0 + 1] * tx) * (1 - ty) + (A[(i0 + 1) * N + j0] * (1 - tx) + A[(i0 + 1) * N + j0 + 1] * tx) * ty;
      return floorZ + base + Math.max(0, h - hMin) * k;
    };
    const step = p.stepMm;
    const parts = [];
    let grid = null;
    const reliefMm = (hMax - hMin) * k;
    // rim height above the base: exactly as set, or (optional) raised to about half the printed relief
    const frameTop = floorZ + base + (p.rimAuto ? Math.max(p.rimMm, Math.min(reliefMm * 0.55, 14)) : p.rimMm);
    const join = p.shape === 'circle' ? 'round' : 'miter';
    const outlineD = densify(outline, Math.max(0.6, step * 1.5));

    // terrain
    const terrain = [];
    if (p.product === 'puzzle') {
      const inner = offset([outline], -p.gapMm / 2, join);
      const jc = hex || (p.shape === 'square' ? jigsawCells(W, H, p.pieces, p.seed) :
        radialCells(p.shape === 'circle' ? 'circle' : 'hex', W, p.pieces, p.seed));
      const { cells, cellArea } = hex ? {cells:hex.cells,cellArea:1.5*Math.sqrt(3)*hex.side**2} : jc;
      grid = jc;
      let pieces = [];
      if (!hex) for (const c of cells)
        for (const e of boolOp(CL.ClipType.ctIntersection, [c.pts], inner))
          pieces.push({ ex: e, a: exArea(e), cell: c });
      // merge slivers into a neighbour
      if (hex) {
        // Keep complete-hex clusters complete; shrink each tile independently.
        // Clipped layouts use the same -gap/2 outer inset as existing jigsaws.
        pieces = [];
        const edgeInset = hex.clip ? offset([outline],-p.gapMm/2,'miter') : null;
        for (const c of cells) {
          const shapes = hex.clip
            ? boolOp(CL.ClipType.ctIntersection,[c.pts],edgeInset)
            : [{outer:c.pts,holes:[]}];
          for (const ex of shapes) {
            const shr = exPolysFrom(offset([ex.outer,...ex.holes],-p.gapMm/2,'miter'));
            for (const s of shr) {
              const ring = densify(s.outer,Math.max(0.6,step*1.5));
              const tris=[];
              const flat = hex.clip && c.partial && p.hexEdge === 'flat';
              solid({outer:ring,holes:s.holes},flat ? floorZ+base : topZ,floorZ,step,tris);
              if (tris.length) parts.push({name:(c.partial?'Edge hex ':'Hex ')+(parts.length+1),
                role:'terrain',tris:new Float32Array(tris),cell:[c.i,c.j],ring:s.outer,
                partial:c.partial,flat});
            }
          }
        }
      } else {
      pieces.sort((a, b) => a.a - b.a);
      const big = pieces.filter(q => q.a >= cellArea * 0.35), small = pieces.filter(q => q.a < cellArea * 0.35);
      for (const s of small) {
        let best = null, bestA = 0;
        for (const b of big) {
          const ov = boolOp(CL.ClipType.ctIntersection, offset([s.ex.outer], 0.05, 'round'), [b.ex.outer]);
          const a = ov.reduce((t, e) => t + exArea(e), 0);
          if (a > bestA) { bestA = a; best = b; }
        }
        if (best) { const u = boolOp(CL.ClipType.ctUnion, [best.ex.outer, ...best.ex.holes], [s.ex.outer]); u.sort((x, y) => exArea(y) - exArea(x)); best.ex = u[0]; best.a = exArea(u[0]); }
        else big.push(s);
      }
      // a tip cut off by a socket (neck thinner than the clearance) goes to the neighbour it touches
      const neck = p.gapMm / 2 + 0.05;
      for (const q of big) {
        const op = exPolysFrom(offset(offset([q.ex.outer, ...q.ex.holes], -neck, 'round'), neck, 'round'));
        if (op.length < 2) continue;
        op.sort((x, y) => exArea(y) - exArea(x));
        for (const frag of op.slice(1)) {
          const grown = offset([frag.outer], neck + 0.1, 'round');
          const own = boolOp(CL.ClipType.ctIntersection, [q.ex.outer, ...q.ex.holes], grown);
          if (!own.length) continue;
          let best = null, bestA = 0;
          for (const o of big) {
            if (o === q) continue;
            const ov = boolOp(CL.ClipType.ctIntersection, offset(own.map(e => e.outer), 0.2, 'round'), [o.ex.outer]);
            const ar = ov.reduce((t, e) => t + exArea(e), 0);
            if (ar > bestA) { bestA = ar; best = o; }
          }
          if (!best) continue;
          const rest = boolOp(CL.ClipType.ctDifference, [q.ex.outer, ...q.ex.holes], own.flatMap(e => [e.outer, ...e.holes]));
          rest.sort((x, y) => exArea(y) - exArea(x)); if (rest.length) q.ex = rest[0];
          const u = boolOp(CL.ClipType.ctUnion, [best.ex.outer, ...best.ex.holes], own.flatMap(e => [e.outer, ...e.holes]));
          u.sort((x, y) => exArea(y) - exArea(x)); best.ex = u[0];
        }
      }
      let n = 0;
      for (const q of big) {
        const shr = exPolysFrom(offset([q.ex.outer, ...q.ex.holes], -p.gapMm / 2, 'round'));
        shr.sort((x, y) => exArea(y) - exArea(x));
        if (!shr.length) continue;
        let tris = [], ring = shr[0].outer;
        try { solid({ outer: densify(shr[0].outer, Math.max(0.6, step * 1.5)), holes: shr[0].holes }, topZ, floorZ, step, tris); }
        catch (e) {
          // a pinch where two tabs nearly touch: open the outline slightly and retry
          const fix = exPolysFrom(offset(offset([shr[0].outer, ...shr[0].holes], -0.15, 'round'), 0.15, 'round'));
          fix.sort((x, y) => exArea(y) - exArea(x)); tris = []; ring = fix[0].outer;
          solid({ outer: densify(fix[0].outer, Math.max(0.6, step * 1.5)), holes: fix[0].holes }, topZ, floorZ, step, tris);
        }
        parts.push({ name: `Piece ${++n}`, role: 'terrain', tris: new Float32Array(tris), cell: [q.cell.i, q.cell.j], ring });
      }
      }
    } else {
      const tOut = p.separate ? densify(offset([outline], -p.gapMm / 2, join)[0], Math.max(0.6, step * 1.5)) : outlineD;
      solid({ outer: tOut, holes: [] }, topZ, floorZ, step, terrain);
      parts.push({ name: 'Terrain', role: 'terrain', tris: new Float32Array(terrain) });
    }

    // frame
    const border = p.border || 'lettered';
    const fW = p.frameMm;
    if (border !== 'none') {
    const frameInner = (p.product === 'puzzle' || p.separate) ? offset([outline], p.gapMm / 2, join) : [outline];
    const pocketRings = frameInner.slice();
    let frameOuter = offset([outline], p.frameMm, join);
    if (p.loop) {
      const top = p.shape === 'hexagon' ? H / 2 : W / 2;
      const cy = top + fW + 3.2, ring = [];
      for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; ring.push([Math.cos(a) * 5, cy + Math.sin(a) * 5]); }
      const neck = [[-4, top + fW * 0.5], [4, top + fW * 0.5], [4, cy], [-4, cy]];
      const u = boolOp(CL.ClipType.ctUnion, frameOuter, [ring, neck]);
      frameOuter = u.map(e => e.outer);
      const hole = []; for (let i = 0; i < 48; i++) { const a = -i / 48 * Math.PI * 2; hole.push([Math.cos(a) * 2.2, cy + Math.sin(a) * 2.2]); }
      frameInner.push(hole);
    }
    const ft = [];
    if (backed) {
      // a tray: full-thickness floor under the pocket, rim around it
      const loopHoles = frameInner.slice(pocketRings.length);
      const body = boolOp(CL.ClipType.ctDifference, frameOuter, loopHoles);
      const pocket = pocketRings.map(r => ccw(cleanRing(densify(r, 1.2), 0.02)));
      for (const e of body) traySolid({ outer: ccw(cleanRing(densify(e.outer, 1.2), 0.02)), holes: e.holes.map(h => cw(cleanRing(densify(h, 1.2), 0.02))) }, pocket, frameTop, floorZ, ft);
    } else {
      const frameEx = boolOp(CL.ClipType.ctDifference, frameOuter, frameInner);
      for (const e of frameEx) solid({ outer: densify(e.outer, 1.2), holes: e.holes.map(h => densify(h, 1.2)) }, frameTop, 0, 0, ft);
    }
    parts.push({ name: 'Frame', role: 'frame', tris: new Float32Array(ft) });
    }

    // text
    if (border === 'lettered' && font && (p.textTop || p.textBottom)) {
      const tt = [], capH = Math.min(fW * 0.56, 5.5), z0 = frameTop - 0.2, z1 = frameTop + p.textMm;
      if (p.shape === 'circle') {
        const R = W / 2 + fW / 2, maxW = Math.PI * R * 0.8;
        placeText(font, p.textBottom, { mode: 'arcBottom', radius: R, capH, z0, z1, maxWidth: maxW }, tt);
        if (!p.loop) placeText(font, p.textTop, { mode: 'arcTop', radius: R, capH, z0, z1, maxWidth: maxW }, tt);
      } else {
        const yb = -(H / 2 + fW / 2), edge = p.shape === 'hexagon' ? W / 2 : W;
        placeText(font, p.textBottom, { mode: 'line', y: yb, capH, z0, z1, maxWidth: edge * 0.92 }, tt);
        if (!p.loop) placeText(font, p.textTop, { mode: 'line', y: -yb, capH, z0, z1, maxWidth: edge * 0.92 }, tt);
      }
      if (tt.length) {
        const fr = parts.find(x => x.role === 'frame');
        if (p.mergeText && fr) {
          const m = new Float32Array(fr.tris.length + tt.length); m.set(fr.tris); m.set(tt, fr.tris.length);
          fr.tris = m; fr.name = 'Frame with lettering';
        } else parts.push({ name: 'Lettering', role: 'text', tris: new Float32Array(tt) });
      }
    }
    return { parts, hMin, hMax, reliefMm, mmPerM, frameTop, grid, floorZ,
      widthMm:hex ? hex.width : W, depthMm:H, actualPieces:hex ? parts.filter(o=>o.cell).length : null };
  }

  // Move puzzle pieces apart so every tab clears its socket. Returns new parts and the layout size.
  function spreadPieces(parts, grid, gapMm, dropZ = 0) {
    // shelf-pack the pieces by bounding box so no two can touch
    const items = [];
    for (const p of parts) {
      if (!p.cell) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < p.tris.length; i += 3) { const x = p.tris[i], y = p.tris[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      items.push({ p, x0, y0, w: x1 - x0, h: y1 - y0 });
    }
    const area = items.reduce((s, it) => s + (it.w + gapMm) * (it.h + gapMm), 0);
    const maxW = Math.max(Math.sqrt(area) * 1.15, ...items.map(it => it.w + gapMm));
    items.sort((a, b) => b.h - a.h);
    let x = 0, y = 0, rowH = 0;
    for (const it of items) {
      if (x > 0 && x + it.w > maxW) { x = 0; y += rowH + gapMm; rowH = 0; }
      it.nx = x; it.ny = y; x += it.w + gapMm; rowH = Math.max(rowH, it.h);
    }
    const totW = Math.max(...items.map(it => it.nx + it.w)), totH = y + rowH;
    const out = items.map(it => {
      const dx = it.nx - totW / 2 - it.x0, dy = -(it.ny - totH / 2) - it.h - it.y0, t = new Float32Array(it.p.tris.length);
      for (let i = 0; i < t.length; i += 3) { t[i] = it.p.tris[i] + dx; t[i + 1] = it.p.tris[i + 1] + dy; t[i + 2] = it.p.tris[i + 2] - dropZ; }
      return { ...it.p, tris: t };
    });
    return { parts: out, width: totW, depth: totH, minX: -totW / 2, maxX: totW / 2 };
  }


  // Safe preview-only placement for puzzle pieces and optional frame/lettering.
  // In particular, puzzles with "no frame" must not derive offsets from
  // Infinity/-Infinity. This layout is NOT used to alter exported geometry.
  function spreadPreview(parts, grid, gapMm, floorZ = 0) {
    const sp = spreadPieces(parts, grid, gapMm, floorZ);
    const rest = parts.filter(p => !p.cell && p.tris.length >= 3);
    const bounds = part => {
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < part.tris.length; k += 3) {
        const x = part.tris[k];
        if (!Number.isFinite(x)) throw new Error('Invalid puzzle vertex');
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
      return { lo, hi };
    };
    const movable = ps => ps.map(p => ({ ...p, tris: new Float32Array(p.tris) }));
    const move = (ps, dx) => movable(ps).map(p => {
      for (let i = 0; i < p.tris.length; i += 3) p.tris[i] += dx;
      return p;
    });
    if (!rest.length) return sp.parts; // Frame-less puzzle already centered.
    const b = rest.map(bounds);
    const fMin = Math.min(...b.map(o => o.lo)), fMax = Math.max(...b.map(o => o.hi));
    if (!Number.isFinite(fMin) || !Number.isFinite(fMax))
      throw new Error('Unable to determine puzzle frame bounds');
    const gap = Math.max(0, gapMm);
    const shift = sp.maxX + gap + 12 - fMin;
    // Recenter full layout, not merely the left-hand spread tray.
    const farRight = fMax + shift;
    const cx = (sp.minX + farRight) / 2;
    return [...move(sp.parts, -cx), ...move(rest, shift - cx)];
  }

  // ---------- writers ----------
  function stl(parts) {
    let n = 0; for (const p of parts) n += p.tris.length / 9;
    const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
    const hdr = 'Terrain Press binary STL'; for (let i = 0; i < hdr.length; i++) dv.setUint8(i, hdr.charCodeAt(i));
    dv.setUint32(80, n, true);
    let o = 84;
    for (const p of parts) {
      const t = p.tris;
      for (let i = 0; i < t.length; i += 9) {
        const ux = t[i + 3] - t[i], uy = t[i + 4] - t[i + 1], uz = t[i + 5] - t[i + 2];
        const vx = t[i + 6] - t[i], vy = t[i + 7] - t[i + 1], vz = t[i + 8] - t[i + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const L = Math.hypot(nx, ny, nz) || 1;
        dv.setFloat32(o, nx / L, true); dv.setFloat32(o + 4, ny / L, true); dv.setFloat32(o + 8, nz / L, true);
        for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, t[i + k], true);
        o += 50;
      }
    }
    return new Uint8Array(buf);
  }
  function weld(tris) {
    const map = new Map(), verts = [], idx = new Uint32Array(tris.length / 3);
    for (let i = 0; i < tris.length; i += 3) {
      const k = Math.round(tris[i] * 1e4) + ',' + Math.round(tris[i + 1] * 1e4) + ',' + Math.round(tris[i + 2] * 1e4);
      let v = map.get(k);
      if (v === undefined) { v = verts.length / 3; map.set(k, v); verts.push(tris[i], tris[i + 1], tris[i + 2]); }
      idx[i / 3] = v;
    }
    return { verts, idx };
  }
  function model3mf(parts, colors, title) {
    const mats = [...new Set(parts.map(p => p.role))];
    let objs = '', comps = '', id = 2;
    for (const p of parts) {
      const { verts, idx } = weld(p.tris);
      const v = []; for (let i = 0; i < verts.length; i += 3) v.push(`<vertex x="${verts[i].toFixed(4)}" y="${verts[i + 1].toFixed(4)}" z="${verts[i + 2].toFixed(4)}"/>`);
      const t = []; for (let i = 0; i < idx.length; i += 3) { if (idx[i] === idx[i + 1] || idx[i + 1] === idx[i + 2] || idx[i] === idx[i + 2]) continue; t.push(`<triangle v1="${idx[i]}" v2="${idx[i + 1]}" v3="${idx[i + 2]}"/>`); }
      objs += `<object id="${id}" name="${esc(p.name)}" type="model" pid="1" pindex="${mats.indexOf(p.role)}"><mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh></object>`;
      comps += `<component objectid="${id}"/>`; id++;
    }
    const bm = mats.map(m => `<base name="${m}" displaycolor="${colors[m] || '#888888'}"/>`).join('');
    const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${esc(title)}</metadata><metadata name="Application">Terrain Press</metadata><resources><basematerials id="1">${bm}</basematerials>${objs}<object id="${id}" name="${esc(title)}" type="model"><components>${comps}</components></object></resources><build><item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 128 128 0"/></build></model>`;
    const ct = `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
    return [['[Content_Types].xml', ct], ['_rels/.rels', rels], ['3D/3dmodel.model', model]];
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  // entries: [[name, Uint8Array|string]]; deflate: async (u8)=>u8 | null
  async function zip(entries, deflate) {
    const enc = new TextEncoder(), chunks = [], central = [];
    let offset = 0;
    for (const [name, d] of entries) {
      const data = typeof d === 'string' ? enc.encode(d) : d;
      const crc = crc32(data);
      let comp = data, method = 0;
      if (deflate) { try { const c = await deflate(data); if (c.length < data.length) { comp = c; method = 8; } } catch (e) { } }
      const nm = enc.encode(name);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nm, comp);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nm);
      offset += 30 + nm.length + comp.length;
    }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = [...chunks, ...central, new Uint8Array(end.buffer)];
    const total = all.reduce((s, c) => s + c.length, 0), out = new Uint8Array(total);
    let o = 0; for (const c of all) { out.set(c, o); o += c.length; }
    return out;
  }

  root.TPCore = { makeStore, meshPlan, buildModel, hexGridCells, spreadPieces, spreadPreview, stl, model3mf, zip, weld, shapeOutline };
})(typeof self !== 'undefined' ? self : globalThis);
