# Terrain Press — Planetary Terrain Data Roadmap

**Status:** v1.5.1 simplifies resolution controls to Automatic (printer-/DEM-aware) and Advanced (manual spacing and 721/1,441/2,881 sample ceilings). **Next milestone: verified higher-resolution downloads for other planets/dwarf planets and, where suitable products exist, additional moons.** Curvature-adaptive meshes are deferred. Full multi-GB NASA-transfer acceptance remains outstanding.

## Product objective

Offer a small Windows executable that works immediately without the internet using its bundled elevation data, while letting users install **whole-planet resolution upgrades**, and later **coordinate-based regional packs**. The complete package remains available offline after download. Users can type arbitrary latitude/longitude and choose a region width. The app automatically uses the finest **installed, geographically valid, real** elevation data for an export, with a coarse built-in fallback.

## Current baseline (confirmed from repository)

- The seven built-in worlds are Moon, Mars, Mercury, Venus, Ceres, Vesta and Pluto.
- Global lunar grid: 8192 × 4096 samples (~1,331 m/pixel at equator), compressed WebP elevation tiles ~31.7 MB. Mercury: 10240 × 5120. Others: 8192 × 4096.
- All assets are bundled with the Windows executable, including the global grids and selected locally sharper landmark patches. The original offline workflow remains supported.
- The terrain mesh is sampled independently of the elevation source. Automatic (default) chooses useful spacing using the DEM and printer settings; Advanced offers nominally 0.50/0.35/0.25 mm target spacing and manual grids of 721/1,441/2,881 samples per side. The universal cap is 2,881 × 2,881. Finer spacing cannot recover missing DEM detail.
- The source code currently stores encoded elevation heights in integer metres in lossless WebP; metadata supplies the reference radius, grid size, and per-patch coverage.
- Users can already enter custom coordinates; the 0.01° input step should be reduced to 0.001° or finer.

## Lunar source availability: direct NASA downloads

The NASA PDS LOLA gridded archive describes 4/16/64/128/256/512 pixels per degree (ppd) in equirectangular products. **1024 ppd products are sparse**, not a guaranteed globally useful tier. Do not advertise 1024 ppd as complete global coverage.

| Candidate | Equatorial spacing | Full equirectangular raster | Raw 16-bit heights | Publication |
|---|---:|---:|---:|---|
| Built-in raster | ~1,331 m | 8192 × 4096 | 64 MiB | Shipped |
| LOLA 128 ppd | ~237 m | 46080 × 23040 | ~1.98 GiB | Download from NASA PDS |
| LOLA 256 ppd | ~118 m | 92160 × 46080 | ~7.91 GiB | Download from NASA PDS |
| LOLA 512 ppd | ~59 m | 184320 × 92160 | ~31.64 GiB | Download from NASA PDS |
| LOLA 1024 ppd | ~30 m | Tile/region based | Not a complete uniform product | Sparse; regional only |

Storage for compressed tiles must be **measured with representative data**; do not extrapolate from low-resolution compressed tiles as a promise. Actual measurement density, NoData, interpolation, vertical reference, and coverage must be recorded in manifests. Consider the SLDEM/Kaguya combined dataset separately; its 512 ppd coverage and quality are not identical to LOLA-only.

Sources:
- NASA PDS LOLA GDR: https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-LOLA-4-GDR-V1.0
- LOLA gridded DEM format: https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/LRO/LOLA/GDR/GDRDEM.htm
- SLDEM combined product: https://ode.rsl.wustl.edu/moon/pagehelp/content/Missions_Instruments/LRO/LOLA/SLDEM.htm

## Delivery phases

### Phase 1 — Dataset catalog and Windows storage foundation (first integration)

- [x] Record goals, tiers, estimates, and coverage caveats in this roadmap.
- [x] Add a versioned offline catalog listing bundled data and **clearly marked planned** optional lunar resolutions.
- [x] Add desktop data manager UI for browsing bundled/optional datasets and selecting a writable external storage directory.
- [x] Add secure, checksum-verified tile download/install/remove backend driven only by published catalog manifests (no arbitrary UI-supplied URLs). Incomplete downloads preserve verified tiles for restart/resume.
- [x] Add a private app URL for stored tiles and pass installed global grids to the terrain sampler, selecting the sharpest installed source while keeping built-in high-resolution patches when sharper.
- [x] Add validation tests for manifests, path confinement and source selection.
- [x] Enable global 128/256/512 ppd source downloads directly from NASA PDS (no Terrain Press mirror).
- [ ] Verify an entire completed PDS download and offline STL export on Windows.
- [ ] Windows end-to-end test of download -> print export -> offline restart -> delete -> fallback (requires a hosted pack).

