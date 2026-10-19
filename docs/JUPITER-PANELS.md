# Jupiter layered color panels

Open **Jupiter · color panel** in the world selector. This first implementation uses the entire bundled Hubble OPAL map as a rectangular panel, with 2–8 quantized colors and editable filament swatches. It works offline in the desktop app.

Each color is assigned a height band, sorted initially from dark to light. Higher bands have nested footprints so earlier colors remain exposed. The first color also forms the backing. These heights are artistic construction, not measured cloud or terrain elevations.

Choose panel width, grid detail, constant printer layer height, backing layers and layers per color band. The download contains a watertight single-solid STL, CSV color-change schedule, settings JSON and instructions with source credit. STL stores geometry only; configure the height changes manually in the slicer. The schedule uses one-based layer numbers and assumes the first layer has the same thickness as every other layer. Adaptive layers are unsupported. No automatic printer or filament-slot configuration is supplied.

Quantization uses deterministic RGB clustering without dithering. Diagonal-only contacts are lowered to avoid nonmanifold edges. Preview uses that same cleaned grid. Grid resolution controls detail, not guaranteed printable feature size: narrow features, filament opacity and color mixing still need slicer inspection and a small physical print. No physical print or slicer compatibility claim is made yet.

Current scope excludes crop selection, custom source images, palette reordering, terrain surface assignments and colored 3MF. Saturn is the next image-panel candidate. Surface assignments for Moon and rocky-planet terrain remain the accepted next color-terrain approach.

## Source

Hubble OPAL Jupiter, rotation 1, observed 2015-01-19 02:00–12:30 UTC. Filter composite: blue 395 nm, green 502 nm, red 631 nm. Not a timeless map or exact filament-color reference.

Credit: NASA, ESA, A. Simon (GSFC), M. Wong (UC Berkeley), and G. Orton (JPL-Caltech).

- https://science.nasa.gov/asset/hubble/jupiter-global-map-from-hubble-opal-data-rotation-1/
- https://www.nasa.gov/nasa-brand-center/images-and-media/

The bundled JPEG is resized to 1000 × 444 from the NASA-served 2000 × 888 rendition, with no geographic crop. Original published image dimensions: 3600 × 1598. The image is used with its own NASA media terms and credit, not relicensed under the code license. No agency endorsement.

## Verification

Automated tests cover 2–8 color mesh edge incidence, winding, positive volume, expected volume, uniform input, STL triangle count and swap schedule indexing. Browser and slicer/physical-print checks should be recorded separately.

Validation for the prototype: 89 automated tests passed. Interactive browser testing was blocked by an unavailable browser binary and failed browser download in the development environment. Slicer import and physical printing are pending.
