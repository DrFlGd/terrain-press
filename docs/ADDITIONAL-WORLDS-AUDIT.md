# Additional worlds: terrain source audit

Research date: 2026-10-18 (America/New_York).
Status: research only; no new worlds enabled and no release scheduled.

## Conclusion

Recommended integration order: Enceladus, Charon, Dione/Tethys/Mimas, then selected Europa sites. Rhea can follow the Saturn importer. Io remains attractive but source acquisition is blocked. These are engineering recommendations, not completed data acceptance.

The audit checked publications, archive descriptions, file listings and selected access endpoints. Except for the Enceladus header/range probe, it did not download or validate complete rasters, compute canonical hashes, test reprojections, or export print models. Published grid spacing is not effective terrain resolution or measurement accuracy. Archive availability does not itself establish redistribution rights; check each product's terms and attribution before bundling.

## Strong candidates

| World | Source and published spacing | Coverage and integration implications |
| --- | --- | --- |
| Enceladus | Schenk/McKinnon 2024 Cassini DEM, 200 m raster; contributing stereo footprints around 400 m | Global product, varying precision/coverage quality. Closest fit to existing GeoTIFF conversion. Heights are in kilometres and must become metres. Reported vertical precision roughly 25–100 m. |
| Charon | New Horizons LORRI/MVIC DEM, 300 m raster | Stereo topography covers about 40% of the surface, despite the global map extent. Reuse Pluto-style coverage handling; unavailable terrain must remain explicit. |
| Dione | PDS 2025 SPC global model, 1.58 km; four regional models, 360–405 m | GeoTIFF radius maps and meshes. Strong base-plus-regional-upgrades fit. Quality weaker in some areas, particularly near the north pole. |
| Tethys | PDS 2025 SPC global model, 1.50 km; four regional models, 235–400 m | GeoTIFF radius maps and meshes. Can share Dione's conversion and quality workflow. |
| Mimas | PDS 2025 SPC global model, 560 m | GeoTIFF and mesh products with assessment maps. Useful global candidate; finer regional models are not included in this release. |
| Rhea | PDS 2025 SPC global model, 2.15 km | GeoTIFF and mesh products. Feasible, with less fine terrain detail than the other recommendations. |

Dione, Tethys, Mimas and Rhea archive pages list a 2025-08-28 release. Their radius/shape maps require a reviewed reference figure and units; do not treat raw radii as signed elevations. Equatorial and polar products may need reprojection and stitching. Assessment products should guide coverage/quality disclosures.

### Verified Enceladus access

Source:
https://asc-astropedia.s3.us-west-2.amazonaws.com/Enceladus/Cassini/Enceladus_Cassini_DEM_global_200m_schenk2024.tif

The audit requested bytes 0–16383 and received HTTP 206, TIFF signature 49492a00, and Content-Range bytes 0-16383/129613723. Thus the endpoint was reachable and supported range requests; total reported size was 129,613,723 bytes. This is not a checksum, full decode, or integrity test.

USGS documents elevation values in kilometres, approximately -2.73305 to +2.33912 km. Confirm this against the actual numeric raster before ingestion. Do not interpret the 100 m image mosaic as elevation.

### Primary references

- Enceladus catalog: https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-dem-200m-schenk
- ASU/JMARS explanation: https://jmars.mars.asu.edu/new-enceladus-maps
- Charon catalog: https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_dem_300m
- Charon source paper: https://www.boulder.swri.edu/~layoung/eprint/Schenk%2B2018_Icarus_315_124.pdf
- Dione archive: https://sbn.psi.edu/pds/resource/weirichdioneshape.html
- Dione formats, spacing and regional footprints: https://sbnarchive.psi.edu/pds4/cassini/satellite-dione.cassini.shape-models-maps/document/bundle_description.txt
- Tethys archive: https://sbn.psi.edu/pds/resource/weirichtethysshape.html
- Tethys technical description: https://sbnarchive.psi.edu/pds4/cassini/satellite-tethys.cassini.shape-models-maps/document/bundle_description.txt
- Mimas archive: https://sbn.psi.edu/pds/resource/weirichmimasshape.html
- Mimas technical description: https://sbnarchive.psi.edu/pds4/cassini/satellite-mimas.cassini.shape-models-maps/document/bundle_description.txt
- Rhea archive: https://sbn.psi.edu/pds/resource/weirichrheashape.html
- Rhea technical description: https://sbnarchive.psi.edu/pds4/cassini/satellite-rhea.cassini.shape-models-maps/document/bundle_description.txt

