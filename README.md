# Terrain Press

**Turn real NASA elevation data into 3D-printable ornaments and jigsaw puzzles. Free, open source, no account, no paywall.**

Pick a place on the Moon, Mars, Mercury, Ceres, Vesta, Venus or Pluto, choose a shape and a size, and download print-ready STL and 3MF files. Everything is computed in your browser from real spacecraft measurements; nothing is uploaded anywhere.

**Use it now:** <https://ianbauters.github.io/terrain-press/>

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

A portable, offline Windows executable is built automatically by GitHub Actions. Download it from the [Windows desktop release](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.7.1) (the **Terrain-Press-1.7.1-Portable.exe** asset). No browser, server, Node.js or Python is needed. See [Windows build and usage instructions](docs/WINDOWS.md).

## Hybrid dataset roadmap (Windows)

The [terrain data roadmap](docs/TERRAIN-DATA-ROADMAP.md) documents the hybrid system. Starting with **Windows v1.2.0**, the Terrain Data Manager can download the complete Moon in NASA PDS LOLA 128, 256 or 512 pixels-per-degree native IMG files directly from the [PDS Geosciences Node](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/). Download sizes are 2.12, 8.49 and 33.97 GB, respectively, plus locally cached tiles. Downloads may be resumed and the datasets work offline after installation. The original bundled terrain is always available. The first additional planet download, **Mars MOLA 64 px/degree beta**, is now available through the manager. Mercury, Ceres and Vesta now have separately selectable **beta USGS GeoTIFF** upgrades. Venus's available global topography does not improve on the bundled nominal spatial resolution, and higher-resolution Pluto data do not cover the whole planet; both remain future source-specific work.

### Source-matched export (v1.3.0)

The **Print → Terrain resolution → Automatic** mode plans a useful STL/3MF sample grid using the finest installed geographically valid DEM, physical print dimensions and printable-feature size. Its memory safety ceiling is 2,881 × 2,881 height samples; automatic planning often uses substantially fewer. The exported ZIP's README records the terrain source, sample grid size, actual model spacing and cap status. Existing Standard, Fine and Ultra presets remain available. The terrain sampler now fixes an error when switching from an 83 m landmark patch to a downloaded NASA IMG dataset: cached PNG tiles are read as PNGs instead of being incorrectly looked up as WebP files. **True geometric adaptive/quadtree meshing** is a separate next-phase milestone to improve fidelity while limiting output complexity.

### High-detail preview and 1,000-mm puzzles (v1.4.0)

Choose **Print → High-detail preview (match export)** to render the actual detail/heightfield used by the selected export preset before creating the 3MF. The switch is off by default to preserve smooth editing. The preview displays the resulting sample grid, spacing and cap status. The terrain width slider now supports **up to 1,000 mm**, and the 3D camera/virtual build plate scales to fit large puzzle models. Sampling uses the resolution mode and a hard maximum of **2,881 × 2,881**, with warnings for especially large grids. Large puzzles may still need to be arranged as individual pieces for printing.

### Configurable elevation sampling (v1.5.0)

The Print panel now provides **Terrain sampling limit: Auto / 721² / 1,441² / 2,881²** and a **Smallest printable feature** selector (0.2–1.0 mm, default 0.4 mm). With **Sampling Limit → Auto**, the elevation sampler derives a useful sampling interval from the best available DEM's pixel spacing projected onto the print (about 1.5 interpolation samples per raster pixel) and the physical feature size the printer can resolve (about 2 height samples per feature). It selects the less demanding spacing and does not generate redundant geometry beyond either bound. A live readout estimates the actual grid, source spacing on the model and whether the limit is reached. Users who need additional fidelity may select explicit ceilings, though these override the waste-avoiding Auto rule and can demand much more memory. **The 2,881² ceiling is a practical bound on heightfield sampling, not a guarantee of slicer compatibility or of recorded DEM accuracy.** Automatic sampling is still uniformly spaced; curvature-adaptive triangulation remains a future roadmap phase.

