# Earth terrain

Earth is the eighth selectable world. The bundled offline base uses NOAA ETOPO
2022 ice-surface and ocean-floor relief, area-averaged to 4096 × 2048 (~9.8 km
spacing at the equator), plus a 2048 × 1024 overview. The globe is elevation-colored,
not satellite photography. Landmarks cover the Himalayas, Alps, Hawaii, Andes
and Mariana Trench; arbitrary coordinates are supported.

The desktop Terrain Data Manager offers global and selected-area upgrades:

| Download | Grid spacing at equator | Download size | Coverage |
| --- | --- | --- | --- |
| NOAA ETOPO 60 arc-seconds | ~1.85 km | 465,969,062 bytes | Global land, ice surface, ocean floor |
| NOAA ETOPO 30 arc-seconds | ~925 m | 1,585,813,987 bytes | Global land, ice surface, ocean floor |
| Copernicus regional GLO-90 | ~90 m | Checked before download | Available one-degree land cells |
| Copernicus regional GLO-30 | ~30 m | Checked before download | Available public one-degree land cells |

Select Earth and set coordinates and region width. In Terrain Data Manager,
choose 30 m or 90 m under **Earth · download a selected area**, check availability
and size, then download. The downloader accepts 1–500 km widths and at most
64 source cells (the current main selection UI has a 10 km minimum). Near poles,
a smaller area may be necessary. Whole source cells are retained, so download
footprints exceed the print area.

Files stay in the chosen dataset folder and work offline after installation.
Cancellation and byte-range resume are supported: recheck the same area and
resolution, then retry. Completed cells are checked by local SHA-256; partial
transfers are tied to the provider ETag. Each region can be removed independently.
Overlapping regions currently duplicate cells on disk. Allow space for source
files, generated PNG cache and temporary downloads.

Preference is regional 30 m, regional 90 m, global 30s, global 60s, then bundled
terrain. Missing samples fall through other saved regions and coarser sources.
Coverage boxes show installed cell footprints, not measured-pixel confidence.
Copernicus omits ocean-only cells and some public GLO-30 land cells. The manager
reports unavailable cells. NOAA supplies ocean-floor relief outside regional cells.

Copernicus is a **digital surface model**: vegetation and buildings can remain.
It uses WGS84 point samples and EGM2008 metre heights, with latitude-dependent
longitude spacing. The mirror strips shared east/south samples; interpolation
clamps to the last published sample at those edges. This differs from NOAA's
pixel-area registration. Finer mesh spacing does not improve source accuracy,
and transitions between products may retain visible seams.

Public distribution and license links:
https://copernicus-dem-30m.s3.amazonaws.com/readme.html

Source specifications:
https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM

Attribution is retained in CREDITS.md and Earth export metadata.

## Interpretation

- NOAA: WGS84 geographic, pixel-area registered, north-up, -180 to +180 longitude.
- Signed metre heights relative to EGM2008 (approximately mean sea level), not radii.
- Negative ocean depths are preserved. Models place the selected region's lowest
  elevation above the print base; they do not flatten water to sea level.
- Uses ice surface, not Antarctic/Greenland sub-ice bedrock.
- ETOPO combines measured and interpolated sources with variable detail. Grid
  spacing is not uniform survey accuracy; the 60s product has no source-ID mask.
- Regional projection uses the app's mean-radius spherical approximation,
  6371.0088 km. This is decorative terrain, not survey-grade geodesy.

## Reproduction and validation

Source: https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif

Citation: NOAA National Centers for Environmental Information (2022), ETOPO 2022
15 Arc-Second Global Relief Model, https://doi.org/10.25921/fd45-gt74.
The NOAA guide permits private, academic and commercial use:
https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/docs/1.2%20ETOPO%202022%20User%20Guide.pdf

`python tools/earth/build.py /path/to/source.tif` (numpy, rasterio, Pillow)
verifies the pinned SHA-256 and regenerates all assets. Each lossless WebP is
decoded and checked for exact integer-height round-trip. Provenance and independent
rasterio source samples are recorded in `site/data/earth/provenance.json`.

`node tools/earth/verify-native.js /path/to/source.tif` checks the application
importer, receipt, pinned checksum, PNG elevations and finite STL/3MF geometry
for native mountain and ocean ornament/hex-puzzle models. The complete original
file was downloaded during implementation and four geographic samples matched
to the nearest metre. This is a cross-decoder check, not a geodetic survey.

The full 30s NOAA source was downloaded and checked during development against
SHA-256 `8630abc401cc6bdd30b507a68d3eb9eda5b65f5636f7199e4b1eefd476b5a9e2`.
Native Copernicus 30 m and 90 m N27 E086 samples matched on-demand PNG interpolation;
a live 90 m region completed through the application downloader. Automated tests
cover bounds/dateline/poles, metadata, ETags/resume, offline restart/removal,
and fallback through overlapping regions, global and bundled terrain.

The optional upgrades remain beta pending Windows download/cancel/resume,
offline restart/removal and slicer/physical-print acceptance. Browser visual
verification could not run in the implementation environment because Chromium
was unavailable. Regional NOAA 15s downloads and land-only/water-level controls remain
future work, not shipped features.
