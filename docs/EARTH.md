# Earth terrain

Earth is the eighth selectable world. The bundled offline base uses NOAA ETOPO
2022 ice-surface and ocean-floor relief, area-averaged to 4096 × 2048 (~9.8 km
spacing at the equator), plus a 2048 × 1024 overview. The globe is elevation-colored,
not satellite photography. Landmarks cover the Himalayas, Alps, Hawaii, Andes
and Mariana Trench; arbitrary coordinates are supported.

The desktop Terrain Data Manager offers **Earth ETOPO 2022 · 60 arc-seconds**:
21600 × 10800, ~1.85 km spacing at the equator, 465,969,062 bytes (~444 MiB)
plus an on-demand PNG cache. The original GeoTIFF stays in the chosen dataset
folder and works offline after installation. Installed data is selected
automatically; removing it restores the base. The existing GeoTIFF downloader
supports cancellation and HTTP byte-range resume.

## Interpretation

- WGS84 geographic, pixel-registered, north-up, -180 to +180 longitude.
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

The optional pack remains beta pending Windows download/cancel/resume,
offline restart/removal and slicer/physical-print acceptance. Browser visual
verification could not run in the implementation environment because Chromium
was unavailable. Regional 15s downloads and land-only/water-level controls remain
future work, not shipped features.
