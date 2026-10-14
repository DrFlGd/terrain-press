# Terrain Press — Project status and next milestones

**Updated:** 2026-10-13  ·  **Current Windows release:** [v1.8.3](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.8.3)  ·  **Supported bodies:** 7

This is the **current** status summary. The [terrain data roadmap](TERRAIN-DATA-ROADMAP.md) contains implementation history, detailed requirements and research notes; [Windows instructions](WINDOWS.md) explain the downloadable desktop app. A **working download or render is not the same as a scientific validation of absolute elevations, datum, missing-data coverage or complete offline export behavior**.

## Supported worlds and optional elevation upgrades

All seven bodies have offline, built-in elevation grids and selected locally sharper landmark patches. The optional upgrades below improve **printable terrain elevation**; they are not photographic/color surface texture packs.

| Body | Bundled global elevation grid | Optional higher-resolution DEM/DTM in desktop manager | Field feedback (as of 2026-10-13) | Remaining acceptance |
|---|---|---|---|---|
| **Moon** | 8,192 × 4,096 | NASA LOLA 128, 256, 512 px/degree (237, 118, 59 m/pixel at equator) | Download tiers implemented; a complete user-validated Moon transfer/export cycle was not reported here | Validate a complete large download, data interpretation and offline export/removal; test source coverage |
| **Mars** | 8,192 × 4,096 | NASA MOLA 64 px/degree (~925 m/pixel) | **User confirmed the Mars download and terrain render work** | Independently compare archive heights at known coordinates, datum and masks; complete offline restart/export/remove acceptance |
| **Mercury** | 10,240 × 5,120 | USGS MESSENGER 64 px/degree (~665 m/pixel) | **User confirmed the integration functions** | Record exact download/render/export test cases; verify longitude/height values and NoData against the source |
| **Ceres** | 8,192 × 4,096 | USGS Dawn HAMO 60 px/degree (~137 m/pixel) | **User confirmed the integration functions** | Confirm actual vertical reference, valid coverage, NoData and independent measured heights |
| **Vesta** | 8,192 × 4,096 | USGS Dawn HAMO 48 px/degree (~93 m/pixel) | **User confirmed the integration functions** | Check radius-to-height conversion, Claudia double-prime longitudes, real values and coverage |
| **Venus** | 8,192 × 4,096 | **None** | Included terrain supported | Known global Magellan elevation products do not clearly improve on the bundled effective resolution; identify a meaningful validated regional upgrade before adding one |
| **Pluto** | 8,192 × 4,096 | **None**; selected sharp terrain is already bundled locally | Included terrain supported | High-resolution New Horizons DEM data are not global. Develop partial-area downloads, measured-coverage mask and source provenance without implying the unseen areas were surveyed |

**Validation notation:** “User confirmed” reflects successful functioning in the user's installation, **not** a recorded independent metrology audit, source-pixel comparison, test of every exported file, or a repeatable remote integration test. Mercury, Ceres and Vesta remain marked *beta* in the current catalog until those additional acceptance checks are recorded. The current downloader's published/catalog status means *available to install*, not that every product passed scientific acceptance.

## Features shipped through v1.8.3

- **Seven offline worlds**, global elevation and landmark selection by latitude, longitude and region width; finer sources used when installed and valid. Download manager identifies the applicable body for every pack.
- **Print formats:** terrain ornaments, square/circular/hexagon puzzles, and four **Hex Grid** arrangements with flat or terrain-relief cut-edge pieces; spread-print preview, independent puzzle-part STL files, assembled 3MF and ZIP outputs.
- **Hex Grid iteration:** lattice-locked ring presets, exact N × N whole-hex square grids, terrain-sampled sidewalls (no spurious peak-to-peak curtains) and centered, symmetrical clipped-board layouts. Automated symmetry tests passed in v1.8.3; user confirmation of that newest correction is still welcome.
- **Detail controls:** source-/printer-aware Automatic mode, Advanced 721/1,441/2,881 sample ceilings and 0.50/0.35/0.25 mm spacing presets, high-detail preview matching export and fast default preview.
- **Large models and precise entry:** model widths to 1,000 mm normally and **5,000 mm with explicit unlock**; editable lat/lon, region width and exact printed width with arrow steppers; high-resource warnings.
- **Optional source drivers:** native NASA lunar LOLA/Martian MOLA IMG download and on-demand elevation PNG tiles; USGS GeoTIFF driver for Mercury/Ceres/Vesta, including body-specific signed-height interpretation and a bundled fallback for missing elevation samples.
- **Io groundwork (not a new available body):** source inventory, ISIS3/GeoTIFF GDAL preflight and research requirements committed under `tools/io/`.

