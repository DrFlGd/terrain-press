# Credits

## Elevation data

All datasets are public domain or distributed without restriction. Please keep crediting the teams who made them.

| World | Dataset | Credit |
|---|---|---|
| Moon | LOLA Gridded Data Records LDEM_64 and LDEM_1024 | NASA Lunar Reconnaissance Orbiter, LOLA Science Team (NASA GSFC); PDS Geosciences Node |
| Mars | MOLA Mission Experiment Gridded Data Record (MEGDR) | NASA Mars Global Surveyor, MOLA Science Team (NASA GSFC); PDS Geosciences Node |
| Mercury | Mercury MESSENGER Global DEM v2, 665 m (Becker et al. 2016) | USGS Astrogeology Science Center; NASA / JHUAPL / Carnegie Institution of Washington, MESSENGER MDIS |
| Ceres | Dawn FC2 HAMO global DTM (CE_HAMO_G_00N_180E_EQU_DTM) | Preusker et al., German Aerospace Center (DLR); NASA Dawn; PDS Small Bodies Node |
| Vesta | Dawn FC2 HAMO SPG global DTM (VE_HAMO_G_00N_330E_EQU_DTM, PDS DWNVSPG_2; Preusker et al.) | German Aerospace Center (DLR); NASA Dawn; PDS Small Bodies Node |
| Venus | Venus Magellan Global Topography, 4641 m | USGS Astrogeology Science Center; NASA / JPL Magellan radar altimetry |
| Pluto | Pluto New Horizons Global DEM, 300 m (Schenk et al.) | USGS Astrogeology Science Center; NASA / JHUAPL / SwRI New Horizons LORRI and MVIC |

The Moon, Mars and Ceres data was obtained through the elevation tiles mirrored by the [galaxy-3d](https://github.com/Addey34/galaxy-3d) project, whose records list these datasets as public domain. The data was re-encoded into Terrain Press's own tile format; no galaxy-3d code is used.

Globe images are shaded relief rendered from the same elevation data.

## Software bundled in `site/`

| Component | Version | Licence | File |
|---|---|---|---|
| [three.js](https://threejs.org) and OrbitControls | r128 | MIT | [LICENSES/three.js-MIT.txt](LICENSES/three.js-MIT.txt) |
| [Bootstrap](https://getbootstrap.com) (CSS, trimmed and inlined) | 5.3.3 | MIT | [LICENSES/bootstrap-MIT.txt](LICENSES/bootstrap-MIT.txt) |
| [poly2tri.js](https://github.com/r3mi/poly2tri.js) | 1.5.0 | BSD 3-Clause | [LICENSES/poly2tri-BSD-3-Clause.txt](LICENSES/poly2tri-BSD-3-Clause.txt) |
| [Clipper](http://www.angusj.com/delphi/clipper.php) (clipper-lib) | 6.4.2 | Boost Software License 1.0 | [LICENSES/clipper-BSL-1.0.txt](LICENSES/clipper-BSL-1.0.txt) |
| [jsPDF](https://github.com/parallax/jsPDF) (print guide) | 2.5.1 | MIT | [LICENSES/jspdf-MIT.txt](LICENSES/jspdf-MIT.txt) |

## Fonts

The three lettering styles are glyph-outline subsets converted from these fonts. Under the SIL Open Font License 1.1 they're distributed as modified versions, under the names "TerrainPress Rounded / Geometric / Technical", and remain under the OFL.

| Style | Based on | Copyright | File |
|---|---|---|---|
| Space age | Audiowide | © 2012 Brian J. Bonislawsky DBA Astigmatic (AOETI), Reserved Font Name "Audiowide" | [LICENSES/font-Audiowide-OFL-1.1.txt](LICENSES/font-Audiowide-OFL-1.1.txt) |
| Apollo plaque | Jost | © 2020 The Jost Project Authors | [LICENSES/font-Jost-OFL-1.1.txt](LICENSES/font-Jost-OFL-1.1.txt) |
| Technical | Orbitron | © 2018 The Orbitron Project Authors | [LICENSES/font-Orbitron-OFL-1.1.txt](LICENSES/font-Orbitron-OFL-1.1.txt) |

## Trademarks

NASA, USGS and DLR are named only to credit their data. Terrain Press is not affiliated with or endorsed by them.

## Earth

NOAA NCEI (2022), ETOPO 2022 Global Relief Model, https://doi.org/10.25921/fd45-gt74. Bundled elevation is area-averaged from the 60-arc-second ice-surface/ocean-floor GeoTIFF; globe colors are derived from elevation. NOAA permits private, academic and commercial use. See `docs/EARTH.md` and `site/data/earth/provenance.json`.

Optional Copernicus surface terrain:

produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved

produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved

Public distribution and license links: https://copernicus-dem-30m.s3.amazonaws.com/readme.html

## Jupiter color-panel imagery

Hubble OPAL Jupiter map (2015-01-19): NASA, ESA, A. Simon (GSFC), M. Wong (UC Berkeley), and G. Orton (JPL-Caltech). Resized offline derivative; see [source and usage details](docs/JUPITER-PANELS.md#source). Image terms are separate from the software license.

## Moon surface-color imagery

The optional Moon surface colors and lunar globe use NASA Scientific Visualization Studio's 2025 CGI Moon Kit color map, derived from LRO/LROC WAC data (NASA/GSFC/Arizona State University). Credit NASA's Scientific Visualization Studio and Ernie Wright (USRA). The 8192 × 4096 RGB8 JPEG is a derivative of the published sRGB TIFF; no geographic crop or resampling. Polar fill uses monochrome LOLA albedo. Source and conversion details: [Moon surface colors](docs/MOON-SURFACE-COLORS.md), https://svs.gsfc.nasa.gov/4720/ . Imagery has separate NASA source terms, not the code license. No agency endorsement.
