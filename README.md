# Terrain Press

**Turn real NASA elevation data into 3D-printable ornaments and jigsaw puzzles. Free, open source, no account, no paywall.**

Pick a place on Earth, the Moon, Mars, Mercury, Ceres, Vesta, Venus or Pluto, choose a shape and a size, and download print-ready STL and 3MF files. Everything is computed in your browser from real spacecraft measurements; nothing is uploaded anywhere.

**Use it now:** <https://ianbauters.github.io/terrain-press/>

**Upstream printing improvements (v1.0.1–v1.1.0):** stronger corners on traditional hexagon jigsaws, a PDF print guide in each download, and puzzle exports containing spaced print plates plus numbered single-piece STLs.

## Earth support

Earth includes a bundled offline NOAA ETOPO base map, five landmarks, and optional global upgrades at 60 arc-seconds (~466 MB) and 30 arc-seconds (~1.59 GB), plus selected-area Copernicus downloads at 30 m or 90 m in the desktop manager. Ocean depths and ice-surface heights are preserved. See [Earth data and validation](docs/EARTH.md).

## Why this exists

There are services that charge per download for exactly this kind of file. The elevation data behind them is public domain, paid for by taxpayers and published by NASA, the USGS and their partners for anyone to use. Terrain Press is a free alternative: the tool itself is open source, and so is every file it makes.

## What it makes

- **Ornaments**: a terrain disc, square or hexagon in a frame, with optional lettering (place name and coordinates) and a hanging loop.
  - Print it as one piece, or as two single-colour prints (terrain + frame) if you don't have a multi-colour printer.
- **Jigsaw puzzles** cut to follow the shape: rings for circles, nested hexagons for hexagons, a grid for squares.
  - A large centre piece keeps the landmark whole.
  - A closed-back tray holds the pieces.
  - Pieces can be spread apart for printing, or exported one STL per piece with a numbered map, so a lost piece is a single reprint.
- **Settings**: relief exaggeration, rim height, base thickness, clearances, three lettering styles and mesh detail.

Landmarks are built in: every Apollo landing site, Mars landers and rovers from Viking to Perseverance, the Soviet Venus landers, Rheasilvia on Vesta, Sputnik Planitia on Pluto and more. Or click anywhere on the globe.

## Run it yourself

**Docker (NAS, home server):**

```sh
docker run -d --name terrain-press -p 8085:80 --restart unless-stopped ghcr.io/ianbauters/terrain-press:latest
```

Then open `http://<your-server>:8085`. Images are built for amd64, arm64 and armv7, so they run on Intel and ARM Synology, QNAP, Raspberry Pi and so on.

Prefer Compose (Synology Container Manager → Project)? Use the [`docker-compose.yml`](docker-compose.yml) in this repo.

**Any web server:** the [`site/`](site) folder is the whole app. Copy it anywhere that serves static files, or try it locally:

```sh
python3 -m http.server 8080 --directory site
```

It works fully offline: all libraries and fonts are bundled.

## Developing

The page is built from [`source/`](source):

```sh
npm install
python3 source/build.py   # writes site/index.html, core.js, worker.js and site/lib/
```

- `source/core.js` holds the geometry: elevation sampling, triangulation, jigsaw cuts, frames, lettering, and the STL/3MF/ZIP writers.
- `source/worker.js` runs it off the main thread.
- `source/app.js` and `source/src.html` are the interface (Bootstrap 5, three.js).

[`docs/DATA.md`](docs/DATA.md) describes every dataset, how it was processed and the tile format, if you want to add a world.

## Credits and licence

Terrain Press is © Ian Bauters and contributors, licensed under the **GNU AGPL-3.0-or-later** ([LICENSE](LICENSE)).

- You may use, change and share it freely.
- If you run a modified version as a public website, you must publish your source code too.
- Files you make with it are yours, and the underlying data is public domain.

Elevation data comes from NASA, the USGS Astrogeology Science Center, DLR and the NASA Planetary Data System. Libraries and fonts are under MIT, BSD, Boost and SIL OFL licences. Full details are in [CREDITS.md](CREDITS.md) and [LICENSES/](LICENSES).

This is a decorative representation, not survey-grade data, and is not endorsed by NASA, the USGS or DLR.

## Windows desktop app

A portable, offline Windows executable is built automatically by GitHub Actions. Download [Terrain Press v1.19.1 Portable](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.19.1) from the official release page. No browser, server, Node.js or Python is needed. See [Windows build and usage instructions](docs/WINDOWS.md) and the [current project status and future milestones](docs/PROJECT-STATUS.md).

