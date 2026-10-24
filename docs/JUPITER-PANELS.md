# Jupiter layered color panels

The original full-map panel is available through the **Full-map panel** link in the **Colors** tab. See the standard workflow integration below for the main world selector. This first implementation uses the entire bundled Hubble OPAL map as a rectangular panel, with 2–8 quantized colors and editable filament swatches. It works offline in the desktop app.

Each color is assigned a height band, sorted initially from dark to light. Higher bands have nested footprints so earlier colors remain exposed. The first color also forms the backing. These heights are artistic construction, not measured cloud or terrain elevations.

Choose panel width, grid detail, constant printer layer height, backing layers and layers per color band. The download contains a watertight single-solid STL, CSV color-change schedule, settings JSON and instructions with source credit. STL stores geometry only; configure the height changes manually in the slicer. The schedule uses one-based layer numbers and assumes the first layer has the same thickness as every other layer. Adaptive layers are unsupported. No automatic printer or filament-slot configuration is supplied.

Quantization uses deterministic RGB clustering without dithering. Diagonal-only contacts are lowered to avoid nonmanifold edges. Preview uses that same cleaned grid. Grid resolution controls detail, not guaranteed printable feature size: narrow features, filament opacity and color mixing still need slicer inspection and a small physical print. No physical print or slicer compatibility claim is made yet.

The standalone full-map page excludes crop selection and colored 3MF; these are available through the standard workflow below. Custom source images, palette reordering and measured-terrain surface assignments remain future work. Saturn, Uranus and Neptune now share this workflow; see [giant planets](GIANT-PLANETS.md). Surface assignments for Moon and rocky-planet terrain remain the accepted next color-terrain approach.

## Source

Hubble OPAL Jupiter, rotation 1, observed 2015-01-19 02:00–12:30 UTC. Filter composite: blue 395 nm, green 502 nm, red 631 nm. Not a timeless map or exact filament-color reference.

Credit: NASA, ESA, A. Simon (GSFC), M. Wong (UC Berkeley), and G. Orton (JPL-Caltech).

- https://science.nasa.gov/asset/hubble/jupiter-global-map-from-hubble-opal-data-rotation-1/
- https://www.nasa.gov/nasa-brand-center/images-and-media/

The bundled NASA-served JPEG uses the full published 3600 × 1598 dimensions, with no geographic crop or upscaling. It replaces the former 1000 × 444 derivative. The globe texture uses up to 3600 × 1800 with blank polar margins, limited by GPU texture capacity. The image is used with its own NASA media terms and credit, not relicensed under the code license. No agency endorsement.

## Verification

Automated tests cover 2–8 color mesh edge incidence, winding, positive volume, expected volume, uniform input, STL triangle count and swap schedule indexing. Browser and slicer/physical-print checks should be recorded separately.

Validation for the prototype: 89 automated tests passed. Interactive browser testing was blocked by an unavailable browser binary and failed browser download in the development environment. Slicer import and physical printing are pending.

## Standard workflow integration

Choose **Jupiter** in the main world selector. Select an area on Globe or type its coordinates and width. Circle, square, hexagon, ornaments, frames, lettering, jigsaws and hex grids now use the same main workflow. The original full-map panel is linked from the Jupiter controls.

The selected image is quantized once into 2–8 editable colors. Every piece shares its palette and height schedule. Color cells are clipped to the normal ornament/puzzle outlines. Frame/tray/lettering print separately from the color pieces. Flat hex border pieces use the first color. Exports include the usual STL/3MF, spread and individual pieces, SVG piece map, and PDF print guide (README fallback), plus color-changes.csv, JUPITER-PRINTING.txt and settings JSON. 3MF includes per-triangle surface display assignments; slicer support varies. The manual height-change schedule remains authoritative. Use a constant layer height including the first layer; disable adaptive layers.

The globe and crop use the same spherical selection, with image-relative east-positive longitude (image centre = 0, left edge = -180), **not calibrated System III longitude**. Source latitude is planetographic; spherical distances are approximate. Imagery ends at ±79.9° latitude: the globe shades missing poles and the generator rejects crops crossing them. Source: Simon, Wong & Orton (2015), Figure 1, https://esahubble.org/static/archives/releases/science_papers/heic1522a.pdf .

Color detail is 48, 80, 128 (default), 192, 256, 384, 512 or 1024 cells across, identical in preview/export. DEM sampling and exaggeration do not affect Jupiter. Small islands can require coarser detail for the chosen nozzle. Region/crop selection and surface-colored 3MF are now implemented for these artistic panels; measured-terrain surface assignments remain future work.

Regression tests cover watertight clipped shapes and puzzles, preserved color metadata after spreading, map orientation/seam wrapping/polar rejection, and worker export assets and build-plate-relative color schedules. Chromium CI exercises globe selection, 2/8 colors, download and switching back to Moon.

## Higher-detail imagery

Both workflows use the full-resolution image offline. The main workflow maximum rises from 128 to 512 cells across (16 times as many cells). The full-map panel also supports 384 and 512, with 256 as its default. Preview and export use the same sampled grid and retain 2–8 colors. Higher detail increases build time, memory use and file size; it cannot recover features absent from the source or guarantee printable islands. Source spacing estimates now use the 3600-pixel width.

Published JPEG: https://assets.science.nasa.gov/content/dam/science/missions/hubble/releases/2015/10/STScI-01EVT28CB7CN0CEYRV56WP1S6A.tif/jcr:content/renditions/3600x1598.jpg