### Phase 2 — Verify NASA direct Moon 128 ppd upgrade end-to-end

- [ ] Confirm NASA source version, license, coverage, geodetic datum, NoData masks, and correct longitude/origin conventions.
- [ ] Build reproducible Python conversion pipeline: source product -> tiled, lossless elevation WebP. Retain native sample values where possible; avoid fabricated detail.
- [ ] Generate per-file SHA-256 and byte counts plus a signed or pinned SHA-256 manifest. Verify every output tile round-trip against input heights and sample checks.
- [x] Preserve original NASA PDS IMG files, and convert needed PNG elevation tiles locally instead of hosting duplicate global mirrors.
- [ ] Test downloads through interruption, cancellation, changed storage location, low disk space, CDN failure, corruption, and upgrade across application versions.
- [ ] Validate model STL/3MF appearance and sample values at several random and named coordinates; measure performance and actual disk use.
- [ ] Disclose interpolation/no-data and native resolution in the UI and exported project metadata.

### Phase 3 — Higher resolutions and partial geography

- [ ] Add Moon 256/512 ppd full-global tiers where source data and coverage have been validated. Use multi-file tiled transfer, not a single huge release asset.
- [ ] Add regional download by lat/lon + width/extent with margin, including dateline wrap and poles; use tile-level ownership/reference counts so global and regional packs can share data.
- [ ] Tile previews: estimated storage cost, download progress, pause/resume and retry, ETA when measurable, cancellation.
- [ ] Add dataset quality/coverage overlay and provenance warnings instead of marking interpolated pixels as observed.
- [ ] Support changing/migrating data directory after installs, optional multiple drives and disk quota management.
- [x] Add an Auto source-matched export grid that uses the highest available DEM at each selected coordinate and flags the 721 × 721 cap.
- [x] Add an opt-in high-detail 3D preview using the **same export mesh quality** and actual coordinate-specific DEM source; maintain fast previews by default.
- [x] Increase model width to **1,000 mm** and scale the virtual camera/plate to large puzzles.
- [x] Make terrain sampling ceiling configurable (721 / 1,441 / 2,881) with an Auto mode limited by the source DEM and model's smallest printable feature.
- [x] Add user-selectable effective printer feature size (0.2–1.0 mm), preflight mesh estimates, and heavy-mesh warnings.
- [x] Simplify print controls to Automatic (feature size only) and Advanced (manual mesh spacing and sample ceiling), without changing the numerical sampling algorithm.
- [ ] Benchmark high-detail previews and 1,000-mm multi-piece puzzles on representative Windows hardware; profile large export ZIP and slicer import performance.
- [x] Fix PNG-vs-WebP source lookup when switching 83 m landmark → downloaded NASA global raster → landmark, with automated regression coverage.
- [ ] Implement true **spatially adaptive triangle meshing** to spend triangles on rough terrain rather than uniform grids.

### Next milestone — Other worlds in Terrain Data Manager (Phase 4)

The next development milestone is **additional real, verifiable elevation datasets**, not adaptive geometry. Prioritize the bodies already selectable in Terrain Press; do not advertise or enable a new pack until its file format, spatial coverage, and vertical measurements have been validated.

1. **Mars — MOLA:** identify a publicly hosted, stable higher-resolution grid than the included MOLA dataset. Implement downloader, local on-demand elevation tile generation, datum/scale checks, and fallback. Make this the first end-to-end pilot for a non-lunar world.
2. **Mercury — MESSENGER:** add a globally usable candidate and verify east/west longitude convention, poles, source quality and missing-data behavior. Only publish tiers finer than the built-in grid.
3. **Venus — Magellan:** validate gridded topography, body radius and datum, known gaps and nominal ground spacing before listing a downloadable tier.
4. **Ceres and Vesta — Dawn:** separately validate body-specific DEMs, irregular-body reference frames, coverage, and regional vs global options. Never treat their effective map resolutions as identical.
5. **Pluto — New Horizons:** clearly label partial geographic coverage; prevent unmapped hemisphere filler from being presented as measured high-resolution elevation.
6. **Additional moons:** first establish that a trustworthy public DEM and coordinate reference model exist, then add a world definition and offline fallback before offering a downloadable pack. Don't make unsupported global-coverage claims.