## Current progress and data validation

**As of 2026-10-25 (v1.19.1):** twelve worlds are selectable: eight terrain worlds (Moon, Mars, Mercury, Venus, Earth, Ceres, Vesta, Pluto) and four giant planets (Jupiter, Saturn, Uranus, Neptune) printed as stacked color bands. See [recent releases](docs/PROJECT-STATUS.md#recent-releases) and the [proposed next round](docs/PROJECT-STATUS.md#next-round-parity-and-settings-follow-ups-proposed-2026-10-24). The paragraph below is the 2026-10-13 elevation validation record.

**As of 2026-10-13 (v1.8.3):** Seven celestial bodies are printable offline. Moon LOLA 128/256/512, Mars MOLA 64, Mercury MESSENGER 64, Ceres Dawn 60 and Vesta Dawn 48 are available as optional higher-resolution **elevation** datasets. The user has **confirmed Mars successfully downloads/renders** and **confirmed Mercury, Ceres and Vesta function** in their installation. These are positive real-world results; independent source-height/datum checks and the full offline/export/removal matrix remain open, so the relevant beta product labels have **not** been changed. Venus now has a separately downloadable **partial-coverage Magellan stereo elevation beta (~20% observed)**; Pluto still has no optional higher-resolution elevation pack. Venus's stereo raster is not a complete global DEM.

Delivered printing features now include **four Hex Grid layouts**, centered clipped-edge symmetry, sampled terrain-matched sidewalls, whole-hex round rings and exact square N × N grids, as well as source-aware meshing and an optional **5,000 mm** width unlock. **Io** has a research source catalog and GDAL preflight tooling but is **not selectable or installable**.

See **[Project status and next milestones](docs/PROJECT-STATUS.md)** for the world-by-world table, known limitations, acceptance criteria and next priorities. The detailed [terrain-data roadmap](docs/TERRAIN-DATA-ROADMAP.md) preserves each implementation stage.

## Hybrid dataset roadmap (Windows)

The [terrain data roadmap](docs/TERRAIN-DATA-ROADMAP.md) documents the hybrid system. Starting with **Windows v1.2.0**, the Terrain Data Manager can download the complete Moon in NASA PDS LOLA 128, 256 or 512 pixels-per-degree native IMG files directly from the [PDS Geosciences Node](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/). Download sizes are 2.12, 8.49 and 33.97 GB, respectively, plus locally cached tiles. Downloads may be resumed and the datasets work offline after installation. The original bundled terrain is always available. The first additional planet download, **Mars MOLA 64 px/degree beta**, is now available through the manager. Mercury, Ceres and Vesta now have separately selectable **beta USGS GeoTIFF** upgrades. Venus now has a **coverage-limited Magellan stereo DEM beta**, with actual measured-pixel masks and bundled fallback; Pluto remains a future partial-coverage upgrade.

### Source-matched export (v1.3.0)

The **Print → Terrain resolution → Automatic** mode plans a useful STL/3MF sample grid using the finest installed geographically valid DEM, physical print dimensions and printable-feature size. Its memory safety ceiling is 2,881 × 2,881 height samples; automatic planning often uses substantially fewer. The exported ZIP's README records the terrain source, sample grid size, actual model spacing and cap status. Existing Standard, Fine and Ultra presets remain available. The terrain sampler now fixes an error when switching from an 83 m landmark patch to a downloaded NASA IMG dataset: cached PNG tiles are read as PNGs instead of being incorrectly looked up as WebP files. **True geometric adaptive/quadtree meshing** is a separate next-phase milestone to improve fidelity while limiting output complexity.

### High-detail preview and 1,000-mm puzzles (v1.4.0)

Choose **Print → High-detail preview (match export)** to render the actual detail/heightfield used by the selected export preset before creating the 3MF. The switch is off by default to preserve smooth editing. The preview displays the resulting sample grid, spacing and cap status. The terrain width slider now supports **up to 1,000 mm**, and the 3D camera/virtual build plate scales to fit large puzzle models. Sampling uses the resolution mode and a hard maximum of **2,881 × 2,881**, with warnings for especially large grids. Large puzzles may still need to be arranged as individual pieces for printing.

### Configurable elevation sampling (v1.5.0)

The Print panel now provides **Terrain sampling limit: Auto / 721² / 1,441² / 2,881²** and a **Smallest printable feature** selector (0.2–1.0 mm, default 0.4 mm). With **Sampling Limit → Auto**, the elevation sampler derives a useful sampling interval from the best available DEM's pixel spacing projected onto the print (about 1.5 interpolation samples per raster pixel) and the physical feature size the printer can resolve (about 2 height samples per feature). It selects the less demanding spacing and does not generate redundant geometry beyond either bound. A live readout estimates the actual grid, source spacing on the model and whether the limit is reached. Users who need additional fidelity may select explicit ceilings, though these override the waste-avoiding Auto rule and can demand much more memory. **The 2,881² ceiling is a practical bound on heightfield sampling, not a guarantee of slicer compatibility or of recorded DEM accuracy.** Automatic sampling is still uniformly spaced; curvature-adaptive triangulation remains a future roadmap phase.

### Simpler print resolution (v1.5.1)

**Print → Terrain resolution** now starts in **Automatic** mode. Set just the **Smallest printable feature** (default 0.4 mm); the existing DEM-/print-aware planner chooses the useful grid size with no competing resolution controls. Select **Advanced** to expose **mesh spacing** (Standard 0.50 mm, Fine 0.35 mm, Ultra 0.25 mm) and **maximum sample grid** (721, 1,441 or 2,881 per side). Advanced intentionally bypasses the printer-feature optimization. The fast preview remains independent; enabling **High-detail preview (match export)** renders the current export settings. This is a UI organization change, not a new terrain algorithm.

**Current priority (see the [project status](docs/PROJECT-STATUS.md)):** finish repeatable source-height and offline/export validation of existing Mars/Mercury/Ceres/Vesta beta datasets, then add regional and coverage-aware terrain downloading. Venus Magellan stereo beta and coverage overlay now need a complete Windows download and real-source export test; Pluto still needs partial-coverage downloading. Io remains a separate research milestone.

### Mars download trial and large-puzzle spread preview (v1.6.0)

**Fix:** Spreading puzzle pieces for printing now handles layouts without a border/frame, including large 460-mm models. The preview coordinates are centered and finite even if no separate frame geometry is present.

**Mars beta:** Open **Terrain Data Manager → MOLA MEGDR 64 px/degree · Mars beta**. Terrain Press downloads four original 16-bit, big-endian topography files directly from NASA's [maintained MOLA PDS4 bundle](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html), about **530.84 MB (506 MiB)**, plus on-demand PNG cache tiles. The MOLA 64 product covers the full planet and is ~925 metres/sample at Mars's equator, finer than the built-in Mars 8192 × 4096 base grid. No user data leaves your machine during mesh creation; the files remain accessible offline after download.

**Beta limitation:** Source product filenames, coverage and tile geometry follow NASA PDS documentation and synthetic coordinate/value tests. The release initially lacked a complete real-world download test; **subsequent user feedback confirms that Mars downloaded and rendered on Windows**. Independent source-height comparisons, PDS label audit, and the full offline 3MF/export lifecycle have not been documented. Please treat this as a validation test, not yet a verified production dataset. Failed downloads should retain partial IMG files for resumption; the bundled Mars data remains available if the beta pack is not installed.

### Other-world GeoTIFF beta downloads (v1.7.0)

The **Terrain Data Manager** adds three independent DEM upgrades via USGS Astrogeology source products (not reflectance or color mosaics):

| World | Source DEM | Global raster | Approx. source download | Notes |
|---|---|---|---|---|
| Mercury | [MESSENGER MDIS Global DEM v2](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m) | 23,040 × 11,520 (64 px/degree) | ~506 MB | Elevation relative to Mercury's reference surface |
| Ceres | [Dawn FC2 HAMO Global DTM](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc2_hamo_global_dtm_137m) | 21,600 × 10,800 (60 px/degree) | ~446 MB | Elevation above 470 km reference sphere; ~98% observed, some shadows interpolated |
| Vesta | [Dawn FC HAMO DTM](https://astrogeology.usgs.gov/search/map/vesta_dawn_fc_hamo_global_dtm_93m) | 17,280 × 8,640 (48 px/degree) | ~570 MB | Radius from center; converted to elevation from 255 km; ~95% stereo coverage; Claudia Double Prime orientation |

These are **beta test downloads**; they are available and **Mercury, Ceres and Vesta were user-confirmed functional on 2026-10-13**, but scientific data-value validation and full lifecycle acceptance are not yet recorded. Each GeoTIFF remains on the user's external dataset drive, is checked for raster dimensions and number of bands, locally hashed, and decoded into only the needed PNG elevation tiles on demand. The decoder uses signed 24-bit RGB for larger elevations and falls back to bundled lower-resolution data at masked/NoData pixels. Existing Moon and Mars native NASA IMG data use their original importer and are unchanged.

**Why not add Venus and Pluto now?** The available [Venus Magellan GTDR global topography](https://astrogeology.usgs.gov/search/map/venus_magellan_global_topography_4641m) has ~4.64 km pixels, comparable to the bundled Venus 8,192 × 4,096 grid. High-resolution [Pluto/Charon New Horizons DEM coverage](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=NH-P%2FPSA-LORRI%2FMVIC-5-GEOPHYS-V1.0) is partial; treating that as a global observed DEM would be misleading. Both need distinct handling, particularly for coverage and data provenance.

Test the new worlds separately: download a beta pack, choose that world, compare a named landmark before/after installation, export an STL/3MF, restart offline, and remove the pack to confirm the included DEM returns. A full transfer has **not** been run in CI; please report any URL, TIFF metadata, or out-of-memory errors you encounter.

### Clear dataset-to-world labels (v1.7.1)

Every **Terrain Data Manager** row now identifies its supported celestial body directly with **Applies to: Moon (Earth's moon)**, **Mars (planet)**, **Mercury (planet)**, **Venus (planet)**, **Ceres (dwarf planet)**, **Vesta (asteroid)**, or **Pluto (dwarf planet)**. This applies to both the bundled/offline datasets and optional Moon LOLA, Mars MOLA, Mercury MESSENGER, Ceres Dawn, and Vesta Dawn downloads. Download confirmations now name the destination world and dataset rather than assuming every download has the same NASA IMG format. No data files are changed.

### Io — next new-world research milestone

Io, Jupiter's volcanic moon, is now documented in the [terrain-data roadmap](docs/TERRAIN-DATA-ROADMAP.md#next-new-world-candidate--io-jupiters-volcanic-moon-research-milestone). The candidate global source is the ~75%-coverage 2014 White et al. Voyager/Galileo stereo `IoDEM.cub`; an independent 900-m Tvashtar Paterae GeoTIFF offers a promising regional test. The repository includes a non-installable [Io source inventory](tools/io/sources.json), a guarded [GDAL preflight CLI](tools/io/preflight.js) and tests. **Io is not yet selectable or downloadable.** Original files, actual coordinate conventions, vertical heights and observed-area masks must be audited before generating terrain or exposing a beta pack.

### Hex Grid puzzles and larger models (v1.8.0)

Select **Puzzle → Hex Grid** for an additional overarching model shape, distinct from the original nested-ring **Hexagon** puzzle. Hex Grid forms a real point-up hexagonal tessellation with independent 3D-printable pieces, slicer clearance, terrain relief and regular STL/3MF/ZIP export. Choose among four patterns based on example diagrams:

1. **Hex outline · half-hex border:** The overall footprint is a regular pointy hexagon with its outermost tessellated pieces cropped at the edge. Set **Half-hex border surface** to *Terrain relief* (continuous heightfield) or *Flat* (base-level perimeter pieces).
2. **Hex outline · alternating edge pieces:** Offset tessellation relative to a pointy hexagonal outer boundary to alternate whole and cropped perimeter pieces. The same terrain/flat perimeter choice applies.
3. **Rounded hex cluster · whole hexes only:** Hexagonal ring clusters with a stepped outer silhouette, never clipping any individual hexagon. The total is chosen from whole-ring counts 7, 19, 37, 61, 91 or 127.
4. **Square hex cluster · whole hexes only:** Regular staggered tessellation arranged into approximately square rows/columns, with a stepped outer silhouette and no cropped hexagons.

**Target hex pieces** is a requested approximate number (7–150), not an exact count when geometric tiling needs full rings or rows. The preview displays the actual count. Borders and lettering from standard puzzles are disabled in Hex Grid mode (the clipped edge pieces *are* its optional flat perimeter). Use **Spread pieces apart for printing** and **Also every piece as its own STL** in the usual manner.

**Oversize models:** The normal terrain-width control remains capped at **1,000 mm**. The explicit **Unlock over 1,000 mm** switch enables 60–5,000 mm, with exact-mm input and confirmation/warnings. This is a *model dimension unlock*, not a mesh sampling quality unlock. The same 2,881×2,881 sample hard cap and source-/printer-aware Auto density still apply, so a very large model may lack small terrain detail and may exhaust available CPU/RAM during triangulation or STL/3MF writing. Large pieces may exceed your printer's bed, even when separated.

### Hex Grid reliability and count controls (v1.8.1)

Replaces the v1.8.0 trial's arbitrary-polygon trimming with **lattice-aligned, deterministic hex rings**. The outlines now choose the grid **before** cutting the perimeter, eliminating near-zero edge fragments from count optimization. The unrotated interior tiles are flat-topped, as in the original visual examples. The six geometric outer corners can form one-third corner tiles, while other trimmed edge tiles are generally halves (or intentionally offset larger/smaller edge fractions for the alternating variant); no tiny incidental slivers should remain.

- **Hex-outline / alternating / rounded:** select a fixed ring tier from a dropdown: 1 ring / 7 nominal hexes, 2 / 19, 3 / 37, 4 / 61, 5 / 91, or 6 / 127. The **rounded** cluster has exactly that many **whole hexagons**. The two outline styles fill a perfect hexagonal silhouette, so some boundary hexagons are intentionally cropped; they have been checked for no missing board area prior to printable fit clearance.
- **Square:** choose **N hexagons across and N down** (2–12); exactly **N² whole, regular tessellating hexagons** are generated. Staggered rows yield an approximately square, stepped footprint without trimming any hex.
- **Flat border:** only intentionally cropped cells are flat; whole cells retain terrain detail. Existing clearance offsets each valid tile once. Piece counts are displayed after mesh generation.

This patch does not alter the terrain DEMs, printer-aware sampling, optional >1,000 mm size unlock or other puzzle types.

### Terrain boundary walls and editable location inputs (v1.8.2)

**Terrain edge geometry:** Sampled terrain perimeters now retain their intermediate XY edge vertices while triangulating. Previously a simplification pass removed collinear XY vertices even when their **heights differed**, leaving diagonal "curtain" triangles between distant corner elevations along the puzzle-piece sides. The fix keeps the same DEM-sampled vertices on the top surface and the sidewalls (at up to the requested sample step), preserving the actual cliff/crater contours along Hex Grid pieces and conventional puzzle/ornament outlines. Flat-height non-terrain geometry retains its faster collinear simplification. A regression test compares actual wall heights with an independent heightfield interpolation and verifies shared top/wall boundary vertices.

**Editable coordinates and widths:** Latitude (0.01° increments), east longitude (0.01°), selected region width (1 km), and printed model width (1 mm) support direct number typing **and persistent side-by-side up/down stepper arrows** in Windows Chromium. Keyboard arrows also work when a number field is focused. The existing model-width range slider remains in 5 mm increments, but a typed 463 mm remains 463 mm for preview, mesh planning and export, rather than being rounded to 465 mm. Unlocking model sizes above 1,000 mm still requires confirmation.

### Symmetric Hex Grid outlines (v1.8.3)

Fixes visibly **off-centre central hexagons and unequal opposite-side border panels** in both clipped hex-outline presentations. The cause was a one-sided ¼-cell lateral offset in the alternating layout: polygons still covered the hexagonal board but did not have mirrored left/right parts.

Both clipped grids are now genuinely centred on the board, with a full central hexagon and equal-area boundary counterparts under rotations of 60 degrees and left/right or top/bottom reflections. The half-hex-border arrangement uses **flat-top hexagon tiles** as in the first reference image, while **alternating edge pieces** uses **point-top hexagons** as in the second reference. The two layouts are distinct orientations, never an arbitrary one-sided translation. Point-top border cuts use prechecked per-ring spacings to avoid fine slivers; these six tiers can yield 7, 19, 43, 55, 91 or 133 rendered pieces rather than the round whole-hex defaults of 7, 19, 37, 61, 91 and 127. The ring selector displays the count for the chosen mode. The preview displays the actual constructed count.

This change affects Hex Grid outline tessellation only, not the sample heights, terrain sidewall correction, the **Round** and **Square** whole-hex layouts, or the model size unlock. Geometry regression tests check that each individual border piece has a counterpart matching shape placement, area and whether it is clipped under 60° rotation and horizontal/vertical reflection across all six preset ring sizes.

### Venus Magellan stereo elevations + globe coverage legend (v1.9.0)

**New opt-in Venus beta:** In **Terrain Data Manager**, choose **Magellan Venus Stereo Topography · 600 m raster · regional beta**. It downloads NASA PDS4's original ~2.974 GB `mosaic_allstereo.img` raster plus a small ENVI header and PDS4 label, retaining them outside the EXE. NASA's actual source label was inspected and a few native float samples retrieved via HTTP byte ranges, including the NoData sentinel. Source dimensions are 34,505 × 21,549, 600 m/projected pixel, float32 little-endian, positive-east planetocentric equirectangular, with a radius `value_offset` of 6,040,000 m. The importer rejects unexpected metadata, calculates real heights against Terrain Press's reference radius, and converts just-needed tiles locally.

**Crucially, this is not a global observed DEM.** Magellan stereo measures roughly 20% of Venus, and the researcher's effective horizontal detail estimate is **~1–2 km**, despite 600 m raster pixels. The desktop computes a 0.5° global **measured-elevation coverage atlas from native valid float pixels** after download; **unmapped samples remain transparent** and fall back to the bundled elevation. The **Globe tab → Show elevation coverage** legend shows installed measured stereo areas, bundled fallback, nominal installed global products and bundled higher-fidelity landmark patches. The map is approximate at 0.5° resolution; export always tests each actual elevation sample. The selected region's real stereo-vs-bundled percentage appears in preview and the ZIP README. No color imagery is used as if it were height data.

Official source: [NASA PDS4 Magellan stereo archive](https://pds-geosciences.wustl.edu/missions/magellan/stereo_topography.htm). Details and effective-resolution caveat: [Robert Herrick's research page](https://sites.google.com/alaska.edu/robertherrick/resources/stereo-derived-topography-for-venus). **Still beta:** Native source labels and limited samples verified, but the complete ~2.97 GB transfer, postdownload coverage atlas, landmark height comparisons, and offline Windows STL/3MF rendering have not yet been physically tested. Existing planet packages remain unchanged.

**v1.9.1 planner refinement:** The Venus 600 m file is an output raster, not a 600 m effective-detail measurement. Auto terrain resolution uses a conservative ~1.5 km effective-detail estimate for the Venus optional pack while still loading actual higher-resolution pixels for all sampled heights. This avoids redundant triangulation in large prints; manual Advanced ceilings remain available.

### Moon 256/512 and Venus stereo download fixes (v1.9.2)

- **Moon LOLA 256/512 pixels/degree:** NASA names southern tiles `ldem_256_90s_00s_000_180.img` (**00s**, not 00n at the southern equator). Terrain Press v1.9.1 incorrectly requested `ldem_256_90s_00n_000_180.img`, which fails around 50% through the 256 ppd download. The southern-hemisphere filenames are fixed for 256 and 512 ppd, including the corresponding `.lbl` files. Previously downloaded original IMG files in the `moon-lola-256.incomplete` folder **are preserved**; retry with the same data directory. SHA checks of completed files may take time, but the 4.25 GB already saved in the northern tiles need not be downloaded again.
- **Venus Magellan stereo:** NASA uses namespaced PDS4 tags such as `<cart:latitude_type>`; the old validator only recognized unprefixed cartographic tags and rejected a valid label before the ~2.97 GB image transfer. The parser now accepts XML namespace prefixes **while still validating** the coordinate system, 600 m native grid, source height offset of 6,040,000 m, and 6,051,800 m radius. The official XML tag spelling was confirmed in a live NASA archive check. Full data transfer and exported Venus mesh remain beta validation tasks.

To recover, use **v1.9.2**, keep the existing configured Terrain Data Manager directory, and click Download for the failed pack again; do **not** delete `.incomplete` directories.

### Giant planets and 1024 color detail (v1.18.0)

Saturn, Uranus and Neptune join Jupiter in globe selection and the standard ornament/puzzle export workflow. Giant panels and rocky-world painting now support 1024 color cells across. Bundled OPAL imagery has explicit coverage limits; rings are not included. See [giant-planet printing and sources](docs/GIANT-PLANETS.md).

### Tabbed settings and color contrast (v1.19.0, v1.19.1)

Settings are grouped into **Place, Model, Colors, Frame and Print** tabs, and the desktop Terrain data manager opens from the top bar. A **Color contrast** slider (1.0×–3.0×) in the Colors tab spreads sampled palettes apart without changing which cells get which color. v1.19.1 fixes hexagon ornaments failing to build with "Collinear not supported".
