# Terrain Press — Project status and next milestones

**Updated:** 2026-10-25  ·  **Current Windows testing release:** [v1.19.1](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.19.1)  ·  **Supported worlds:** 12 (eight terrain worlds: Moon, Mars, Mercury, Venus, Earth, Ceres, Vesta, Pluto; four giant planets: Jupiter, Saturn, Uranus, Neptune)

## Recent releases

| Release | Date | Change |
|---|---|---|
| [v1.19.1](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.19.1) (#12) | 2026-10-24 | Hexagon ornaments build again at every width and detail level. Rounding left one-ulp slopes on the outline's flat edges, which poly2tri rejected as "Collinear not supported". |
| [v1.19.0](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.19.0) (#11) | 2026-10-24 | Settings grouped into Place, Model, Colors, Frame and Print tabs; Color contrast slider (1.0×–3.0×) spreads sampled palettes apart and is recorded as `colorContrast` in exports; the Terrain data manager opens from a top-bar button. |
| [v1.18.0](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.18.0) (#10) | 2026-10-24 | Saturn, Uranus and Neptune share Jupiter's cloud-print workflow; color detail reaches 1024 cells across; color-cell clipping rewritten to remove a poly2tri failure and overlapping step walls. See [giant planets](GIANT-PLANETS.md). |
| v1.17 (#9) | 2026-10-23 | Earth paint imagery increases to 21600 × 10800 (about 1.85 km/pixel), with an 8K globe overview and offline regional tile sampling. See [surface colors](SURFACE-COLORS.md). |
| v1.16 (#8) | 2026-10-22 | Earth, Mars, Mercury and Venus join the Moon's imagery-painting workflow: 2–8 editable colors, real terrain, colored 3MFs and print guides. |

Earlier dated milestones below are historical; the [terrain data roadmap](TERRAIN-DATA-ROADMAP.md) keeps the full implementation history.

This is the **current** status summary. The [terrain data roadmap](TERRAIN-DATA-ROADMAP.md) contains implementation history, detailed requirements and research notes; [Windows instructions](WINDOWS.md) explain the downloadable desktop app. A **working download or render is not the same as a scientific validation of absolute elevations, datum, missing-data coverage or complete offline export behavior**.

## Earth resolution upgrades (v1.11.0 testing)

Earth is implemented with a 4096 × 2048 offline ETOPO base and optional NOAA 60s/30s global relief and selected-area Copernicus 30 m/90 m surface downloads. Availability/size checks, resume, offline storage, removal and layered fallback are implemented. The full source was downloaded and decoder values checked; Windows lifecycle and slicer acceptance remain open. See [EARTH.md](EARTH.md). On 2026-10-15 the user reported that the Earth upgrade release works great; specific offline lifecycle and slicer acceptance cases were not reported. The seven-body table below preserves prior planetary acceptance history.

## Supported worlds and optional elevation upgrades

The table covers the seven non-Earth terrain worlds; Earth is described above and the four giant planets, which print color bands rather than elevation, in [GIANT-PLANETS.md](GIANT-PLANETS.md). All seven bodies have offline, built-in elevation grids and selected locally sharper landmark patches. The optional upgrades below improve **printable terrain elevation**; they are not photographic/color surface texture packs.

| Body | Bundled global elevation grid | Optional higher-resolution DEM/DTM in desktop manager | Field feedback (as of 2026-10-13) | Remaining acceptance |
|---|---|---|---|---|
| **Moon** | 8,192 × 4,096 | NASA LOLA 128, 256, 512 px/degree (237, 118, 59 m/pixel at equator) | Download tiers implemented; a complete user-validated Moon transfer/export cycle was not reported here | Validate a complete large download, data interpretation and offline export/removal; test source coverage |
| **Mars** | 8,192 × 4,096 | NASA MOLA 64 px/degree (~925 m/pixel) | **User confirmed the Mars download and terrain render work** | Independently compare archive heights at known coordinates, datum and masks; complete offline restart/export/remove acceptance |
| **Mercury** | 10,240 × 5,120 | USGS MESSENGER 64 px/degree (~665 m/pixel) | **User confirmed the integration functions** | Record exact download/render/export test cases; verify longitude/height values and NoData against the source |
| **Ceres** | 8,192 × 4,096 | USGS Dawn HAMO 60 px/degree (~137 m/pixel) | **User confirmed the integration functions** | Confirm actual vertical reference, valid coverage, NoData and independent measured heights |
| **Vesta** | 8,192 × 4,096 | USGS Dawn HAMO 48 px/degree (~93 m/pixel) | **User confirmed the integration functions** | Check radius-to-height conversion, Claudia double-prime longitudes, real values and coverage |
| **Venus** | 8,192 × 4,096 | **NASA Magellan stereo DEM beta · 600 m raster, ~1–2 km effective resolution; approximately 20% observed** | Header and native sample bytes verified against NASA; full ~2.97 GB install **not user-tested** | Inspect actual postinstall mask, independently verify elevations, then full offline STL/3MF/download lifecycle. Bundled elevation remains fallback outside measured coverage |
| **Pluto** | 8,192 × 4,096 | **None**; selected sharp terrain is already bundled locally | Included terrain supported | High-resolution New Horizons DEM data are not global. Develop partial-area downloads, measured-coverage mask and source provenance without implying the unseen areas were surveyed |

**Validation notation:** “User confirmed” reflects successful functioning in the user's installation, **not** a recorded independent metrology audit, source-pixel comparison, test of every exported file, or a repeatable remote integration test. Mercury, Ceres and Vesta remain marked *beta* in the current catalog until those additional acceptance checks are recorded. The current downloader's published/catalog status means *available to install*, not that every product passed scientific acceptance.

## Features shipped through v1.9.1

- **Seven offline worlds**, global elevation and landmark selection by latitude, longitude and region width; finer sources used when installed and valid. Download manager identifies the applicable body for every pack.
- **Print formats:** terrain ornaments, square/circular/hexagon puzzles, and four **Hex Grid** arrangements with flat or terrain-relief cut-edge pieces; spread-print preview, independent puzzle-part STL files, assembled 3MF and ZIP outputs.
- **Hex Grid iteration:** lattice-locked ring presets, exact N × N whole-hex square grids, terrain-sampled sidewalls (no spurious peak-to-peak curtains) and centered, symmetrical clipped-board layouts. Automated symmetry tests passed in v1.8.3; user confirmation of that newest correction is still welcome.
- **Detail controls:** source-/printer-aware Automatic mode, Advanced 721/1,441/2,881 sample ceilings and 0.50/0.35/0.25 mm spacing presets, high-detail preview matching export and fast default preview.
- **Large models and precise entry:** model widths to 1,000 mm normally and **5,000 mm with explicit unlock**; editable lat/lon, region width and exact printed width with arrow steppers; high-resource warnings.
- **Optional source drivers:** native NASA lunar LOLA/Martian MOLA IMG, **Venus stereo native float32 IMG (coverage-limited beta)** and USGS GeoTIFF for Mercury/Ceres/Vesta, including body-specific signed-height interpretation, observed-sample masks and bundled fallback.
- **New elevation-coverage globe legend:** opt-in overlay distinguishes measured Venus stereo areas from fallback, and distinguishes nominal installed grids and local bundled patches on other worlds. Source-native Venus validity fractions appear on selected-region preview and in exported ZIP metadata.
- **Io groundwork (not a new available body):** source inventory, ISIS3/GeoTIFF GDAL preflight and research requirements committed under `tools/io/`.

## Still open: acceptance and technical limitations

- **Real-data verification:** For Mercury, Ceres, Vesta and Mars, store the tested product/version, sample coordinates and source values, projection direction, height zero, masks, and rendered/exported 3MF/STL comparisons. Field feedback is encouraging, but none of this should be silently declared complete.
- **Release-quality download robustness:** Exercise cancelled/resumed downloads, missing or corrupt files, file hashes, low disk space, directory changes, upgrade, unplugged/offline restart, removal and fallback; run full Moon 128/256/512 tier tests as resources allow.
- **Quality/coverage disclosure:** Built-in Venus/Pluto contain filled gaps and nonuniform observations. Venus has an **initial measured-pixel coverage legend** but full per-product provenance and confidence masks remain a priority, especially for future Pluto and Io packs.
- **Performance and quality:** Uniform heightfield cap 2,881²; dense 460–5,000 mm puzzles can require substantial RAM and very large sliced files. Adaptive triangulation, cancellable/budgeted meshing and physical print-fit tests remain future work.
- **Resolution vs imagery:** Extra color/globe imagery does not improve 3D print relief. An optional high-resolution globe **imagery** pack could be a separate visual enhancement, whereas printable height resolution requires a better DEM.

## Feature parking lot

**Water level with separate water/terrain export colors** is deferred at the user's request (2026-10-15), with no scheduled implementation or release. Proposed scope includes an adjustable elevation level, flat water surface, separate printable water/terrain volumes, colored 3MF parts and separate STL parts. See the [roadmap parking lot](TERRAIN-DATA-ROADMAP.md#feature-parking-lot--deferred-not-scheduled) for geometry, water-mask and acceptance considerations.

## Next round: parity and settings follow-ups (proposed 2026-10-24)

Two reviews after v1.18–v1.19 recommend finishing parity across the twelve worlds before adding new worlds or features. None of these is scheduled yet.

**World parity and quality**

1. **Independent CI smokes.** Later smoke steps in `integration-check.yml` skip when an earlier one fails; add `if: always()` or split them into parallel jobs so one world cannot hide another.
2. **Browser export checks for Ceres, Vesta and Pluto**, including Pluto's unmapped-area warning, so every world has an end-to-end run.
3. **Earth bundled relief at 8192 × 4096.** Earth's bundled grid is 9.8 km/pixel, four to fifty times coarser than other rocky worlds without an optional download; the larger base adds about 30 MB.
4. **Imagery painting for Ceres, Vesta and Pluto** from Dawn Framing Camera and New Horizons color mosaics, reusing `tools/surface/prepare.py`.
5. **Warn when color detail exceeds the source image**, using the worker's `sourceStepMm`; 1024 cells oversample every giant map 4–11×.
6. **Refresh DATA.md and the README** for twelve worlds and document the imagery-only giant layout.
7. **Quantizer corner cleanup** for the rare non-manifold edge where four wall faces meet at a color-cell corner, plus a watertightness fuzz in the node tests.

**Settings UI**

1. **Numbered swatches** (1–8) matching the color-changes CSV, print guide and preview legend.
2. **One name for color detail**: giants say "Color detail" (48–1024 cells), surface painting says "Color sampling" (128–1024).
3. **Step arrows on the remaining number fields** (base, frame, rim, pieces, clearance, print gap, back thickness, hexes across).
4. **Trim repeated hints** between the Print tab notes, the export note and the PDF guide.
5. **Theme the Globe coverage legend** and the data manager border for the light theme.
6. **World strip overflow cue** so narrow windows show that more worlds sit to the right.
7. **Shareable settings URL** so a print can be reopened exactly.

## Prioritized development plan (proposed, not yet implemented)

The longer-term plan below predates the giant planets and still applies after the next round above.

1. **Close the existing planetary acceptance loop.** Record reproducible Mercury/Ceres/Vesta and Mars results, remove beta labels only after source-value and offline-export checks, verify Moon downloads and capture failures. This is verification work, not reimplementation of functioning downloads.
2. **Implement geographically bounded regional terrain downloads with coverage/provenance masks.** Use coordinate windows, data overlap, seams, poles and dateline handling. This unlocks honest high-detail **Pluto** regional products and efficient downloads for other worlds.
3. **Resume Io as the next new celestial body.** Obtain and inspect original White et al. `IoDEM.cub` (the automated supplement request was blocked); test the Tvashtar regional GeoTIFF; validate datum, coordinate frames and ~75% observed coverage before a bundled Io base map or optional pack is exposed.
4. **Validate and optimize the new Venus Magellan stereo beta.** Confirm complete installation, actual valid geographic pixels, height reference, and exports; then prioritize cropped/region-specific downloads over mandatory whole-source transfers.
5. **Improve mesh scalability.** Add spatially adaptive terrain meshing, geometry/memory/output-size budgets, cancellable heavy operations, and slicer tests at 460, 1,000 and unlocked larger dimensions.
6. **Optional UX and imaging.** Source-coverage overlays, clearer download source confidence and quality, storage migration/disk quotas, and optionally better globe imagery (distinct from elevation).

### Acceptance checklist for any optional elevation pack

- [ ] Verify source identity, permanent reference, rights, downloaded product/version, dimensions and SHA-256 (local receipts alone are not a provider-signed checksum).
- [ ] Compare at least three independent high/low/ordinary coordinates with the original archive; explicitly confirm latitude/longitude directions, radius or height datum, units, NoData and valid geographical coverage.
- [ ] Confirm preview and exported individual STL/assembled 3MF use the selected dataset consistently and that imported meshes are printable/watertight.
- [ ] Restart without network access, move between installed and bundled sources, cancel/resume where supported, remove the dataset and confirm correct fallback.
- [ ] Record any mismatches, RAM/CPU/disk footprint and slicer behavior; update dataset status or quality warnings only when the evidence supports the change.

**Latest field feedback recorded:** On 2026-10-13, the user confirmed **Mercury, Ceres and Vesta function correctly**. Earlier feedback confirmed **Mars downloaded and rendered** and that the spread-puzzle view worked. No additional scientific or offline acceptance steps were expressly reported with that feedback.

## v1.9.2 — Two source-download error corrections (pending user retest)

Moon LOLA 256 ppd failed near 50% because Terrain Press requested the non-existent `ldem_256_90s_00n_000_180.img`; the NASA southern filename ends in `90s_00s`. This also affects the analogous 512 ppd filenames. The fix preserves downloaded source files in the incomplete staging directory. The first Venus stereo attempt failed because actual NASA PDS4 coordinate tags carry a `cart:` XML namespace prefix; parsing was corrected against the real archive label. Both have regression tests; full post-fix Windows transfer, source-value comparison and offline geometry export remain to be recorded.
