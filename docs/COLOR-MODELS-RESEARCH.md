# Color panels and colored terrain: feasibility research

Research date: 2026-10-18 (America/New_York).
Status: proposal/research only. No implementation or release scheduled.

## Requested concept

The user proposes two related modes with a selectable palette of 2–8 colors:

1. Imagery without measured terrain: a multilayer panel with one color associated with each design layer. Giant planets are primary candidates.
2. Measured terrain plus imagery: paint the relief with 2–8 colors and let the slicer decide how to manufacture the colored surface.

Both are feasible. The first is a moderate addition; robust colored-terrain export is a larger change because of mapping, geometry and slicer interoperability. These are qualitative engineering estimates, not delivery commitments.

## Mode A: layered image panel

Reduce an image to a user-editable palette of 2–8 colors, clean up tiny regions, then create supported masks at successive heights. The layers must leave lower colors exposed. Full opaque rectangular sheets stacked over one another would show only the upper sheet.

A practical single-extruder construction is a cumulative stack: at each height, retain the footprints of all colors that will terminate at that height or above. Footprints shrink upwards, so upper detail is supported by lower layers. Each pixel/region's final top height determines its visible color. Lower layers can carry underpainting beneath higher colors.

This creates shallow, intentional steps representing color order, not measured topography. Provide editable stacking order, backing thickness and per-color band thickness. Count colors separately from physical printer layers: one color band normally spans several print layers. Include backing/frame within the chosen palette by default, with an explicit indication if an extra material is requested.

Suggested exports:
- A watertight stepped model plus a color/height schedule for manual filament swaps.
- An assembled 3MF and separate aligned parts where useful.
- A preview of exposed colors, step heights and smallest surviving features.

PrusaSlicer documents height-based color changes, including manual pauses. Support depends on printer/profile configuration; do not emit universal printer-ready G-code. With one band per color and backing sharing the first color, the design can use N-1 color changes rather than many changes within each layer.

Alternative: a flush mosaic with separate color volumes all finishing at one height. This is genuinely flat but needs multiple colors within the same print layer, or separately printed pieces assembled afterwards. It is distinct from the stacked-panel mode.

Thin translucent filament blending is a possible later mode, not required for the basic 2–8 opaque-color proposal. Accurate blending would need filament-specific optical calibration.

## Mode B: colored terrain

Keep elevation and color separate:
- Elevation controls geometry.
- A registered image or a deliberately chosen thematic palette controls appearance.
- Image brightness must not be used as a substitute for measured elevation.

Project imagery into the same coordinates as the heightfield, quantize to 2–8 colors, and assign color regions to the surface. Maintain the actual terrain shape. Where image detail is finer than the terrain mesh, split triangles at color boundaries or use a texture-capable export; otherwise one large triangle can erase narrow color features. Filter features by printed dimensions and printer capability rather than image pixel count alone.

Two export paths should be investigated:
1. Surface-colored 3MF using materials/properties or a tested slicer-specific painting export.
2. Closed, non-overlapping colored volumes in a multipart 3MF as a compatibility fallback. These could be surface-depth regions over a common core or full-depth partitions. Separate STLs can preserve geometry/registration but not standardized color metadata.

Surface-depth volumes need sufficient thickness, robust interfaces and explicit sidewall/bottom rules. A preview texture alone is not a manufactured color model. Existing source imagery may contain illumination/shadows, imperfect registration, false color or lower resolution; disclose these rather than implying intrinsic surface color.

The slicer can choose toolpaths, infill, support, purge and material changes once it understands the assignments. It cannot infer intended colors from an uncolored STL, and automatic mapping to the user's loaded filament slots is not guaranteed.

## Current Terrain Press export and compatibility

Inspection of source/core.js on main found model3mf(parts, colors, title) emits separate component objects grouped by role, with core basematerials and displaycolor. It does not yet export texture coordinates, color groups or per-face paint information.

Important correction to any overly broad earlier description: core displaycolor is a rendering hint; the 3MF specification explicitly does not guarantee its effect on printed color. Existing component separation is a useful foundation, but a complete color-print workflow needs more than adding palette entries.

The 3MF materials extension defines richer colors/textures. Standard support does not establish identical behavior across slicers. Prusa documents multipart import and native multi-material painting, including conversion of painted surfaces into interior material regions. Its documentation is not evidence that every third-party color/texture 3MF imports identically.