Implement a reusable **non-lunar raster importer** behind the existing download manager, with source-specific metadata validation and body-specific elevation conversion. Share the current external storage directory, resumable download/reporting UI, tile cache and highest-valid-source selection. Protect existing lunar downloads and the bundled offline fallback. Publish a dataset only with provenance, licensing/attribution, measured bytes, hashes, NoData handling and coordinate/height round-trip checks. Regression-test transitions between bundled global, installed pack, optional landmark patch and missing/corrupt pack.

**Milestone acceptance:** At least one verified non-Moon download (Mars first) completes, survives offline restart, contributes the correct elevation values to preview and 3MF/STL at documented coordinates, and cleanly reverts to bundled terrain when removed. Remaining worlds follow the same acceptance gates.

### Follow-on — Dataset maintenance and verification

- [ ] Inventory real public global DEM resolutions/coverage for Mars (MOLA), Mercury (MESSENGER), Venus (Magellan), Ceres/Vesta (Dawn), Pluto (New Horizons).
- [ ] Offer only validated, publishable whole-planet tiers, and explicitly label partial-resolution products (Pluto especially).
- [ ] Version datasets independently of the application; adopt reproducible conversion checksums and immutable CDN URLs.
- [ ] Automated Windows CI, independent download integration tests, dataset health monitoring and portable-vs-installed deployment evaluation.
- [ ] Publish measured download sizes, quality limitations, licensing/credit, mirror budget and update policy.

## Pack delivery protocol (v1)

The catalog embedded in desktop/packs/catalog.json is reviewed in source control. Built-in entries are informational. Optional catalog entries start at status "planned"; a tier is installable only once its entry has status "published" plus an HTTPS manifest URL and a pinned SHA-256 of the manifest bytes.

A published JSON manifest must contain:
- schemaVersion=1, id/body/w/h/tile matching the catalog.
- baseUrl: HTTPS directory containing independently downloadable WebP tiles.
- files: one entry for **every** t{row}_{col}.webp of the complete equirectangular grid, with name, bytes and 64-character SHA-256.

The desktop downloader rejects missing tiles, traversal paths, untrusted HTTP URLs and mismatched hashes. It stores verified tiles under an external directory, stages an incomplete pack without exposing it to the sampler, and atomically makes it available once all tiles verify. Already verified tiles are skipped on retry. **Resume currently works at whole-tile boundaries**, not byte-range resume within a tile. There is one download at a time. A full download can be large and may be slower than a concurrent downloader; concurrency and byte-range resume are future improvements.

Installed pack requests are served under terrain://app/packs/{id}/t{row}_{col}.webp from the chosen local storage location, not from the Internet. The sampler uses the pack dimensions/tile size instead of the bundled source parameters, with existing globally bundled data as fallback. The standard hosted web build continues to use bundled data until it gets a browser-compatible cache/storage implementation.

## Acceptance criteria for complete hybrid feature

1. A fresh install works offline, at arbitrary coordinates on all seven bodies, exactly as before.
2. Every published option displays measured bytes, quality/coverage, source identity, and projected disk space.
3. Downloading and verifying an entire body at a selected tier makes that resolution usable at *any* coordinate offline.
4. Corrupted, partially downloaded or missing tiles never appear installed or silently masquerade as verified terrain.
5. Export metadata reports the actual source/grid used, and a user can compare outputs at different installed resolutions.
6. Users may cancel, resume, remove or relocate downloads without corrupting the bundled app.
7. Catalog and binary updates are independently versioned; older print projects remain reproducible.

## Key constraints and risks

Large pack distribution needs hosting/bandwidth cost estimation; GitHub release assets are unsuitable for tens-of-gigabytes single files. Windows user-selected data locations may be removable or network drives; report missing packs rather than crashing. Some existing app labels are approximate and legacy resolution conversions should be verified against the input datasets before publication. Source resolution, encoded raster resolution and STL mesh sampling must remain distinct in all messaging.

