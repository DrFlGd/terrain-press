# Terrain Press — Planetary Terrain Data Roadmap

**Status:** Io source-validation tooling and prerequisites are now tracked as a new-world research milestone (not installed or selectable). v1.7.0 adds **beta** USGS GeoTIFF elevation downloads for Mercury (MESSENGER 64 ppd), Ceres (Dawn 60 ppd) and Vesta (Dawn 48 ppd) alongside the Mars beta and lunar LOLA upgrades. Source-specific height datums, 24-bit signed elevation tiles, and NoData fallback are implemented. **Complete transfer and real-value offline export testing of the new GeoTIFFs remains outstanding.** Venus offers no clearly better global Magellan topography at present; Pluto's fine DEM coverage is partial.

## Next new-world candidate — Io, Jupiter's volcanic moon (research milestone)

**Status: requirements and source-inspection tooling started; not yet a downloadable pack or selectable world.** Io cannot be treated as another Mars/Moon raster with a new `body` ID. Its published global stereo DEM is only partially observed, and its regional Tvashtar DEM has an arbitrary vertical zero. No Io imagery, elevation or model should be advertised as ready until the steps below pass.

### Verified research sources and restrictions

| Source | Data and usefulness | Important constraints |
|---|---|---|
| White et al. (2014), `IoDEM.cub` [paper and supplementary file](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2013JE004591) | Voyager/Galileo controlled stereo DEM, 70 component products (0.14–4.08 km/pixel), ~75% measured coverage, publisher lists an ISIS cube ~252.3 MB | **Not a fully observed global DEM.** Publication link for supplementary cube returned HTTP 403 in automated research; obtain and inspect the real file before claiming the download works. Report regional confidence/resolution, special-pixel mask and reference figure. |
| USGS [Tvashtar Paterae DEM, 900 m](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_tvashtar_paterae_dem_and_orthoimages_900m) | Regional Galileo SSI stereo **elevation** GeoTIFF, 286 × 641 pixels; approx. 55.6–73.8°N and 128.6–110.3°W in positive-east -180–180 form | **Arbitrary vertical zero** and possible long-wavelength tilt. Must fit to overlapping controlled elevations rather than stacking raw Tvashtar values over global topography. Its color hillshade and orthophotos are not height rasters. |
| USGS planetary Io mosaic and IAU Gazetteer | Surface colors, landmarks, and geometry cross-checks | Images provide visual appearance, **not** DEM heights. The IAU feature Gazetteer commonly displays positive-west longitudes; always convert and verify the convention against landmarks. |