## Still open: acceptance and technical limitations

- **Real-data verification:** For Mercury, Ceres, Vesta and Mars, store the tested product/version, sample coordinates and source values, projection direction, height zero, masks, and rendered/exported 3MF/STL comparisons. Field feedback is encouraging, but none of this should be silently declared complete.
- **Release-quality download robustness:** Exercise cancelled/resumed downloads, missing or corrupt files, file hashes, low disk space, directory changes, upgrade, unplugged/offline restart, removal and fallback; run full Moon 128/256/512 tier tests as resources allow.
- **Quality/coverage disclosure:** Built-in Venus/Pluto contain filled gaps and nonuniform observations. Differentiating measured vs interpolated elevations on a map and in export metadata is a priority, especially for future Pluto and Io packs.
- **Performance and quality:** Uniform heightfield cap 2,881²; dense 460–5,000 mm puzzles can require substantial RAM and very large sliced files. Adaptive triangulation, cancellable/budgeted meshing and physical print-fit tests remain future work.
- **Resolution vs imagery:** Extra color/globe imagery does not improve 3D print relief. An optional high-resolution globe **imagery** pack could be a separate visual enhancement, whereas printable height resolution requires a better DEM.

## Prioritized development plan (proposed, not yet implemented)

1. **Close the existing planetary acceptance loop.** Record reproducible Mercury/Ceres/Vesta and Mars results, remove beta labels only after source-value and offline-export checks, verify Moon downloads and capture failures. This is verification work, not reimplementation of functioning downloads.
2. **Implement geographically bounded regional terrain downloads with coverage/provenance masks.** Use coordinate windows, data overlap, seams, poles and dateline handling. This unlocks honest high-detail **Pluto** regional products and efficient downloads for other worlds.
3. **Resume Io as the next new celestial body.** Obtain and inspect original White et al. `IoDEM.cub` (the automated supplement request was blocked); test the Tvashtar regional GeoTIFF; validate datum, coordinate frames and ~75% observed coverage before a bundled Io base map or optional pack is exposed.
4. **Evaluate Venus elevation improvements.** Prioritize real regional or demonstrably finer, properly calibrated elevation products, not a larger raster containing interpolated versions of the existing measurements.
5. **Improve mesh scalability.** Add spatially adaptive terrain meshing, geometry/memory/output-size budgets, cancellable heavy operations, and slicer tests at 460, 1,000 and unlocked larger dimensions.
6. **Optional UX and imaging.** Source-coverage overlays, clearer download source confidence and quality, storage migration/disk quotas, and optionally better globe imagery (distinct from elevation).

### Acceptance checklist for any optional elevation pack

- [ ] Verify source identity, permanent reference, rights, downloaded product/version, dimensions and SHA-256 (local receipts alone are not a provider-signed checksum).
- [ ] Compare at least three independent high/low/ordinary coordinates with the original archive; explicitly confirm latitude/longitude directions, radius or height datum, units, NoData and valid geographical coverage.
- [ ] Confirm preview and exported individual STL/assembled 3MF use the selected dataset consistently and that imported meshes are printable/watertight.
- [ ] Restart without network access, move between installed and bundled sources, cancel/resume where supported, remove the dataset and confirm correct fallback.
- [ ] Record any mismatches, RAM/CPU/disk footprint and slicer behavior; update dataset status or quality warnings only when the evidence supports the change.

**Latest field feedback recorded:** On 2026-10-13, the user confirmed **Mercury, Ceres and Vesta function correctly**. Earlier feedback confirmed **Mars downloaded and rendered** and that the spread-puzzle view worked. No additional scientific or offline acceptance steps were expressly reported with that feedback.