## v1.2.0 — direct NASA IMG path

The desktop app fetches original LOLA LDEM_128, 256 (4 segments), and 512 (16 segments) IMG files and PDS labels directly from the official [NASA PDS Geosciences Node](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/). Each IMG segment is 2,123,366,400 bytes. The downloader checks PDS label dimensions, signed 16-bit format, sample scaling (0.5 metres), datum radius (1,737,400 metres), and file sizes. After transfer it computes local SHA-256 checksums; these have not been compared to NASA-published canonical SHA-256 values. Completed images are stored outside the executable, interrupted transfers retain their partial files, and resumed requests use HTTP Range where the PDS server permits it. A secure local protocol generates on-demand PNG terrain tiles from the native IMG files, compensating for the PDS 0–360-degree longitude origin. Web builds retain the bundled data.

**Outstanding acceptance checks:** Download real 2.12GB+ data on Windows, verify offline restart and STL heights at representative coordinates, check performance, disk-space behavior and no-data source coverage. Do not imply these tests have passed yet. Adding downloadable datasets for the six other bodies remains planned.

## Next geometry milestone — Adaptive mesh by terrain error

The v1.3.0 **Auto** option is an immediate, safe stepping stone: it matches *uniform heightfield grid density* to the selected source at the requested coordinates, maintaining a Standard-quality minimum. It does **not** yet vary triangle sizes across the terrain, and the user-selectable ceiling (up to 2,881 × 2,881) applies; automatic limiting avoids redundant detail.

For genuine spatial adaptivity, the next implementation should:

1. Derive a curvature/screen- or print-space height error tolerance (millimetres of printed relief) for each terrain area, with selectable quality budget.
2. Subdivide a quadtree only where local height residual exceeds the requested tolerance, preserving cliff/crater rims and respecting raw DEM sampling (do not invent detail from interpolation).
3. Handle adjacent cells without T-junctions/cracks; stitch triangulation around cut-out shapes, frames, puzzle pieces and coast/border loops.
4. Export watertight, consistently wound manifold STL and 3MF meshes, with stable topology at the dateline and around poles.
5. Show triangle count and forecast output size before export, with a bounded triangle budget; support cancel and progress reporting.
6. Compare adaptive output to source raster ground truth for Tycho, Apollo landing sites, global LOLA 128/256/512 and a smooth plain. Bench memory, CPU, file size and slicer import reliability.
7. Leave Standard/Fine/Ultra fixed-grid options for predictable performance and reproducible legacy prints.

**Acceptance:** A 512 px/degree print should resolve all DEM-supported crater detail at the chosen print scale without needlessly subdividing smooth terrain, should never silently fall back to a lower local source, and should be watertight in common slicers.

## v1.5.0: Automatic sampling policy and guardrails

- Derive DEM sample spacing on the physical print as `sourcePxKm * widthMm / regionKm`. Approximate useful height grid spacing as the **larger** of that number divided by 1.5 and the user-selected smallest printable feature divided by 2. At that spacing, a uniform mesh approximates the DEM without using far more vertices than a printer can meaningfully resolve.
- Select the smaller of the export-detail requested node count, the useful node count, and the 2,881 hard maximum for Sampling Limit = **Auto**. Export detail = **Auto** uses the useful count directly; Standard/Fine/Ultra may reduce redundant samples in automatic-limit mode.
- Explicit limits 721, 1,441 and 2,881 preserve requested detail until the chosen ceiling, even if this oversamples DEM or printer; users can choose precision/quality trade-offs themselves.
- The fast preview continues to use the legacy 721 ceiling at 0.7-mm target spacing. High-detail preview uses exactly the export planner. Plans are estimated before export; both preview and export warn when more than 1,441 nodes per side are requested.
- **Safety/performance limitations:** 2,881² is 8.3 million height samples, with multiple temporary arrays plus potentially large mesh/triangle buffers and STL/3MF output. Real CPU/RAM/slicer limits have not been benchmarked and may be considerably lower; consider adaptive mesh and memory-budget settings next. Printable-feature assumptions are approximate and should not be mistaken for dataset measurement confidence.
