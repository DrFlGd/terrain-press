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

A portable, offline Windows executable is built automatically by GitHub Actions. Download it from the [Windows desktop release](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.6.0) (the **Terrain-Press-1.6.0-Portable.exe** asset). No browser, server, Node.js or Python is needed. See [Windows build and usage instructions](docs/WINDOWS.md).

## Hybrid dataset roadmap (Windows)

The [terrain data roadmap](docs/TERRAIN-DATA-ROADMAP.md) documents the hybrid system. Starting with **Windows v1.2.0**, the Terrain Data Manager can download the complete Moon in NASA PDS LOLA 128, 256 or 512 pixels-per-degree native IMG files directly from the [PDS Geosciences Node](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/). Download sizes are 2.12, 8.49 and 33.97 GB, respectively, plus locally cached tiles. Downloads may be resumed and the datasets work offline after installation. The original bundled terrain is always available. The first additional planet download, **Mars MOLA 64 px/degree beta**, is now available through the manager. Mercury, Venus, Ceres, Vesta, Pluto and regional packs remain roadmap items.

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