Bambu's official standard-3MF color and OBJ import documentation URLs were identified but could not be retrieved by the research browser. No specific Bambu/Orca compatibility claim is considered verified here. Test actual supported versions before choosing an export contract.

Required slicer matrix: Bambu Studio, OrcaSlicer and PrusaSlicer, with version numbers and known printer profiles. Check geometry, palette mapping, sliced toolpaths and saved/reopened project behavior, not just a colored viewport.

## Giant-planet sources and presentation

Jupiter is the recommended first panel prototype because its belts and storms offer strong graphic structure. Saturn is a strong second candidate, particularly as a disk-and-rings portrait. Uranus and Neptune are also possible but may need fewer colors or clearly labeled contrast enhancement.

MAST's Hubble OPAL archive contains time-tagged maps for Jupiter, Saturn, Uranus and Neptune. It offers per-filter FITS maps and TIFF/PNG previews. Do not assume every science product is a ready-made natural-color RGB image: choose reviewed channel combinations or suitable published color composites, preserve epoch/filter/projection metadata, and follow acknowledgement requirements.

NASA Cassini natural-color Saturn portraits are another source for a framed panel. A portrait includes viewing geometry and lighting; it is not interchangeable with a longitude/latitude map. Rings are separate from a surface map and should use a portrait composition or explicit ring geometry.

Atmospheric features change. Save the exact image/version/date rather than claiming timeless geography. Any height assigned to color bands is artistic construction, not gas-giant terrain. Preserve labels distinguishing natural/approximate color, enhanced color and false color; verify image-specific credit/reuse terms.

## Shared controls and acceptance

Proposed controls:
- Mode: layered image panel / flat multicolor panel / colored terrain.
- Palette size 2–8, editable swatches and optional user-supplied filament colors.
- Crop, image/map selection, observation epoch and color treatment.
- Minimum printed feature size and island cleanup; dithering off by default to avoid tiny isolated material regions.
- Layer order and band thickness for stacked panels; terrain exaggeration remains independent for colored relief.
- Preview actual quantized geometry/regions, with estimates for parts and feature loss. Slicer determines actual print time and purge use.

Acceptance prototypes:
1. A four-color Jupiter panel with a documented manual-swap schedule.
2. Two- and eight-color variants, checking support, visibility and minimum thickness.
3. A small real terrain crop with a four-color registered image.
4. Multipart versus painted 3MF import, slice, save/reopen and physical print comparisons.

Test disconnected islands, tiny storms, contour holes, palette duplicates, dateline/polar seams, image coverage gaps, dark/light underpainting, color-boundary cracks, puzzle-piece alignment and print orientation. Eight palette colors do not imply that every printer has eight simultaneously available material channels. Height-swap panels can use sequential manual changes; arbitrary terrain painting generally requires a suitable multicolor setup or a more involved assembly workflow.

Recommended order: prove layered panels first, then the shared palette pipeline, then one slicer-tested terrain-color export path, then additional compatibility profiles. Keep this as research until implementation is explicitly requested.

## Primary references

- 3MF core, especially section 5.1 and displaycolor: https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md
- 3MF materials extension: https://github.com/3MFConsortium/spec_materials/blob/master/3MF%20Materials%20Extension.md
- Prusa multipart import: https://help.prusa3d.com/article/importing-multi-material-model_121191
- Prusa multi-material painting: https://help.prusa3d.com/article/multi-material-painting_262620
- Prusa height-based color changes: https://help.prusa3d.com/article/color-change_1687
- Bambu standard color import (retrieval unverified): https://wiki.bambulab.com/en/bambu-studio/Standard-3MF-File-Color-Parsing
- Bambu OBJ import (retrieval unverified): https://wiki.bambulab.com/en/software/bambu-studio/import_obj
- Hubble OPAL data, formats and acknowledgement: https://archive.stsci.edu/hlsp/opal
- NASA Saturn natural-color portrait: https://science.nasa.gov/photojournal/the-greatest-saturn-portrait-yet/
- USGS Jupiter mosaics (includes false-color products): https://astrogeology.usgs.gov/search/map/jupiter-voyager-and-galileo-global-mosaics