Sources: White et al., 2014, doi:[10.1002/2013JE004591](https://doi.org/10.1002/2013JE004591); [USGS Tvashtar source description](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_tvashtar_paterae_dem_and_orthoimages_900m); [GDAL ISIS3 driver and mask behavior](https://gdal.org/en/stable/drivers/raster/isis3.html).

### Requirements for a scientifically grounded Io print

1. **Source acquisition, identity, license and reproducibility.** Acquire the original `IoDEM.cub` and regional elevation TIFF; capture stable source URL, publication/version, exact bytes, cryptographic SHA-256, attribution/reuse conditions and any detached ISIS labels. Avoid relying on a speculative direct URL or redistribution rights. Preserve native files outside the portable EXE.
2. **Inspect actual numeric and projection metadata before conversion.** Use GDAL/ISIS3 to record shape, bands, scalar data type, scale/offset, projection, planetocentric vs planetographic latitude, east/west-positive longitude, longitude domain, pixel registration, vertical units and reference radius/ellipsoid. Do not assume the 2014 DEM uses metres or an arbitrary 1,821,460 m sphere merely because the Tvashtar product lists that sphere.
3. **Coverage and confidence.** Produce a separate *measured-data coverage mask* from the ISIS3 special pixels/NoData and any source quality information. Quantify valid fractions globally and over proposed landmarks. An attractive fill for unobserved areas, if used for printable continuity, must stay explicitly distinguishable from stereo-observed terrain; never claim a wholly measured global Io DEM.
4. **Datum and body-shape consistency.** Confirm Io's triaxial reference figure, reference elevation and actual DEM sample interpretation. Convert to the signed integer-metre heights used by Terrain Press, including documented treatment of long-wavelength global shape; do not conflate radius, areoid-relative relief, and distance above a projected ellipsoid.
5. **Tvashtar regional alignment.** Reproject the 900 m GeoTIFF, validate source footprint against positive-east Io landmarks, and estimate its zero offset and tilt against overlapping trusted stereo data. Where alignment is unsupported or residuals are excessive, retain separate provenance or block regional elevation blending.
6. **Safe reprojection/export preparation.** Produce reproducible equirectangular terrain tiles (north-up, 180°W…180°E), lossless metre-height encoding, source mask/coverage overlay, global overview, globe imagery, and a built-in low-resolution fallback. Keep the measured resolution separate from raster grid oversampling and printer mesh sampling. Test dateline wrap, poles and coordinate round trips.
7. **New-world UX and data manager.** Only after verified offline assets exist, add `io` to world metadata and renderer with its own radius, colors, globe material, appropriate citations, correctly transformed named volcanic/mountain locations and **Moon of Jupiter** classification. A separate optional Io global/region beta pack may then reuse the downloader's external storage and source-choice priority without claiming complete coverage.
8. **Print and Windows acceptance.** Cross-check multiple high/low known features (start with Tvashtar, Loki and Ra Paterae and a mapped plain), confirm elevations across source seams and NoData margins, and test 3MF/STL watertight models and puzzles at 100, 460 and 1,000 mm where practicable. Verify offline restart, pack uninstall, upgrade, disk size, cache behavior, and large-mesh memory. Export metadata must disclose observed-vs-filled coverage and source date.

### Sequenced implementation and exit gates

- [x] Identify published 2014 global stereo cube and USGS regional Tvashtar GeoTIFF; distinguish them from optical mosaics and hillshade.
- [x] Create a versioned, **non-installable research catalog** of original sources in `tools/io/sources.json` (including unverified fields and observed publisher access limitations).
- [x] Add `tools/io/preflight.js` and Node tests to inspect genuine `gdalinfo -json` output without any assumed datum or promotion to an installable pack.
- [ ] Obtain `IoDEM.cub` (supplementary link currently blocked for automated inspection), verify source rights/checksum and run the preflight against **actual** cube metadata.
- [ ] Obtain the small `TvashtarPaterae_DEM_900m.tif`; inspect its true pixel values, CRS, mask and vertical zero and archive a reviewed metadata report.
- [ ] Choose and document a height-normalization and native-mask preservation strategy based on those actual files, with scientific source checks and independent reference heights.
- [ ] Implement a reproducible GDAL conversion pipeline and compare exact sample values at surveyed coordinates; generate a test-only Io source asset and measured-coverage overlay.
- [ ] Produce globe imagery, a clearly differentiated visually filled offline fallback and landmark metadata; test region previews and exports without mislabeling extrapolated terrain.
- [ ] Enable Io in the world selector and downloadable beta catalog only after a confirmed native DEM → valid preview → printable STL/3MF pipeline.
- [ ] Complete Windows end-to-end download/offline/restart/remove/slicer testing and record provenance, confidence and coordinate limits in the exported ZIP.

**First-step usage:** `node tools/io/preflight.js --source io-white-2014-global --raster /path/IoDEM.cub --output io-global-report.json`, or use `--source io-tvashtar-900m --raster /path/TvashtarPaterae_DEM_900m.tif`. Requires the free `gdalinfo` executable from GDAL on the developer machine. Reports can also be checked offline via `--gdalinfo-json /path/metadata.json`. A structural pass is **not** release approval; the tool deliberately reports `approvedForImport: false` until the manual scientific checks are complete.

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

1. **Mars — MOLA beta implemented in v1.6.0:** select the PDS4-maintained MEGDR 64 ppd topography (four 132,710,400-byte IMG files, global 90°N–90°S), implement local on-demand elevation tile conversion, validate PDS labels/datum, preserve the low-res built-in fallback and existing lunar downloads. **Outstanding:** a complete real-data download, native PDS label inspection and an offline STL/3MF value comparison on physical Windows hardware. Do not mark this as acceptance-complete before those tests.
2. **Mercury — MESSENGER beta integrated:** USGS MDIS Global DEM v2 GeoTIFF (64 ppd, 665 m/pixel). Validate actual downloaded georeferencing, positive-east longitude, poles, no-data and measured elevations against trusted positions before removing the beta label.
3. **Venus — Magellan:** validate gridded topography, body radius and datum, known gaps and nominal ground spacing before listing a downloadable tier.
4. **Ceres and Vesta — Dawn beta integrated:** USGS Ceres 60ppd HAMO relative-height DTM and Vesta 48ppd HAMO radius DTM (subtract 255 km; Claudia Double Prime frame). The former is ~98% observed and the latter ~95%; verify source NoData maps, exact DEM origin and reference datum in a full beta test before marking production quality.
5. **Pluto — New Horizons:** clearly label partial geographic coverage; prevent unmapped hemisphere filler from being presented as measured high-resolution elevation.
6. **Additional moons:** first establish that a trustworthy public DEM and coordinate reference model exist, then add a world definition and offline fallback before offering a downloadable pack. Don't make unsupported global-coverage claims.

Implement a reusable **non-lunar raster importer** behind the existing download manager, with source-specific metadata validation and body-specific elevation conversion. Share the current external storage directory, resumable download/reporting UI, tile cache and highest-valid-source selection. Protect existing lunar downloads and the bundled offline fallback. Publish a dataset only with provenance, licensing/attribution, measured bytes, hashes, NoData handling and coordinate/height round-trip checks. Regression-test transitions between bundled global, installed pack, optional landmark patch and missing/corrupt pack.

**Milestone acceptance (pending):** At least one verified non-Moon download (Mars first) completes, survives offline restart, contributes the correct elevation values to preview and 3MF/STL at documented coordinates, and cleanly reverts to bundled terrain when removed. The Mars beta implements the pipeline but does not yet pass the full real-NASA transfer acceptance test. Remaining worlds follow the same acceptance gates.

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

## v1.6.0 beta notes

- The optional Mars MOLA 64 data are supplied by the [NASA PDS MGS MOLA MEGDR collection](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html). The 2026 PDS4 archive is preferred to the maintained-for-legacy PDS3 URLs. Use only the four `megt*gb.img` topography tiles; `megr*` radius and `megc*` counts are different rasters and must not be substituted. Global MEGDR 64 coverage includes both poles; 128 ppd 88° bands and polar stereographic grids require different handling in future milestones.
- Both lunar and Martian IMG downloaders share the manager's external directory, catalog selection, cancellation, status and on-demand PNG cache. Physical Mars heights must represent **metres relative to the areoid**, not radius offset; test samples include both positive and negative synthetic elevations. MOLA labels must validate PDS dimensions, signed 16-bit sample type, scale and offset.
- **Known beta risk:** PDS4-hosted `.lbl` availability, server Range behavior, full transfer duration, and actual topography DATUM roundtrip have not been confirmed by a completed real Windows download. UI labels must disclose experimental status. Do not mark the Mars source production-verified until the full acceptance checklist passes.
- Spread-piece preview now handles puzzles with no separate frame. A regression test covers 460-mm spread geometry without and with a frame (including an empty frame), checking for finite coordinates and no frame overlap.

## v1.7.0 — Other-world beta downloads and verification gates

- Mercury: `Mercury_Messenger_USGS_DEM_Global_665m_v2.tif` (USGS GeoTIFF, expected 23,040 × 11,520 and 16-bit raster).
- Ceres: `Ceres_Dawn_FC_HAMO_DTM_DLR_Global_60ppd_Oct2016.tif` (expected 21,600 × 10,800; signed heights above 470 km sphere; ~98% mapped/interpolated poles).
- Vesta: `Vesta_Dawn_HAMO_DTM_DLR_Global_48ppd.tif` (expected 17,280 × 8,640; 32-bit radius, Claudia Double Prime longitude, ~95% stereo coverage).
- A dedicated USGS GeoTIFF driver downloads each beta source to local optional storage, reads sample windows on demand, and encodes signed height samples in 24-bit RGB. Missing/NoData samples are masked and the sampler falls back to bundled terrain. Unknown data formats are rejected instead of being silently treated as heights.
- **Still to validate individually:** remote full download and redirects, exact TIFF file metadata and georeferencing, reference elevation and longitude roundtrip against archive landmarks, corrupt-data recovery, performance of TIFF decode, offline STL/3MF and uninstall fallback.
- Venus and Pluto have not been presented as full higher-resolution downloads: the former does not clearly improve on already-bundled global topography at documented ~4.64km/pixel, and the latter requires an explicit partial-coverage selector to avoid claiming New Horizons data exists everywhere.

## v1.8.0 — Hex Grid geometry and oversize model UI

- [x] Introduce **Hex Grid** as a separate puzzle shape (not a reinterpretation of the original Hexagon nested-ring puzzle). Keep the same elevation source and STL/3MF pipeline.
- [x] Four tessellation families based on supplied print-layout references: point-up hex silhouette clipped into part-hex perimeter pieces, offset variant with alternating edge cuts, full-hex rounded cluster, and full-hex staggered square cluster.
- [x] Cropped perimeter pieces can be flat at the model base or carry sampled terrain relief. Other pieces always carry terrain, with the same printable clearance setting.
- [x] Target number of pieces (7–150) with actual counts shown; whole-hex ring or square cluster sizes may be approximate by construction.
- [x] Existing preview, spreading, per-piece STL/numbered SVG, assembled/plate 3MF exports use the same independent hex-cell meshes.
- [x] Optional explicit unlock for model widths exceeding 1,000 mm, capped at 5,000 mm, with exact numeric input and warnings. The default remains 1,000 mm; heightfield sample density retains its prior limits.
- [ ] Acceptance on real hardware: inspect printed seams, flat-border height choices and 3MF component manifolds in a slicer; benchmark 460, 1,000 and 5,000 mm and many-piece combinations.

## v1.8.1 — Geometry corrections after real-world Hex Grid screenshots

- [x] Replace arbitrary selected-total optimization (which could intersect cells at hairline corners) with exact integer lattice ring tiers for both clipped six-sided boards.
- [x] Replace rounded hex approximate count input with preset complete ring totals: 7, 19, 37, 61, 91, 127 whole hexagons.
- [x] Replace square approximate target total with a **single N across/down input**, producing exactly N² full hexagons (N=2–12).
- [x] Use regular flat-top interior hexagons and a matching lattice for all four patterns; ensure board coverage prior to individual clearance.
- [x] Update geometry tests for coverage/area, edge sliver threshold, N² count, frame-free spread/exports and flat versus sampled perimeter.
- [ ] Confirm printed edge fit and high-resolution preview on user's machine; check that no clipped border cells are omitted at their chosen clearance and ring size.

## v1.8.2 — Terrain sidewall boundary consistency and numeric entry

- [x] Prevent straight, false vertical "curtains" on terrain-piece edges by preserving intermediate (collinear XY) perimeter vertices whose DEM heights are distinct; include the same height-sampled vertices in top and sidewall triangulation.
- [x] Use requested mesh spacing for edge sampling rather than 1.5× coarser than the print grid; leave constant-height geometry simplified.
- [x] Make latitude, longitude, selected terrain region width and physical model width explicitly editable with always-visible side increment/decrement arrow buttons.
- [x] Preserve exact 1 mm typed model widths independent of the approximate 5 mm model-width slider, including source-based planning and exported 3MF/STL.
- [x] Add regression checks for terrain wall height vs original DEM, matched wall/top boundary vertices and numeric input/stepper controls.
- [ ] User validation: inspect the same crater/ridge edge close-up in v1.8.2 and slice exported per-piece STLs to confirm no residual triangulation artifacts.
