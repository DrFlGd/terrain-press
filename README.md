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

A portable, offline Windows executable is built automatically by GitHub Actions. Download it from the [Windows desktop release](https://github.com/DrFlGd/terrain-press/releases/tag/desktop-v1.3.0) (the **Terrain-Press-1.3.0-Portable.exe** asset). No browser, server, Node.js or Python is needed. See [Windows build and usage instructions](docs/WINDOWS.md).

## Hybrid dataset roadmap (Windows)

The [terrain data roadmap](docs/TERRAIN-DATA-ROADMAP.md) documents the hybrid system. Starting with **Windows v1.2.0**, the Terrain Data Manager can download the complete Moon in NASA PDS LOLA 128, 256 or 512 pixels-per-degree native IMG files directly from the [PDS Geosciences Node](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/). Download sizes are 2.12, 8.49 and 33.97 GB, respectively, plus locally cached tiles. Downloads may be resumed and the datasets work offline after installation. The original bundled terrain is always available. Other planets and regional packs remain roadmap items.

### Source-matched export (v1.3.0)

The **Print → Export detail → Auto** option now plans a denser STL/3MF grid using the finest installed and geographically valid DEM, with a minimum density comparable to Standard. The grid never exceeds 721 × 721 height samples, so large native NASA terrain files may still be downsampled. The exported ZIP's README records the terrain source, sample grid size, actual model spacing and cap status. Existing Standard, Fine and Ultra presets remain available. The terrain sampler now fixes an error when switching from an 83 m landmark patch to a downloaded NASA IMG dataset: cached PNG tiles are read as PNGs instead of being incorrectly looked up as WebP files. **True geometric adaptive/quadtree meshing** is a separate next-phase milestone to improve fidelity while limiting output complexity.
