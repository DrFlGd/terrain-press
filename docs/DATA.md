# Elevation data

**Current dataset inventory:** See the [seven-world project status, functional validation notes and acceptance checklist](PROJECT-STATUS.md). This document describes source formats and reference frames; **user-reported successful operation is distinct from independent verification of native height values**.

How the files in `site/data/` were made, and how to add a world.

## Tile format

Every world has the same layout:

| File | What |
|---|---|
| `t{row}_{col}.webp` | Full-resolution global grid, cut into 1024 × 1024 tiles. Row 0 is the north edge, column 0 is 180° W. |
| `overview.webp` | The whole globe at 2048 × 1024, used for wide regions. |
| `patch_{id}.webp` | Optional sharper sub-areas around landmarks (bounds and pixels-per-degree in `meta.json`). |
| `globe.jpg` | Shaded relief for the globe picker. |

Notes on the format:

- **Projection:** equirectangular (simple cylindrical), pixel-registered, east-positive longitudes from −180° to 180°, planetocentric latitudes.
- **Encoding:** heights are lossless WebP, RGB, in whole metres: `height = R × 256 + G − 32768`. The B channel is unused. Lossless WebP keeps every value exact.
- **Check value:** browsers must not colour-manage these images. The app checks that by comparing the sum of row 512 of `overview.webp` with `check` in `meta.json`.
- **Global grids** are 8192 × 4096 (Mercury 10240 × 5120).

`meta.json` lists, per world:

- `radiusKm`: the reference sphere the heights are measured from.
- grid sizes and the `min` / `max` heights.
- the `check` value.
- `patches`, with their bounds.

## Worlds

**Moon:** LOLA gridded data records. Heights are above the 1737.4 km sphere. The sharper patches around the Apollo sites and Tycho are resampled from LDEM_1024.

**Mars:** MOLA MEGDR, heights in metres around the 3396 km reference radius.

**Mercury:** USGS MESSENGER Global DEM v2 (665 m per pixel), heights above the 2439.4 km sphere. Resampled to 10240 × 5120, with full-resolution patches. The lowest point (−5.38 km, inside Rachmaninoff) was used as a sanity check.

**Ceres:** Dawn HAMO DTM. Heights are relative to the 482.08 × 445.93 km reference ellipsoid, so the planet's flattening doesn't drown out the relief.

**Vesta:** Dawn HAMO SPG DTM (`VE_HAMO_G_00N_330E_EQU_DTM.IMG`, PDS DWNVSPG_2).
- **Source grid:** 23040 × 11521 big-endian int16 at 64 pixels per degree. Heights are in 2 m steps above a 255 km sphere, and longitudes are in the Claudia double-prime system, with the west edge at −210°.
- **Height reference:** Vesta is far from round, so a degree-2 spherical-harmonic fit of its overall shape is subtracted. The tiles then hold relief relative to that smooth shape (−16.8 to +20.3 km).
- **Globe shape:** `shape.json` holds the true radius on a 256 × 128 grid, in 100 m units, so the globe preview can take Vesta's real shape.

**Venus:** USGS Magellan global topography (4641 m), heights above the 6051 km sphere. About 8% of the surface has no radar data. Those gaps are filled smoothly with a pyramid (multi-resolution) fill, which you can see as soft areas.

**Pluto:** USGS New Horizons global DEM (300 m), heights above the 1188.3 km sphere.
- About 53% of Pluto was not imaged in stereo. Those areas are a smooth pyramid fill, and the app warns about them.
- `coverage.png` marks the mapped area.
- The western shore of Sputnik Planitia (Tenzing Montes, Wright Mons) is also stored as a full-resolution patch.

## Adding a world

1. Get a global DEM (GeoTIFF, PDS IMG, …). Reproject it to equirectangular, east-positive, from −180° and north-up if needed.
2. Convert it to whole metres relative to a reference sphere or ellipsoid. Fill no-data gaps, for example with a pyramid fill.
3. Resample to 8192 × 4096. Write the `t{r}_{c}.webp` tiles and `overview.webp` with the encoding above, plus a shaded `globe.jpg`.
4. Add an entry to `site/data/meta.json`, including the row-512 `check` sum.
5. Add the world to `WORLDS` in `source/app.js`: name, colours, credit and landmarks. Then run `python3 source/build.py`.

Pull requests are welcome; please include the dataset's source and licence.

## World labelling and additional celestial bodies (v1.7.1)

The desktop **Terrain Data Manager** uses each entry's stable `body` identifier from `desktop/packs/catalog.json` and the same `WORLDS` names as the print configurator. Every bundled elevation raster and optional download displays **Applies to: [world] ([body classification])**. When adding a new body, add its stable ID and classification to the download-manager world-label mapping in `source/app.js`; a regression test in `desktop/data-manager-labels.test.js` ensures all catalog bodies are labelled correctly.

A downloadable dataset for a **previously supported** world is simpler than a whole new world: integrate and validate the source-native raster format and pixel grid, datum, NoData/coverage, provenance, file URLs, checksums, coordinate conventions and cache tiles. An **entirely new celestial body** additionally requires the global fallback grid, correctly projected tiles and overview, a shaded globe image, new `site/data/meta.json` record, a world definition in `source/app.js`, citation and credits, and any landmarks. Some moons lack complete global topographic coverage; do not present blank or interpolated areas as measured terrain.

## Io research pipeline (started after v1.7.1)

Io (Jupiter's moon) is a **candidate world**, not yet included in the app, download manager, release assets, or offline terrain catalog. The [Io milestone in the planetary terrain roadmap](TERRAIN-DATA-ROADMAP.md#next-new-world-candidate--io-jupiters-volcanic-moon-research-milestone) requires actual DEM/ISIS georeference and elevation verification, measured-data masks and a safe synthetic/filled fallback before world registration.

`tools/io/sources.json` lists the White et al. 2014 ISIS3 global stereo cube and the 900-m USGS Tvashtar regional GeoTIFF as **research only**. `node tools/io/preflight.js --help` prints the source inspection commands. This tool reads metadata using GDAL, records inconsistencies and manual audit blockers, and cannot enable a download or convert a heightfield merely because it opens successfully. Use an independently obtained local source file; no external URL is downloaded or hosted by the tool.

Do not apply the legacy "fill all NoData then call the raster observed" recipe to Io: about one quarter of the stereo globe is unmeasured, and the regional Tvashtar zero is arbitrary. Keep independent measurement masks, source-specific vertical references and explicit provenance in any future built-in global grid or downloadable high-resolution pack.
