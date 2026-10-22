# Moon terrain surface colors

Enable **Surface colors from lunar imagery** in the Moon controls. Choose 2–8 filament colors and a 128, 256 (default), or 512-cell image sampling grid. Edit the generated swatches to match your filaments. Changing count or image sampling resets swatches; changing location preserves manually chosen swatches until those settings reset them. Turn the switch off for the existing single-color workflow.

This paints the real elevation mesh. Terrain downloads, exaggeration, framing, lettering, ornament shapes, square/radial/hex puzzles and print layouts retain their existing behavior. No height bands, thickness changes, or layer-change schedule are introduced. Upward terrain triangles receive the image label at their centroid; sidewalls and undersides use the first color. Frames/lettering retain their separate materials. Geometry is byte-identical with painting enabled or disabled for otherwise identical inputs.

All pieces use one shared palette and geographic crop before any centering or spreading. Image sampling is independent of terrain sampling, so preview/export palette clustering is deterministic for the same region/settings. The **High-detail preview (match export)** switch is needed to match triangle boundaries: a fast preview can have fewer triangles. Finer color sampling cannot add triangles or recover image details that aren't in the source. Very small regions may produce nearly identical swatches because lunar natural colors are subtle.

## Printing and export

Colored 3MFs contain standard per-triangle base-material assignments, including assembled, spread and individual piece files. STL contains geometry only. `surface-palette.csv`, `moon-surface-settings.json` and `MOON-COLOR-PRINTING.txt` preserve the palette, source, settings and instructions. The PDF guide displays the surface colors. Each physical layer may contain multiple colors; there is no Jupiter-style height-change CSV.

Map the 3MF materials to filament in a compatible slicer and inspect its sliced preview. These are surface assignments, not printer-specific paint metadata, separate color volumes or automatically configured toolpaths. Slicers may ignore them; physical printing and slicer acceptance remain to be tested. The prototype does not claim universal slicer compatibility.

## Imagery and registration

- Source: NASA Scientific Visualization Studio, **CGI Moon Kit**, December 2025 color map, https://svs.gsfc.nasa.gov/4720/ (page updated January 9, 2026).
- Download: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_8k.tif
- Credit: NASA's Scientific Visualization Studio; Ernie Wright (USRA); LRO/LROC WAC data assembled by NASA/GSFC/Arizona State University. Imagery retains its NASA source terms, separate from the code's AGPL license.
- Offline asset: `site/data/moon/lroc-color-2025-8k.jpg`, 8192 × 4096, RGB8 sRGB, JPEG quality 95 without chroma subsampling. Converted from the published 16-bit sRGB TIFF without geographic cropping, resizing or added contrast. Reproduce with `python tools/moon/prepare-color.py /path/to/lroc_color_16bit_srgb_8k.tif` (Pillow).
- Global equirectangular map centered on 0° longitude, east-positive, north at top. The color sampler and DEM sampler share the exact same azimuthal-equidistant projection function and Moon radius (1737.4 km). Longitude wraps at the map seam; latitude clamps at the poles. The globe uses the same source image.
- Nominal equatorial image spacing is about 1.33 km/pixel. Installed high-resolution and local DEMs can be far finer. This first version bundles an 8K global map; downloadable/local higher-resolution imagery is future work.
- NASA combines 643, 566 and 415 nm channels, adjusts exposure/white balance for appearance and inpaints small dropouts. Beyond ±70°, missing color coverage is filled with lower-resolution monochrome LOLA albedo. This is an aesthetic visualization map, not unmodified scientific color measurements.

## Verification

Regression tests cover shared geographic projection, north/south and seam behavior, diagonal paint preservation, unchanged relief geometry, face classification, shared puzzle colors through spreading, colored individual 3MF exports, manual palette edits, and switching paint off without stale color data in the DEM cache. Browser CI covers controls, globe, 2/8-color palettes, export and disabling colors. Physical print acceptance remains separate.

The same workflow is extended to Earth, Mars, Mercury and Venus in v1.16; see [shared surface-color documentation](SURFACE-COLORS.md). Moon imagery and existing export filenames are preserved.