### Simpler print resolution (v1.5.1)

**Print → Terrain resolution** now starts in **Automatic** mode. Set just the **Smallest printable feature** (default 0.4 mm); the existing DEM-/print-aware planner chooses the useful grid size with no competing resolution controls. Select **Advanced** to expose **mesh spacing** (Standard 0.50 mm, Fine 0.35 mm, Ultra 0.25 mm) and **maximum sample grid** (721, 1,441 or 2,881 per side). Advanced intentionally bypasses the printer-feature optimization. The fast preview remains independent; enabling **High-detail preview (match export)** renders the current export settings. This is a UI organization change, not a new terrain algorithm.

**Next milestone: downloadable data for the other supported worlds**, beginning with a validated Mars MOLA tier and then Mercury MESSENGER, Venus Magellan, Ceres/Vesta Dawn, and properly coverage-labelled Pluto New Horizons options. The existing bundled data remains the offline fallback; additional moons require verified DEM availability and metadata before being advertised. See the [terrain data roadmap](docs/TERRAIN-DATA-ROADMAP.md).

### Mars download trial and large-puzzle spread preview (v1.6.0)

**Fix:** Spreading puzzle pieces for printing now handles layouts without a border/frame, including large 460-mm models. The preview coordinates are centered and finite even if no separate frame geometry is present.

**Mars beta:** Open **Terrain Data Manager → MOLA MEGDR 64 px/degree · Mars beta**. Terrain Press downloads four original 16-bit, big-endian topography files directly from NASA's [maintained MOLA PDS4 bundle](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html), about **530.84 MB (506 MiB)**, plus on-demand PNG cache tiles. The MOLA 64 product covers the full planet and is ~925 metres/sample at Mars's equator, finer than the built-in Mars 8192 × 4096 base grid. No user data leaves your machine during mesh creation; the files remain accessible offline after download.

**Beta limitation:** Source product filenames, coverage and tile geometry follow NASA PDS documentation and synthetic coordinate/value tests. The complete ~506 MiB NASA transfer, PDS label parsing against actual downloaded labels, and offline 3MF export have **not** yet been tested end-to-end on physical Windows hardware. Please treat this as a validation test, not yet a verified production dataset. Failed downloads should retain partial IMG files for resumption; the bundled Mars data remains available if the beta pack is not installed.

### Other-world GeoTIFF beta downloads (v1.7.0)

The **Terrain Data Manager** adds three independent DEM upgrades via USGS Astrogeology source products (not reflectance or color mosaics):

| World | Source DEM | Global raster | Approx. source download | Notes |
|---|---|---|---|---|
| Mercury | [MESSENGER MDIS Global DEM v2](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m) | 23,040 × 11,520 (64 px/degree) | ~506 MB | Elevation relative to Mercury's reference surface |
| Ceres | [Dawn FC2 HAMO Global DTM](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc2_hamo_global_dtm_137m) | 21,600 × 10,800 (60 px/degree) | ~446 MB | Elevation above 470 km reference sphere; ~98% observed, some shadows interpolated |
| Vesta | [Dawn FC HAMO DTM](https://astrogeology.usgs.gov/search/map/vesta_dawn_fc_hamo_global_dtm_93m) | 17,280 × 8,640 (48 px/degree) | ~570 MB | Radius from center; converted to elevation from 255 km; ~95% stereo coverage; Claudia Double Prime orientation |

These are **beta test downloads**, not production-verified transfers. Each GeoTIFF remains on the user's external dataset drive, is checked for raster dimensions and number of bands, locally hashed, and decoded into only the needed PNG elevation tiles on demand. The decoder uses signed 24-bit RGB for larger elevations and falls back to bundled lower-resolution data at masked/NoData pixels. Existing Moon and Mars native NASA IMG data use their original importer and are unchanged.

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
