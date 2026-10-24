# Giant-planet color prints

Saturn, Uranus and Neptune now join Jupiter in the main world selector. Select an area on the globe, then use the existing ornament, puzzle, hex-grid, frame, tray and lettering workflow. All pieces share a 2–8-color palette and layer-change schedule. These are artistic color-band heights, not measured atmospheric elevation. Saturn's rings are not geometry in this workflow.

Color detail now includes **1024 cells across**, for giant prints, standalone full-map panels, and rocky-world surface painting. This doubles the linear sampling limit and quadruples the maximum cell count compared with 512. Higher detail takes more memory and time and can create features smaller than a nozzle; it cannot recover detail missing from a source image. Defaults remain unchanged. Rocky painting still assigns materials to terrain triangles, whose size also limits visible color detail.

## Bundled sources and coverage

All maps are available offline. The added maps use Hubble OPAL Cycle 31 rotation A color composites. They are contrast-enhanced filter composites, not calibrated natural colors. Uranus and Neptune's published maps already oversample the telescope observations; their relatively subtle bands are expected.

| World | Source date | Bundled dimensions | Printable latitude |
| --- | --- | --- | --- |
| Jupiter | 2015-01-19 | 3600 × 1598 | −79.9° to +79.9° |
| Saturn | 2024-08-22 | 1800 × 900 | −65° to −8°, +5° to +75° |
| Uranus | 2023-09-17 | 721 × 361 | −10° to +90° |
| Neptune | 2025-06-28 | 721 × 361 | −90° to +35° |

Conservative latitude bands exclude missing polar data, limb artifacts and Saturn's ring-obscured strip. Outside those bands, the globe is gray and generation rejects the selection. No gaps are filled or interpreted as dark clouds. The standalone full-map panel uses a continuous usable strip: Saturn +5° to +75°, Uranus −10° to +90°, Neptune −90° to +35°. “Full-map” means the complete longitude span of that strip.

The published OPAL maps have different longitude conventions. Terrain Press deliberately retains image-relative longitude for all four worlds (image center = 0; left edge = −180; increasing to the right). These coordinates are not calibrated System III or official east/west longitudes. Latitudes are planetographic; selection distances use an equatorial-radius sphere and are approximate. The source READMEs preserve original conventions and observation details. Transient clouds, mosaic seams, moon transits and processing artifacts can remain in observed areas.

## Sources and attribution

- [Saturn Cycle 31](https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-31): F631N red, F502N green, F395N blue; 60268-km equatorial radius.
- [Uranus Cycle 31](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-31): F657N red, F547M green, F467M blue; 25559-km equatorial radius.
- [Neptune Cycle 31](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-31): F657N red, F547M green, F467M blue; 24764-km equatorial radius. Failed 2024 observations were repeated in June 2025.
- [OPAL archive and DOI](https://archive.stsci.edu/hlsp/opal), doi:10.17909/T9G593.
- [Jupiter provenance](JUPITER-PANELS.md#source).

Credit: NASA, ESA, A. Simon (GSFC), M. Wong (UC Berkeley), G. Orton (JPL-Caltech).

This work used data acquired from the NASA/ESA HST Space Telescope, associated with OPAL program (PI: Simon, GO13937), and archived by the Space Telescope Science Institute, which is operated by the Association of Universities for Research in Astronomy, Inc., under NASA contract NAS 5-26555. All maps are available at http://dx.doi.org/10.17909/T9G593.

Bundled derivatives convert published TIFF RGB values to lossless PNG with an explicit alpha coverage mask. Dimensions and orientation are retained; no sharpening or synthetic detail is added. Run `python tools/build-giant-imagery.py` with Pillow and NumPy to reproduce them. Image terms are separate from the software license; no agency endorsement.

## Printing and validation

Standard exports retain STL/3MF, spread/individual pieces, piece map and PDF guide, plus `color-changes.csv`, `<WORLD>-PRINTING.txt` and `<world>-settings.json`. Print the cloud pieces separately from frame/tray/lettering. Use constant layer height including the first layer; CSV changes are before the indicated one-based layer. 3MF materials are surface display assignments; the manual color-change schedule is authoritative for layered prints. Rocky surface painting uses slicer material assignments instead of height changes.

Regression tests cover all four workers' puzzle exports, shared palettes, manifold geometry, source dimensions, coverage rejection, default crops, seam wrapping and 1024 quantization. Browser smoke checks exercise new world controls, globes, exports, full-map panels, a 1024 preview and Earth 1024 painting. Slicer import and physical printing of the newly added planets still require user testing.