## Conditional candidates

| World | Available evidence | Main condition |
| --- | --- | --- |
| Io | White et al. 2014 stereo DEM, roughly 75% coverage; IoDEM.cub listed at 252.3 MB | Supplement download returned HTTP 403 in this audit. Acquire real source, inspect ISIS special pixels, datum and reuse terms. Existing roadmap also records the regional Tvashtar height-zero problem. |
| Europa | Five USGS controlled regional DTMs, 60–750 m post spacing; effective resolution roughly 180 m–3 km depending on site | Offer named regional sites, not a globally measured world. Source is CC0. Preserve footprint and uncertainty. |
| Phobos / Deimos | 2023 SPC shape models; Phobos resolves features around 100 m; Deimos detailed coverage is strongly hemispheric | Irregular bodies need shape-aware mapping or a small-body mode. Published mesh density is not resolved feature size. Verify current downloadable model and terms. |
| Phoebe | Archived SPC shape model and quality assessments, multiple formats | Inspect irregular shape, radius reference and quality before conversion. |
| Titan | Cornell archive includes measured and interpolated ISIS cubes | Only about 9% directly sampled in the cited global compilation. Label the interpolated global surface; prefer measured-region products for detailed relief. |
| Triton | Published stereo and photoclinometric DEMs | Stereo covers about 5% globally. Shading-derived topography is unsuitable for regional/global elevation comparisons; verify repository files and terms before planning a pack. |

Europa sites: Agenor Linea, Cilix crater, Pwyll crater, chaos/pits near Rhadamanthys Linea, and ridged plains near Yelland Linea. Effective detail differs greatly between them; do not advertise all sites at the finest post spacing.

References:
- Io: https://doi.org/10.1002/2013JE004591
- Europa documentation and license: https://stac.astrogeology.usgs.gov/docs/data/jupiter/europa/europa_controlled_usgs_dtms/
- Phobos/Deimos: https://doi.org/10.1186/s40623-023-01814-7
- Phoebe: https://sbn.psi.edu/pds/resource/weirichphoebeshape.html
- Titan files and CC0 license: https://doi.org/10.7298/m4dv-gv95
- Triton: https://doi.org/10.3390/rs13173476

## Research watchlist

- Miranda, Ariel and Titania: published topographic work and limited Voyager coverage. A sufficiently documented directly accessible package was not verified in this audit. The USRA repository reference could not be opened; do not treat third-party derived game assets as verified science sources.
- Ganymede and Callisto: regional terrain research exists, but a ready global elevation download was not established. Global image mosaics are not DEMs.
- Iapetus: newer SPC products were described as forthcoming in a 2025 abstract; this audit did not verify a released counterpart to the other Saturn packages.
- Giant-planet atmospheric imagery belongs in the separate color-panel proposal, not in an invented surface-elevation catalog.

References:
- Uranian moons: https://doi.org/10.1098/rsta.2020.0102
- Foundational inventory (historical, 2021): https://doi.org/10.3847/psj/abcb94
- Callisto regional work: https://doi.org/10.3847/PSJ/ad61dd
- Saturn SPC research: https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-115.html

## Acceptance before enabling any world

1. Acquire original files and record product version, URL, bytes, hash, license and attribution.
2. Inspect projection, longitude direction/domain, latitude type, units, reference figure and missing-data encoding.
3. Preserve real coverage and quality; distinguish measured, interpolated and unmapped regions.
4. Build a documented low-resolution base; add genuine finer products only where available.
5. Compare independent source samples and known features, especially polar/dateline seams.
6. Verify preview, STL/3MF geometry, offline restart, interrupted downloads, removal and slicer behavior.

The existing water-level feature remains parked. This research does not authorize or schedule its implementation.
