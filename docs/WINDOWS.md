# Windows desktop edition

Terrain Press can run as a **single portable Windows executable**. It bundles the web configurator, all seven elevation datasets, fonts and JavaScript libraries. It does not host a public web server or require an Internet connection.

## Download and run

Open the [Windows desktop releases](https://github.com/DrFlGd/terrain-press/releases) and download **Terrain-Press-1.4.0-Portable.exe**. On 64-bit Windows 10 or 11, double-click the file. The app may take a moment to unpack on first launch; it does not require installation or administrator access. Configure your terrain, then use **Download print files** to save the ZIP containing STL/3MF output.

The portable executable is **not code-signed**. Windows SmartScreen may warn about an unrecognized publisher; only run binaries downloaded from the repository's release page and verify you trust the project.

## Terrain Data Manager (v1.3.0)

Windows users can install entire lunar DEMs directly from the original NASA Planetary Data System [LOLA GDR archive](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/).

| LOLA dataset | Approximate spacing | Download | Original IMG files |
|---|---:|---:|---:|
| 128 pixels/degree | 237 m | 2.12 GB | 1 |
| 256 pixels/degree | 118 m | 8.49 GB | 4 |
| 512 pixels/degree | 59 m | 33.97 GB | 16 |

Choose a dataset folder on a drive with adequate space, open **Terrain data manager**, and select Download. The app fetches original NASA signed-16-bit IMG files and detached LBL metadata. It validates dimensions, sample type, scale, radius offset, and downloaded byte count, and records a local SHA-256 in a download receipt (not a NASA-published reference checksum). Files are staged until the entire chosen global dataset is present. Cancellation leaves partial files for HTTP-range resume, where supported. The native IMG files are retained; the application creates cached PNG elevation tiles only for terrain you actually use. This avoids a full converted copy of the Moon.

After installation, Terrain Press automatically selects the finest installed global Moon source at arbitrary coordinates unless a bundled landmark patch is finer. All functionality works offline afterward. An unmodified embedded coarse Moon dataset remains available on fresh installs. Other planetary data downloads remain future work.

**Limitations:** Source filenames and metadata have been checked against the public PDS archive. The full multi-gigabyte transfer, offline reuse and resulting STL have not yet been validated end-to-end on a physical Windows system. NASA's availability, rate limits, and transfer/resume behavior may vary. Nominal pixels-per-degree does not guarantee independent measurements at every grid location.

### Export detail: Auto (source matched)

Choose **Print → Export detail → Auto** to sample a print grid using the best available elevation source for the selected coordinates. The source choice is re-evaluated whenever you move from one region to another. Auto increases grid density where NASA resolutions warrant it but limits the sampling to 721 × 721 to avoid unbounded exports. The generated ZIP's README records the actual grid/spacing and flags when it has reached that cap.

The bug in v1.2.0 that caused "Cannot read properties of undefined" when moving from an 83 m landmark to installed NASA global data has been fixed. The downloader stores converted terrain tiles as PNG; the export sampler now reads PNG paths consistently.

This is **resolution-aware uniform meshing**, not yet adaptive triangle subdivision by local surface curvature. A genuine error-controlled adaptive mesh is planned as the next performance/fidelity milestone.

### High-detail preview and large models (v1.4.0)

The **Print → High-detail preview (match export)** switch is off by default for responsive editing. Turning it on rebuilds the interactive model from **the same elevation source, mesh grid spacing and printed geometry as the selected export detail** (Standard, Fine, Ultra or Auto). Changing export detail while it is on triggers a new preview; turning it off switches back to a faster, 0.7-mm-target preview. The preview reports its sample grid and effective spacing so users can see when the 721 × 721 sample cap applies.

Terrain width can now be selected from **60 mm through 1,000 mm**, in 5-mm increments. The preview plate, camera range and shadow boundaries grow with the overall puzzle or ornament so large models are visible. **Large widths do not remove the 721 × 721 grid safety cap.** At 1,000 mm, even the densest uniform grid spaces sample points about 1.39 mm apart on the physical model. Model generation and resulting 3MF/STL/ZIP files may become very large, especially when using puzzles with many pieces; choose an appropriate piece count and arrange individual pieces in your slicer. A 1,000-mm finished model is not necessarily printable in one piece on a typical printer.

This is export-matched preview of the current *uniform-grid* triangulation, not a separate curvature-adaptive triangulation algorithm.

See [the roadmap](TERRAIN-DATA-ROADMAP.md).

## Build locally

With Node.js 22 and npm installed:

    npm install
    npm run test:desktop
    npm run desktop       # local Electron application using the checked-in site/
    npm run dist:win      # on Windows, writes dist/Terrain-Press-1.4.0-Portable.exe

The desktop package uses the already-built site/ directory. If you change source/, run npm run build first (requires Python 3) to regenerate site/. Commit the rebuilt files before making a release.

site/ is shipped in full as an external Electron resource, not fetched from a CDN. The custom terrain://app/ protocol provides a secure local origin for the Web Worker, images, JSON files and other relative assets. Node integration is disabled in the renderer. Normal exports use Electron's native download behavior.

## Publishing

The GitHub Actions workflow .github/workflows/windows-desktop.yml runs the desktop tests, builds on a Windows runner, and uploads the portable .exe to release desktop-v1.4.0 on qualifying pushes to main, or on manual workflow dispatch. For future desktop versions, update the version in package.json and the tag/release name in the workflow before building a new release.
