# Windows desktop edition

Terrain Press can run as a **single portable Windows executable**. It bundles the web configurator, all seven elevation datasets, fonts and JavaScript libraries. It does not host a public web server or require an Internet connection.

## Download and run

Open the [Windows desktop releases](https://github.com/DrFlGd/terrain-press/releases) and download **Terrain-Press-1.5.1-Portable.exe**. On 64-bit Windows 10 or 11, double-click the file. The app may take a moment to unpack on first launch; it does not require installation or administrator access. Configure your terrain, then use **Download print files** to save the ZIP containing STL/3MF output.

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

Choose **Print → Terrain resolution → Automatic** to sample a grid using the best available elevation source at the selected coordinates and the physical model's useful printable detail. The source choice is re-evaluated whenever you move between regions, and the sampling grid never exceeds 2,881 × 2,881. The generated ZIP's README records the actual grid/spacing and flags when it has reached that cap.

The bug in v1.2.0 that caused "Cannot read properties of undefined" when moving from an 83 m landmark to installed NASA global data has been fixed. The downloader stores converted terrain tiles as PNG; the export sampler now reads PNG paths consistently.

This is **resolution-aware uniform meshing**, not yet adaptive triangle subdivision by local surface curvature. A genuine error-controlled adaptive mesh is planned as the next performance/fidelity milestone.

### High-detail preview and large models (v1.4.0)

The **Print → High-detail preview (match export)** switch is off by default for responsive editing. Turning it on rebuilds the interactive model from **the same elevation source, mesh grid spacing and printed geometry as the selected export detail** (Standard, Fine, Ultra or Auto). Changing the resolution mode or advanced spacing while it is on triggers a new preview; turning it off switches back to a faster, 0.7-mm-target preview. The preview reports its actual sample grid and effective spacing.

Terrain width can now be selected from **60 mm through 1,000 mm**, in 5-mm increments. The preview plate, camera range and shadow boundaries grow with the overall puzzle or ornament so large models are visible. **Large widths do not remove the 2,881 × 2,881 grid safety cap.** At 1,000 mm, the absolute finest uniform grid spacing is about 0.347 mm, though the Automatic planner will often choose a coarser spacing when appropriate. Model generation and resulting 3MF/STL/ZIP files may become very large, especially when using puzzles with many pieces; choose an appropriate piece count and arrange individual pieces in your slicer. A 1,000-mm finished model is not necessarily printable in one piece on a typical printer.

This is export-matched preview of the current *uniform-grid* triangulation, not a separate curvature-adaptive triangulation algorithm.

See [the roadmap](TERRAIN-DATA-ROADMAP.md).

## Build locally

With Node.js 22 and npm installed:

    npm install
    npm run test:desktop
    npm run desktop       # local Electron application using the checked-in site/
    npm run dist:win      # on Windows, writes dist/Terrain-Press-1.5.1-Portable.exe

The desktop package uses the already-built site/ directory. If you change source/, run npm run build first (requires Python 3) to regenerate site/. Commit the rebuilt files before making a release.

site/ is shipped in full as an external Electron resource, not fetched from a CDN. The custom terrain://app/ protocol provides a secure local origin for the Web Worker, images, JSON files and other relative assets. Node integration is disabled in the renderer. Normal exports use Electron's native download behavior.

## Publishing

The GitHub Actions workflow .github/workflows/windows-desktop.yml runs the desktop tests, builds on a Windows runner, and uploads the portable .exe to release desktop-v1.5.1 on qualifying pushes to main, or on manual workflow dispatch. For future desktop versions, update the version in package.json and the tag/release name in the workflow before building a new release.

## Automatic terrain sampling and advanced ceilings (v1.5.0)

**Print → Terrain sampling limit** now offers **Auto (recommended)**, 721 × 721, 1,441 × 1,441 and 2,881 × 2,881. This is separate from the **Export detail** choice (Standard, Fine, Ultra or Auto). The Auto sampling limit estimates only the number of elevation samples useful for the selected real DEM resolution, chosen real-world region width, printed model width and smallest printable feature. For example, on a 100-mm print of a 100-km lunar region, a 59-m DEM and a 0.4-mm minimum feature need about 501 × 501 height samples; the application need not generate 2,881 × 2,881. On a 1,000-mm print of the same region, the same constraints warrant about 2,544 × 2,544.

The **Smallest printable feature** selector offers 0.2, 0.4 (default), 0.6, 0.8 and 1.0 mm. This is an approximation of usable XY detail, **not the printer's layer height**; adjust it to your process/nozzle/printer settings. Auto uses 1.5 samples per DEM pixel and 2 per printable feature, taking the coarser required spacing. In automatic mode, fixed detail presets also avoid excessive tessellation where the native terrain data or printer cannot benefit. Manual ceilings bypass this optimization: they preserve the selected fixed spacing as far as their numeric limit permits.

The Print panel shows the planned sample grid and effective model spacing before export. The generated ZIP README records the selected ceiling, source sample size on the model, printable feature value, actual grid and cap status. Exports and high-detail previews with more than 1,441 samples per side warn about substantial CPU/RAM use; they may still take a long time or exhaust memory on modest systems. The hard maximum remains 2,881 × 2,881. This is a **uniform sampled grid**, not spatially adaptive triangulation, and the printed detail ultimately depends on the DEM quality and real printer resolution.

## Automatic and Advanced resolution controls (v1.5.1)

**Print → Terrain resolution → Automatic** is the default. Choose only the **Smallest printable feature** (0.2, 0.4, 0.6, 0.8 or 1.0 mm). Terrain Press uses the previously introduced source-/print-aware sampling algorithm to avoid finer model geometry than the available terrain data or printer can meaningfully resolve.

Choose **Advanced** when you need explicit manual control. This reveals **mesh spacing** (Standard 0.50 mm, Fine 0.35 mm or Ultra 0.25 mm) and **maximum terrain sample grid** (721, 1,441 or 2,881 per side). Manual settings bypass the printable-feature optimization and can oversample the source data or exhaust available memory. Your Advanced selections are retained when switching back to Automatic. Automatic and Advanced share the same backend planner; no terrain datasets are altered.

**High-detail preview (match export)** uses whichever mode is currently selected. Fast preview remains fixed and inexpensive. The planned grid count is always visible before export; grids larger than 1,441 per side prompt a memory/performance warning.

The next project milestone is extending the Terrain Data Manager to the other supported worlds (Mars, Mercury, Venus, Ceres, Vesta, and coverage-limited Pluto). The actual external data products and reliability of conversion must be verified before enabling downloads; the existing offline assets remain fallback.
