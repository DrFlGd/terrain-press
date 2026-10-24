// Terrain Press core: elevation sampling, solids, jigsaw cuts, lettering, STL/3MF/ZIP writers.
// Runs in a worker (or the page as a fallback). Needs poly2tri and ClipperLib.
(function (root) {
  const P2T = root.poly2tri, CL = root.ClipperLib;
  const SCALE = 1000; // clipper units per mm
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
      const covers = (p,lat,lon) => !p.regional || (p.coverage || []).some(r => lat > r.south && lat <= r.north && lon >= r.west && lon < r.east);
      const skipped = Array.isArray(ignoreInstalled) ? ignoreInstalled : [];
      const packs = (ignoreInstalled === true ? [] : m.installedPacks || []).filter(p =>
        p && Number.isInteger(p.w) && Number.isInteger(p.h) && Number.isInteger(p.tile) &&
        p.w > m.w && p.h > 0 && p.tile > 0 && /^[a-z][a-z0-9-]{1,63}$/.test(p.id) &&
        !skipped.includes(p.id) && (!p.regional || g.lats.some((lat,k) => covers(p,lat,g.lons[k])))
      ).sort((a, b) => b.w - a.w);
      if (packs.length) {
        // Native pixel size is NOT the same as effective measured detail.
        // Venus stereo is gridded at ~600 m, but resolves about 1-2 km.
        const p = packs[0], pxKm = Math.max(2 * Math.PI * R / p.w,
          Number.isFinite(p.effectivePxKm) ? p.effectivePxKm : 0);
        if (!candidatePatch || pxKm < candidatePatch.pxKm) {
          const set = new Set();
          for (let k = 0; k < g.lats.length; k++) {
            if (!covers(p,g.lats[k],g.lons[k])) continue;
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
          return { kind: 'pack', id: p.id, regional: !!p.regional, grid: g, w: p.w, h: p.h,
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
          if (!pixels && src.regional) return NaN;
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
      // Coverage percentage must be counted BEFORE masked cells are replaced
      // by the built-in DEM; otherwise partial Venus would look 100% observed.
      const sourceValidFraction = src.kind === 'pack'
        ? out.reduce((count,v) => count + (Number.isFinite(v) ? 1 : 0),0)/out.length
        : null;
      // Some published DTMs have shadows/NoData. Preserve measured heights,
      // substituting built-in terrain only at genuinely missing pixels.
      if (ignoreInstalled !== true && src.kind === 'pack' && out.some(v => !Number.isFinite(v))) {
        const skipped = Array.isArray(ignoreInstalled) ? ignoreInstalled : [];
        const fallback = await sample(body, lat0, lon0, sizeKm, N, null, [...skipped, src.id]);
        if (body === 'earth') src.label += ' + fallback: ' + fallback.source.label;
        for (let k = 0; k < out.length; k++)
          if (!Number.isFinite(out[k])) out[k] = fallback.heights[k];
      }
      return { heights: out, N, source: src.kind === 'pack'
        ? { ...src, validFraction: sourceValidFraction } : src };
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
      // Exact mirror-symmetric vertices. Math.sin(PI/3) and Math.sin(2*PI/3)
      // differ by one ulp, which made the flat edges very slightly sloped; the
      // densified edge points then carried 1-ulp y noise and poly2tri rejected
      // the ring with "EdgeEvent: Collinear not supported!".
      const h = W / 2 * Math.sqrt(3) / 2;
      pts.push([W / 2, 0], [W / 4, h], [-W / 4, h], [-W / 2, 0], [-W / 4, -h], [W / 4, -h]);
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
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L = Math.hypot(dx, dy), n = Math.ceil(L / maxLen);
      // Axis-aligned edges keep their shared coordinate bit-exact so every
      // inserted point is truly collinear with the edge.
      for (let k = 1; k < n; k++) out.push([dx ? a[0] + dx * k / n : a[0], dy ? a[1] + dy * k / n : a[1]]);
    }
    return out;
  }
  function cleanRing(pts, minD, preserveCollinear = false) {
    const out = [];
    for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > minD) out.push(p); }
    while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= minD) out.pop();
    // A sampled terrain perimeter MUST retain its intermediate collinear XY
    // vertices: their Z values follow the DEM. Removing them replaces the
    // terrain edge with a chord between two heights, producing unsupported
    // triangular "curtain" walls and disconnected top/sidewall vertices.
    if (preserveCollinear) return out;
    // For constant-height polygon faces the traditional simplification remains
    // useful to avoid unnecessary triangulation of straight segments.
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
    const sampledBoundary = typeof topZ === 'function' && step > 0;
    ex = { outer: ccw(cleanRing(ex.outer, 0.02, sampledBoundary)),
      holes: ex.holes.map(h => cw(cleanRing(h, 0.02, sampledBoundary)))
        .filter(h => h.length >= 3) };
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

  // Clip color cells against the normal ornament/puzzle outline. Shared edges
  // emit only exposed step walls, never overlapping internal solids.
  function colorSolid(ex, panel, W, base, band, bottom, out, flat = false) {
    const n = panel.width, cell = W / n, edges = new Map();
    const coord = v => Math.round(v * SCALE) / SCALE;
    const levels = [bottom, ...panel.palette.map((_, k) => bottom + base + k * band)];
    const push = (a,b,c,z) => out.push(a[0],a[1],z,b[0],b[1],z,c[0],c[1],z);
    const xs=ex.outer.map(v=>v[0]), ys=ex.outer.map(v=>v[1]);
    const x0=Math.max(0,Math.floor((Math.min(...xs)+W/2)/cell));
    const x1=Math.min(n-1,Math.floor((Math.max(...xs)+W/2)/cell));
    const y0=Math.max(0,Math.floor((W/2-Math.max(...ys))/cell));
    const y1=Math.min(n-1,Math.floor((W/2-Math.min(...ys))/cell));
    // For convex outlines, only boundary cells need polygon clipping.
    const convex = !ex.holes.length && ex.outer.every((a,i)=>{
      const b=ex.outer[(i+1)%ex.outer.length],c=ex.outer[(i+2)%ex.outer.length];
      return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=0;
    });
    const spans=new Map();
    if(convex)for(let y=y0;y<=y1;y++) {
      const t=coord(W/2-y*cell),b=coord(W/2-(y+1)*cell);
      let lo=-Infinity,hi=Infinity;
      for(let i=0;i<ex.outer.length;i++) {
        const a=ex.outer[i],v=ex.outer[(i+1)%ex.outer.length],dx=v[0]-a[0],dy=v[1]-a[1],yy=dx>=0?b:t;
        if(Math.abs(dy)<1e-12){if(dx*(yy-a[1])<0){lo=Infinity;hi=-Infinity;break;}}
        else {const xx=a[0]+dx*(yy-a[1])/dy;if(dy>0)hi=Math.min(hi,xx);else lo=Math.max(lo,xx);}
      }
      spans.set(y,[lo,hi]);
    }
    // Pass 1 clips every boundary cell and notes where ring vertices land on the
    // grid lines. Clipper drops collinear vertices per cell, so where a puzzle
    // outline runs along or grazes a cell boundary the two neighbours describe the
    // shared edge with different vertices. Pass 2 splits both sides at the same
    // points, keeping faces and walls edge-matched instead of leaving T-junctions.
    const clipped=new Map(), vert=new Map(), horiz=new Map(), vstops=new Map(), hstops=new Map(), stride=n+2;
    const bounds=(x,y)=>({l:coord(-W/2+x*cell),r:coord(-W/2+(x+1)*cell),top:coord(W/2-y*cell),bot:coord(W/2-(y+1)*cell)});
    const isFull=(bd,y)=>{const span=spans.get(y);return !!span&&bd.l>span[0]+1/SCALE&&bd.r<span[1]-1/SCALE;};
    // A ring edge a→b on this cell's boundary: the unit grid edge it lies on, its
    // extent, and whether the solid (always left of a→b) really lies in this cell. A
    // boundary edge whose solid would lie outside the cell is a zero-width pinch.
    const onGrid=(a,b,x,y,bd)=>{
      if(a[0]===b[0]&&(a[0]===bd.l||a[0]===bd.r)){const right=a[0]===bd.r;return {map:vert,stops:vstops,key:(right?x+1:x)*stride+y,lo:Math.min(a[1],b[1]),hi:Math.max(a[1],b[1]),from:bd.bot,to:bd.top,near:right,solid:(b[1]>a[1])===right,axis:1};}
      if(a[1]===b[1]&&(a[1]===bd.top||a[1]===bd.bot)){const bottom=a[1]===bd.bot;return {map:horiz,stops:hstops,key:(bottom?y+1:y)*stride+x,lo:Math.min(a[0],b[0]),hi:Math.max(a[0],b[0]),from:bd.l,to:bd.r,near:bottom,solid:(b[0]>a[0])===bottom,axis:0};}
      return null;
    };
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) {
      const bd=bounds(x,y);if(isFull(bd,y))continue;
      const regions=boolOp(CL.ClipType.ctIntersection,[ex.outer,...ex.holes],[[[bd.l,bd.bot],[bd.r,bd.bot],[bd.r,bd.top],[bd.l,bd.top]]]);
      clipped.set(y*n+x,regions);
      // Every vertex on a boundary becomes a stop, including a lone touch point:
      // the strictly simple split below ends an edge there as well.
      const stop=(stops,key,v)=>{let set=stops.get(key);if(!set)stops.set(key,set=new Set());set.add(v);};
      for(const region of regions)for(const ring of [region.outer,...region.holes])for(const v of ring) {
        if(v[1]>bd.bot&&v[1]<bd.top){if(v[0]===bd.l)stop(vstops,x*stride+y,v[1]);else if(v[0]===bd.r)stop(vstops,(x+1)*stride+y,v[1]);}
        if(v[0]>bd.l&&v[0]<bd.r){if(v[1]===bd.top)stop(hstops,y*stride+x,v[0]);else if(v[1]===bd.bot)stop(hstops,(y+1)*stride+x,v[0]);}
      }
    }
    // Walls along cell boundaries are settled per unit grid edge from the claims of
    // the two cells sharing it, by a one-dimensional sweep; buckets are keyed
    // numerically and resolved as soon as both neighbours are done.
    const claim=(map,key,lo,hi,k,near)=>{const list=map.get(key);if(list)list.push([lo,hi,k,near]);else map.set(key,[[lo,hi,k,near]]);};
    for(let y=y0;y<=y1;y++) {
      for(let x=x0;x<=x1;x++) {
        const bd=bounds(x,y),k=flat?1:panel.labels[y*n+x]+1;
        const rect=[[bd.l,bd.bot],[bd.r,bd.bot],[bd.r,bd.top],[bd.l,bd.top]];
        for(const region of clipped.get(y*n+x)||[{outer:rect,holes:[]}]) {
          const split={outer:withStops(region.outer,x,y,bd),holes:region.holes.map(h=>withStops(h,x,y,bd))};
          const faces=region.outer===rect&&split.outer.length===4?[{region:split,tris:[[rect[0],rect[1],rect[2]],[rect[0],rect[2],rect[3]]]}]:cellFaces(split);
          for(const {region,tris} of faces) {
            for(const tri of tris) {
              let [a,b,c]=tri;if(area(tri)<0)[b,c]=[c,b];
              push(a,b,c,levels[k]);push(c,b,a,bottom);
            }
            for(const ring of [region.outer,...region.holes])for(let i=0;i<ring.length;i++) {
              const a=ring[i],b=ring[(i+1)%ring.length],g=onGrid(a,b,x,y,bd);
              if(!g)walls(a,b,k,0);else if(g.solid)claim(g.map,g.key,g.lo,g.hi,k,g.near);
            }
          }
        }
        settle(vert,x*stride+y,true);
      }
      for(let x=x0;x<=x1;x++)settle(horiz,y*stride+x,false);
    }
    for(const key of [...vert.keys()])settle(vert,key,true);
    for(const key of [...horiz.keys()])settle(horiz,key,false);
    // Insert the neighbours' vertices into this ring's edges along the grid lines.
    function withStops(ring,x,y,bd) {
      const out=[];
      for(let i=0;i<ring.length;i++) {
        const a=ring[i],b=ring[(i+1)%ring.length];out.push(a);
        const g=onGrid(a,b,x,y,bd),set=g&&g.stops.get(g.key);if(!set)continue;
        const inside=[...set].filter(v=>v>g.lo&&v<g.hi).sort((p,q)=>b[g.axis]>a[g.axis]?p-q:q-p);
        for(const v of inside)out.push(g.axis?[a[0],v]:[v,a[1]]);
      }
      return out;
    }
    // Clipper can return a ring that touches itself where the outline grazes a cell
    // boundary; poly2tri rejects a vertex lying on another edge. Split such rings
    // into strictly simple polygons (keeping the inserted collinear vertices), retry,
    // and only then drop a sliver far below printable size: its neighbours' edges
    // simply become exposed walls.
    function cellFaces(region) {
      try { return [{region,tris:triangulate(region,[])}]; }
      catch (e) {
        const c=new CL.Clipper(CL.Clipper.ioStrictlySimple|CL.Clipper.ioPreserveCollinear);
        c.AddPaths([region.outer,...region.holes].map(toCL),CL.PolyType.ptSubject,true);
        const tree=new CL.PolyTree();c.Execute(CL.ClipType.ctUnion,tree,CL.PolyFillType.pftNonZero,CL.PolyFillType.pftNonZero);
        return polyTreeToExPolys(tree).filter(simple=>simple.outer.length>=3).flatMap(simple=>{
          try { return [{region:simple,tris:triangulate(simple,[])}]; }
          catch (e2) { if(Math.abs(exArea(simple))<1e-3)return []; throw e2; }
        });
      }
    }
    // Emit the step walls on one unit edge. `near` marks claims from the cell west of
    // a vertical edge or north of a horizontal one; where the two sides differ, the
    // wall faces away from the taller side.
    function settle(map,key,vertical) {
      const claims=map.get(key);if(!claims)return;map.delete(key);
      const index=Math.floor(key/stride),fixed=vertical?coord(-W/2+index*cell):coord(W/2-index*cell);
      const stops=[...new Set([...claims.flatMap(c=>[c[0],c[1]]),...((vertical?vstops:hstops).get(key)||[])])].sort((p,q)=>p-q);
      for(let i=0;i+1<stops.length;i++) {
        const p=stops[i],q=stops[i+1];let kNear=0,kFar=0;
        for(const [lo,hi,k,near] of claims)if(lo<=p&&hi>=q){if(near)kNear=Math.max(kNear,k);else kFar=Math.max(kFar,k);}
        if(kNear===kFar)continue;
        // The taller side must sit on the left of a→b: a taller west side travels up
        // (p→q on a vertical edge), a taller north side travels east (p→q).
        const [s,e]=kNear>kFar?[p,q]:[q,p];
        if(vertical)walls([fixed,s],[fixed,e],Math.max(kNear,kFar),Math.min(kNear,kFar));
        else walls([s,fixed],[e,fixed],Math.max(kNear,kFar),Math.min(kNear,kFar));
      }
    }
    function walls(a,b,high,low) {
      for(let k=low;k<high;k++) {
        out.push(a[0],a[1],levels[k],b[0],b[1],levels[k],b[0],b[1],levels[k+1],a[0],a[1],levels[k],b[0],b[1],levels[k+1],a[0],a[1],levels[k+1]);
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
  // put a tab near the middle of a polyline; s = tab scale in mm, dir = +1/-1 side.
  // ang0 / ang1: the sharpest corner angle (degrees) a piece has at that end of the edge. Near a sharp corner the
  // knob is moved away and, if needed, made smaller, so the tip stays at least MIN_WALL thick even with a
  // socket on the neighbouring edge as well.
  const MIN_WALL = 2.8;
  // room a socket needs from a tip of angle A: between this socket and the other edge there must be the wall plus a
  // possible socket from that edge; a point x along this edge is x * sin(A) from the other edge.
  // (0.42 q covers the round bulb plus the printing clearance; the other edge's knob can be a little larger too)
  const tipRoom = (q, A, L) => A < 88 ? (MIN_WALL + 0.3 + 0.42 * q) / Math.sin(A * Math.PI / 180) : 0.05 * L;
  // how much spare length a socket of scale q has on an edge of length L whose socket piece has these end angles
  const tabSlack = (L, q, A0, A1) => L - tipRoom(q, A0, L) - tipRoom(q, A1, L) - 0.34 * q;
  let tabMayDrop = true;
  function tabOnPolyline(pts, s, dir, r, ang0 = 90, ang1 = 90) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    const at = u => {
      let i = 1; while (i < cum.length - 1 && cum[i] < u) i++;
      const a = pts[i - 1], b = pts[i], seg = (cum[i] - cum[i - 1]) || 1, t = (u - cum[i - 1]) / seg;
      const tx = (b[0] - a[0]) / seg, ty = (b[1] - a[1]) / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, -ty, tx];
    };
    let mid = L / 2 + (r() - 0.5) * 0.08 * L;
    if (tabMayDrop && (ang0 < 88 || ang1 < 88)) {
      for (let i = 0; i < 9; i++) {
        const lo = tipRoom(s, ang0, L) + 0.17 * s, hi = L - tipRoom(s, ang1, L) - 0.17 * s;
        if (lo <= hi) { mid = Math.min(hi, Math.max(lo, mid)); break; }
        if (i === 8) return pts; // no safe spot on this short edge: leave it straight, the piece locks through its other edges
        s *= 0.88; // edge too short for a full-size knob this close to a sharp corner
      }
    }
    const u0 = mid - 0.14 * s, u1 = mid + 0.14 * s;
    const out = [];
    for (let i = 0; i < pts.length; i++) if (cum[i] < u0) out.push(pts[i]);
    for (const [tu, tv] of tabTemplate()) {
      const p = at(mid + (tu - 0.5) * s);
      out.push([p[0] + p[2] * tv * s * dir, p[1] + p[3] * tv * s * dir]);
    }
    for (let i = 0; i < pts.length; i++) if (cum[i] > u1) out.push(pts[i]);
    return out;
  }
  // Strength check for a cut layout: a sharp corner of a piece must not hang on material thinner than `wall`.
  // Shrinking the piece by wall/2 splits such a tip off from the main body; count how many tips that happens to.
  function weakTips(pts, wall) {
    const inside = (R, x, y) => { let c = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const A = R[i], B = R[j]; if ((A[1] > y) !== (B[1] > y) && x < (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]) + A[0]) c = !c; } return c; };
    const area = R => { let t = 0; for (let i = 0, j = R.length - 1; i < R.length; j = i++) t += R[j][0] * R[i][1] - R[i][0] * R[j][1]; return t / 2; };
    const parts = offset([pts], -wall / 2, 'round').filter(q => Math.abs(area(q)) > 0.05).sort((x, y) => Math.abs(area(y)) - Math.abs(area(x)));
    if (!parts.length) return 0;
    const main = parts[0], n = pts.length; let weak = 0;
    for (let i = 0; i < n; i++) {
      const P = pts[(i - 1 + n) % n], V = pts[i], Q = pts[(i + 1) % n];
      const ax = P[0] - V[0], ay = P[1] - V[1], bx = Q[0] - V[0], by = Q[1] - V[1], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1.5 || lb < 1.5) continue; // corners of the cut layout sit between long straight edges
      const th = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / la / lb)));
      if (th > 85 * Math.PI / 180) continue;
      const ux = ax / la + bx / lb, uy = ay / la + by / lb, ul = Math.hypot(ux, uy), d = (wall / 2 + 0.3) / Math.sin(th / 2);
      const X = V[0] + ux / ul * d, Y = V[1] + uy / ul * d;
      if (!inside(pts, X, Y)) continue; // reflex corner
      if (!inside(main, X, Y) && parts.slice(1).some(q => inside(q, X, Y))) weak++;
    }
    return weak;
  }
  // Try a few knob arrangements and keep the first (or strongest) one without weak tips.
  function radialCells(kind, W, across, seed, gapMm = 0.3) {
    let best = null;
    for (let t = 0; t < 8; t++) {
      const jc = radialCellsOnce(kind, W, across, seed + t * 7919);
      const clip = [shapeOutline(kind === 'circle' ? 'circle' : 'hexagon', W)];
      let weak = 0;
      for (const c of jc.cells) for (const e of boolOp(CL.ClipType.ctIntersection, [c.pts], clip)) weak += weakTips(e.outer, MIN_WALL + gapMm);
      if (!best || weak < best.weak) best = { jc, weak };
      if (!weak) break;
    }
    return best.jc;
  }
  function radialCellsOnce(kind, W, across, seed) {
    const a = W / across, r = rng(seed);
    // pieces under ~6 mm are too small to keep every tip 2.8 mm strong; there the knobs stay where they always were,
    // since dropping or shrinking them could leave a piece with nothing holding it
    tabMayDrop = a >= 5.8;
    const isHex = kind === 'hex';
    // C(rho, phi): point on the ring of size rho at perimeter fraction phi (0..1, ccw from +x)
    const V = isHex ? [...Array(7)].map((_, i) => [Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3)]) : null;
    const C = (rho, phi) => {
      phi = ((phi % 1) + 1) % 1;
      if (!isHex) return [rho * Math.cos(phi * 2 * Math.PI), rho * Math.sin(phi * 2 * Math.PI)];
      const f = phi * 6, s = Math.min(5, Math.floor(f)), t = f - s;
      return [rho * (V[s][0] * (1 - t) + V[s + 1][0] * t), rho * (V[s][1] * (1 - t) + V[s + 1][1] * t)];
    };
    // sharpest angle between a radial cut and the ring it meets, at perimeter fraction phi (hexagon corners: 60)
    const cutAngle = phi => {
      if (!isHex) return 90;
      const f = (((phi % 1) + 1) % 1) * 6, sd = Math.floor(f + 1e-9) % 6;
      if (Math.abs(f - Math.round(f)) < 1e-6) return 60;
      const P = C(1, phi), T = [V[sd + 1][0] - V[sd][0], V[sd + 1][1] - V[sd][1]];
      const c = Math.abs(P[0] * T[0] + P[1] * T[1]) / (Math.hypot(...P) * Math.hypot(...T));
      return Math.acos(Math.min(1, c)) * 180 / Math.PI;
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
        // Corner angles of the two pieces this edge separates, at each end. The piece inside (ring k-1) has a corner
        // where a cut from ring k-1 ends here; the piece outside (ring k) where a cut of ring k starts here.
        const Rd = q => { const l = Math.hypot(q[0], q[1]) || 1; return [q[0] / l, q[1] / l]; };
        const dirAt = (u, v) => Rd([v[0] - u[0], v[1] - u[1]]);
        const T0 = dirAt(pts[0], pts[1]), T1 = dirAt(pts[pts.length - 2], pts[pts.length - 1]);
        const R0 = Rd(pts[0]), R1 = Rd(pts[pts.length - 1]);
        const ang = (u, v) => Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) * 180 / Math.PI;
        const has = (list, q) => !!list && list.some(v => Math.abs(((v - q) % 1 + 1.5) % 1 - 0.5) < 1e-6);
        const corner = q => isHex && Math.abs(q * 6 - Math.round(q * 6)) < 1e-6;
        const q1 = p1 % 1;
        // centre piece (k = 1): its only corners are the hexagon's own 120 degree corners
        const in0 = k === 1 ? (corner(p0) ? 120 : 180) : has(B[k - 1], p0) ? ang([-R0[0], -R0[1]], T0) : 180;
        const in1 = k === 1 ? (corner(q1) ? 120 : 180) : has(B[k - 1], q1) ? ang([-R1[0], -R1[1]], [-T1[0], -T1[1]]) : 180;
        const out0 = has(B[k], p0) ? ang(R0, T0) : 180, out1 = has(B[k], q1) ? ang(R1, [-T1[0], -T1[1]]) : 180;
        // the sharper piece gets the knob (it adds material to the tip); the blunter one takes the socket.
        // ring edges run ccw, so dir -1 pushes the knob outward (inside piece owns it); the centre always gets knobs.
        const inSharp = Math.min(in0, in1), outSharp = Math.min(out0, out1), sz = Math.min(L * 0.9, cap);
        let dir = k === 1 ? -1 : Math.abs(inSharp - outSharp) > 3 ? (inSharp < outSharp ? -1 : 1) : (r() < 0.5 ? 1 : -1);
        if (k > 1) { // if the socket doesn't fit safely on the preferred side but does (better) on the other, swap
          const slack = d => d === -1 ? tabSlack(L, sz, out0, out1) : tabSlack(L, sz, in0, in1);
          if (slack(dir) < 0 && slack(-dir) > slack(dir)) dir = -dir;
        }
        const sock0 = dir === -1 ? out0 : in0, sock1 = dir === -1 ? out1 : in1; // corners of the piece with the socket
        if (k === 1 ? L > a * 0.3 : L > a * 0.6) pts = tabOnPolyline(pts, Math.min(L * 0.9, cap), dir, r, sock0, sock1);
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
      // Corner angles at both ends of the cut, for the piece on each side. A cut to a hexagon corner gives both pieces
      // 120 degrees inside and 60 outside; a slanted cut gives one piece alpha / 180-alpha and the other the reverse.
      const Rr = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]], lr = Math.hypot(...Rr), Ru = [Rr[0] / lr, Rr[1] / lr];
      const Tq = (() => { const e = 1e-5, A = C(rho[k], p - e), Bq = C(rho[k], p + e), l = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]); return [(Bq[0] - A[0]) / l, (Bq[1] - A[1]) / l]; })();
      const isCorner = isHex && Math.abs(p * 6 - Math.round(p * 6)) < 1e-6;
      const alpha = isCorner ? 120 : Math.acos(Math.max(-1, Math.min(1, Ru[0] * Tq[0] + Ru[1] * Tq[1]))) * 180 / Math.PI;
      const right = isCorner ? [120, 60] : [alpha, 180 - alpha], left = isCorner ? [120, 60] : [180 - alpha, alpha];
      // dir +1 puts the knob on the left piece (socket on the right one): random, unless only one side fits safely
      const sz = Math.min(L, seg) * 0.8;
      let dir = r() < 0.5 ? 1 : -1;
      const slack = d => d === 1 ? tabSlack(L, sz, right[0], right[1]) : tabSlack(L, sz, left[0], left[1]);
      if (slack(dir) < 0 && slack(-dir) > slack(dir)) dir = -dir;
      const sock = dir === 1 ? right : left;
      if (L > a * 0.45) pts = tabOnPolyline(pts, sz, dir, r, sock[0], sock[1]);
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


  // ---------- Hex Grid: lattice-locked printable hex arrangements ----------
  // Never fit arbitrary clipped polygons to a piece-count target. The previous
  // search moved boundaries across the lattice, creating hairline slivers.
  // The circular/hexagonal formats use exact axial ring tiers; the rectangular
  // format always uses an N x N matrix of whole hexagons.
  function hexGridCells(W, wanted, layout = 'edge', gapMm = 0.3, squareAcross = null) {
    if (!(Number.isFinite(W) && W > 0)) throw new Error('Invalid Hex Grid model size');
    if (!['edge','alternating','round','square'].includes(layout))
      throw new Error('Unknown Hex Grid layout: ' + layout);
    const sqrt3 = Math.sqrt(3);
    const ringPoints = (x,y,s,angle=0) => Array.from({length:6},(_,k)=>{
      const a=angle+k*Math.PI/3;
      return [x+s*Math.cos(a),y+s*Math.sin(a)];
    });
    const bounds = polygons => {
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for (const poly of polygons) for(const [x,y] of poly){
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);
        minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
      return {minX,maxX,minY,maxY,width:maxX-minX,depth:maxY-minY};
    };
    const count = r => 1+3*r*(r+1);
    const target = Math.max(7,Math.min(150,Math.round(Number(wanted)||19)));
    let rings=1;
    for(let r=2;r<=6;r++) if(Math.abs(count(r)-target)<Math.abs(count(rings)-target)) rings=r;
    const partialBoard = layout==='edge'||layout==='alternating';
    let cells=[],side;
    let outline=null;
    if(partialBoard) {
      // Both layouts are centred at the hex board's rotational centre.
      // The first reference uses flat-top cells; the alternating reference
      // uses point-top cells. A one-sided translation destroys bilateral
      // symmetry, leaving visibly larger border panels on one side.
      const pointTop=layout==='alternating';
      // These deterministic tiers avoid narrow point-top corner slivers
      // while retaining complete 60-degree rotational symmetry.
      const pointTopScale=[0,1,0.91,0.88,1,0.97,0.97];
      side=W/(2*sqrt3*rings)*(pointTop?pointTopScale[rings]:1);
      outline=ccw(Array.from({length:6},(_,k)=>{
        const a=Math.PI/6+k*Math.PI/3;
        return [W/2*Math.cos(a),W/2*Math.sin(a)];
      }));
      const fullArea=1.5*sqrt3*side*side;
      for(let q=-rings*2-5;q<=rings*2+5;q++) for(let r=-rings*2-5;r<=rings*2+5;r++){
        const x=pointTop?sqrt3*side*(q+r/2):1.5*side*q;
        const y=pointTop?1.5*side*r:sqrt3*side*(r+q/2);
        const pts=ringPoints(x,y,side,pointTop?Math.PI/6:0);
        const clipped=boolOp(CL.ClipType.ctIntersection,[pts],[outline]);
        for(const ex of clipped){
          const a=exArea(ex);
          // These are geometric guardrails, not a piecemeal auto-delete.
          // A valid fixed-tier edge never creates a near-zero sliver.
          if(a<fullArea*.22) throw new Error(
            'Hex Grid edge fraction is too small; choose a different ring tier');
          if(a<=0) continue;
          cells.push({i:q,j:r,pts:ex.outer,partial:a<fullArea*.995});
        }
      }
    } else if(layout==='round'){
      // A true axial cluster: all 6 neighbours per ring, all whole hexagons.
      const unscaled=[];
      for(let q=-rings;q<=rings;q++)for(let r=-rings;r<=rings;r++){
        if(Math.abs(q+r)>rings)continue;
        unscaled.push({i:q,j:r,x:1.5*q,y:sqrt3*(r+q/2)});
      }
      const b=bounds(unscaled.map(v=>ringPoints(v.x,v.y,1)));
      side=W/Math.max(b.width,b.depth);
      cells=unscaled.map(v=>({i:v.i,j:v.j,pts:ringPoints(v.x*side,v.y*side,side),partial:false}));
    } else {
      // User chooses N on each axis, yielding precisely N*N whole pieces.
      const n=Math.max(2,Math.min(12,Math.round(Number(squareAcross)||
        Math.sqrt(target))));
      const unscaled=[];
      for(let col=0;col<n;col++) for(let row=0;row<n;row++){
        unscaled.push({i:col,j:row,x:1.5*(col-(n-1)/2),
          y:sqrt3*(row-(n-1)/2+((col&1)?0.25:-0.25))});
      }
      const b=bounds(unscaled.map(v=>ringPoints(v.x,v.y,1)));
      side=W/Math.max(b.width,b.depth);
      cells=unscaled.map(v=>({i:v.i,j:v.j,pts:ringPoints(v.x*side,v.y*side,side),partial:false}));
    }
    if(!cells.length) throw new Error('No Hex Grid cells were generated');
    if(!outline){
      const joined=exPolysFrom(cells.map(c=>c.pts));
      if(joined.length!==1)throw new Error('Hex Grid has disconnected whole-hex tiles');
      outline=joined[0].outer;
    }
    const bb=bounds(cells.map(c=>c.pts));
    return {cells,outline,clip:partialBoard,side,cellW:2*side,
      cellH:sqrt3*side,width:bb.width,depth:bb.depth,
      target:layout==='square'?cells.length:count(rings),
      actual:cells.length,rings,across:layout==='square'?Math.round(Math.sqrt(cells.length)):null,
      layout};
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
      ? hexGridCells(W, p.pieces, p.hexLayout || 'edge', p.gapMm, p.hexAcross) : null;
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
    const base = hf.panel ? p.panelBacking * p.panelLayer : p.baseMm, k = mmPerM * p.exag;
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
    const reliefMm = hf.panel ? (hf.panel.palette.length - 1) * p.panelBand * p.panelLayer : (hMax - hMin) * k;
    const terrainSolid = (ex, top, bottom, step, out) => hf.panel
      ? colorSolid(ex, hf.panel, W, base, p.panelBand*p.panelLayer, bottom, out, typeof top === "number")
      : solid(ex, top, bottom, step, out);
    // rim height above the base: exactly as set, or (optional) raised to about half the printed relief
    const frameTop = floorZ + base + (p.rimAuto ? Math.max(p.rimMm, Math.min(reliefMm * 0.55, 14)) : p.rimMm);
    const join = p.shape === 'circle' ? 'round' : 'miter';
    const outlineD = densify(outline, Math.max(0.2, step));

    // terrain
    const terrain = [];
    if (p.product === 'puzzle') {
      const inner = offset([outline], -p.gapMm / 2, join);
      const jc = hex || (p.shape === 'square' ? jigsawCells(W, H, p.pieces, p.seed) :
        radialCells(p.shape === 'circle' ? 'circle' : 'hex', W, p.pieces, p.seed, p.gapMm));
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
        for (const c of cells) {
          // c.pts is already aligned to the board, including any deliberate
          // full/half/corner tile. Inset ONCE by half the requested clearance.
          const shapes = [{outer:c.pts,holes:[]}];
          for (const ex of shapes) {
            const shr = exPolysFrom(offset([ex.outer,...ex.holes],-p.gapMm/2,'miter'));
            if (!shr.length) throw new Error(
              'Hex tile is too small for the selected gap. Choose fewer rings or reduce clearance.');
            for (const s of shr) {
              const ring = densify(s.outer, Math.max(0.2, step));
              const tris=[];
              const flat = hex.clip && c.partial && p.hexEdge === 'flat';
              terrainSolid({outer:ring,holes:s.holes},flat ? floorZ+base : topZ,floorZ,step,tris);
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
        try { terrainSolid({ outer: densify(shr[0].outer, Math.max(0.2, step)), holes: shr[0].holes }, topZ, floorZ, step, tris); }
        catch (e) {
          // a pinch where two tabs nearly touch: open the outline slightly and retry
          const fix = exPolysFrom(offset(offset([shr[0].outer, ...shr[0].holes], -0.15, 'round'), 0.15, 'round'));
          fix.sort((x, y) => exArea(y) - exArea(x)); tris = []; ring = fix[0].outer;
          terrainSolid({ outer: densify(fix[0].outer, Math.max(0.2, step)), holes: fix[0].holes }, topZ, floorZ, step, tris);
        }
        parts.push({ name: `Piece ${++n}`, role: 'terrain', tris: new Float32Array(tris), cell: [q.cell.i, q.cell.j], ring });
      }
      }
    } else {
      const tOut = p.separate ? densify(offset([outline], -p.gapMm / 2, join)[0], Math.max(0.2, step)) : outlineD;
      terrainSolid({ outer: tOut, holes: [] }, topZ, floorZ, step, terrain);
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
    if (hf.panel) for (const part of parts.filter(o=>o.role==='terrain')) {
      part.palette = hf.panel.palette.map(rgb=>'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''));
      part.faceColors = new Uint8Array(part.tris.length/9);
      for(let i=0;i<part.faceColors.length;i++) {
        const z=(part.tris[i*9+2]+part.tris[i*9+5]+part.tris[i*9+8])/3-floorZ;
        part.faceColors[i]=Math.max(0,Math.min(part.palette.length-1,Math.ceil((z-base)/(p.panelBand*p.panelLayer)-1e-5)));
      }
    }
    // Paint only upward terrain faces. Geometry is identical to unpainted terrain;
    // walls and undersides use the first filament, frames keep their own material.
    if(hf.surface) for(const part of parts.filter(o=>o.role==='terrain')) {
      const {labels,palette,width:n}=hf.surface,t=part.tris;
      part.palette=palette.map(rgb=>'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''));
      part.faceColors=new Uint8Array(t.length/9);
      for(let i=0;i<t.length;i+=9) {
        const nz=(t[i+3]-t[i])*(t[i+7]-t[i+1])-(t[i+4]-t[i+1])*(t[i+6]-t[i]);
        if(nz<=1e-10)continue;
        const x=(t[i]+t[i+3]+t[i+6])/3,y=(t[i+1]+t[i+4]+t[i+7])/3;
        const col=Math.max(0,Math.min(n-1,Math.floor((x/W+.5)*n)));
        const row=Math.max(0,Math.min(n-1,Math.floor((.5-y/W)*n)));
        part.faceColors[i/9]=labels[row*n+col];
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
    const palette = parts.find(p=>p.palette)?.palette || [];
    const colorId = 100000;
    for (const p of parts) {
      const { verts, idx } = weld(p.tris);
      const v = []; for (let i = 0; i < verts.length; i += 3) v.push(`<vertex x="${verts[i].toFixed(4)}" y="${verts[i + 1].toFixed(4)}" z="${verts[i + 2].toFixed(4)}"/>`);
      const t = []; for (let i = 0; i < idx.length; i += 3) { if (idx[i] === idx[i + 1] || idx[i + 1] === idx[i + 2] || idx[i] === idx[i + 2]) continue; t.push(`<triangle v1="${idx[i]}" v2="${idx[i + 1]}" v3="${idx[i + 2]}"${p.faceColors ? ` pid="${colorId}" p1="${p.faceColors[i/3]}"` : ""}/>`); }
      objs += `<object id="${id}" name="${esc(p.name)}" type="model" pid="1" pindex="${mats.indexOf(p.role)}"><mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh></object>`;
      comps += `<component objectid="${id}"/>`; id++;
    }
    const bm = mats.map(m => `<base name="${m}" displaycolor="${colors[m] || '#888888'}"/>`).join('');
    const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${esc(title)}</metadata><metadata name="Application">Terrain Press</metadata><resources><basematerials id="1">${bm}</basematerials>${palette.length ? `<basematerials id="${colorId}">${palette.map((c,i)=>`<base name="Color ${i+1}" displaycolor="${c}"/>`).join("")}</basematerials>` : ""}${objs}<object id="${id}" name="${esc(title)}" type="model"><components>${comps}</components></object></resources><build><item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 128 128 0"/></build></model>`;
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

  root.TPCore = { nodeGrid, makeStore, meshPlan, buildModel, hexGridCells, spreadPieces, spreadPreview, stl, model3mf, zip, weld, shapeOutline };
})(typeof self !== 'undefined' ? self : globalThis);
