# Imagery-painted terrain

Version 1.16 adds Earth, Mars, Mercury and Venus to the Moon's surface-painting workflow. Select a world and region on Globe, enable **Surface colors from imagery**, choose 2–8 colors and edit the swatches to match filament. Sampling options are 128, 256 and 512 cells across. The globe uses the same image as the paint sampler.

Painting assigns materials to the existing terrain triangles. It does not alter elevations, add stacked color layers or flatten oceans. All existing shapes, frames and puzzle layouts remain available. Terrain mesh density limits color boundaries; use export-detail preview for a closer match.

## Bundled maps

| World | Image | Bundled pixels | Approximate equatorial spacing | Interpretation |
|---|---|---:|---:|---|
| Moon | NASA SVS / LROC 2025 | 8192 × 4096 | 1.33 km | Adjusted color; monochrome/inpainted poles beyond ±70° |
| Earth | Blue Marble Next Generation, August 2004 | 5400 × 2700 | 7.41 km | Monthly visible-light composite; not current imagery |
| Mars | Viking MDIM 2.1 colorized mosaic | 8192 × 4096 | 2.60 km | Viking color blended over a processed monochrome mosaic |
| Mercury | MESSENGER MDIS enhanced-color mosaic | 8192 × 4096 | 1.87 km | Enhanced spectral colors, not naked-eye appearance |
| Venus | Magellan C3-MIDR synthetic-color mosaic | 8192 × 4096 | 4.64 km | Radar-derived synthetic colors, not optical photographs |

These image resolutions are independent of terrain upgrades. Small regions can have detailed relief but little color variation. Source seams, illumination and gaps can become color boundaries; Mercury's dark polar gaps are missing imagery, not real dark terrain. No automatic gap filling or scientific material classification is performed. Earth ocean colors paint bathymetry; a water surface remains a separate deferred feature.

## Export

Use the colored assembled or individual-piece **3MF** files and assign their materials to filaments in a compatible slicer. STL is uncolored. The standard per-triangle base-material assignments are the same as the Moon implementation; slicer support varies. A layer may need several filaments, so there is no height-change CSV. Walls and undersides use color 1; frames and lettering retain their own materials.

Each ZIP includes `surface-palette.csv`, `<world>-surface-settings.json`, `<WORLD>-COLOR-PRINTING.txt`, and the print guide. Settings record the selected region, palette and imagery provenance. Moon export filenames remain compatible with v1.15.

## Sources and reproducibility

- [Moon: NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/). Existing preparation: `tools/moon/prepare-color.py`.
- [Earth: NASA Blue Marble Next Generation base maps](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/). NASA Earth Observatory, Reto Stöckli / NASA GSFC, MODIS. The 5400-pixel August 2004 map is used at its downloaded resolution.
- [Mars: USGS Viking colorized global mosaic](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m). NASA/JPL/USGS; colorization by NASA Ames. The 21339 × 10670 ancillary 1 km JPEG is obtained from its [Wikimedia mirror](https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg), then reduced to 8K. The original 232 m product's resolution is not the bundled resolution.
- [Mercury: USGS MESSENGER enhanced-color mosaic](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_enhanced_color_global_mosaic_665m). NASA/JHU APL/Carnegie Science/ASU; Applied Coherent Technology; USGS. NASA JPL's 11520 × 5760 browse derivative is reduced to 8K. The parent ISIS label confirms planetocentric latitude, positive-east longitude, center 0°, domain −180° to 180°.
- [Venus: USGS Magellan synthetic-color mosaic](https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_synthetic_color_mosaic_4641m). NASA/JPL/MIT/PDS Geosciences Node; USGS. The [David Rumsey archival copy](https://www.davidrumsey.com/luna/servlet/detail/RUMSEY~8~1~328895~90097381:Venus-Magellan-Global-C3-MDIR-Synth) is a 16384 × 8192 JP2, reduced to the USGS product's 8192 × 4096 resolution. Larger mirror dimensions are not treated as additional measured detail.

`tools/surface/imagery.json` records download URLs, input/output SHA-256 hashes and dimensions. Download the four inputs using the filenames in `tools/surface/prepare.py`, then run `python3 tools/surface/prepare.py /path/to/downloads` with Pillow/JPEG2000 support. Outputs are RGB JPEG quality 90 (Mercury: 80). Earth and Mars preserve full chroma; Mercury and Venus use JPEG 4:2:0 chroma subsampling to bound the offline download size. Full-frame Lanczos reduction preserves extent; no longitude roll, geographic crop or color stretching is applied.

All maps span −180° to +180° east longitude, with north at the top. USGS metadata confirms this extent for Mars, Mercury and Venus; Earth uses the standard Greenwich-centered Blue Marble map. Image sampling uses the same regional inverse projection and world radius as terrain sampling, including longitude wrapping. Only one decoded surface map is retained in worker memory.

## Scope and verification

Ceres, Vesta and Pluto remain terrain-only pending imagery coverage and coordinate-registration work. Jupiter retains its separate stacked-color workflow.

Automated regression tests check unchanged terrain geometry, 2/8-color palettes, per-piece 3MF materials, source metadata, each world's radius and image path, cache isolation when switching worlds, and painting off. Browser smoke coverage checks all four new worlds with the actual bundled maps and ZIP exports, alongside the existing Moon and Jupiter workflows. Physical-print acceptance remains a user testing step.
