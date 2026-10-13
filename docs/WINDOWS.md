# Windows desktop edition

Terrain Press can run as a **single portable Windows executable**. It bundles the web configurator, all seven elevation datasets, fonts and JavaScript libraries. It does not host a public web server or require an Internet connection.

## Download and run

Open the [Windows desktop releases](https://github.com/DrFlGd/terrain-press/releases) and download **Terrain-Press-1.1.0-Portable.exe**. On 64-bit Windows 10 or 11, double-click the file. The app may take a moment to unpack on first launch; it does not require installation or administrator access. Configure your terrain, then use **Download print files** to save the ZIP containing STL/3MF output.

The portable executable is **not code-signed**. Windows SmartScreen may warn about an unrecognized publisher; only run binaries downloaded from the repository's release page and verify you trust the project.

## Terrain Data Manager (v1.1.0)

The Windows application includes a **Terrain data manager · Offline datasets** button. It shows the seven bundled worlds, optional upgrade candidates, progress and the directory where verified optional data packs will live. You can select a writable data directory now. The Moon 128/256/512 px-per-degree tiers are **planned, not downloadable yet**; dataset conversion and tile hosting are the next milestones. The downloader is implemented behind a pinned-checksum catalog and will enable verified published packs without changing the underlying STL engine.

See [the implementation roadmap](TERRAIN-DATA-ROADMAP.md) for dataset coverage, the pack manifest protocol, and remaining milestones.

## Build locally

With Node.js 22 and npm installed:

    npm install
    npm run test:desktop
    npm run desktop       # local Electron application using the checked-in site/
    npm run dist:win      # on Windows, writes dist/Terrain-Press-1.1.0-Portable.exe

The desktop package uses the already-built site/ directory. If you change source/, run npm run build first (requires Python 3) to regenerate site/. Commit the rebuilt files before making a release.

site/ is shipped in full as an external Electron resource, not fetched from a CDN. The custom terrain://app/ protocol provides a secure local origin for the Web Worker, images, JSON files and other relative assets. Node integration is disabled in the renderer. Normal exports use Electron's native download behavior.

## Publishing

The GitHub Actions workflow .github/workflows/windows-desktop.yml runs the desktop tests, builds on a Windows runner, and uploads the portable .exe to release desktop-v1.1.0 on qualifying pushes to main, or on manual workflow dispatch. For future desktop versions, update the version in package.json and the tag/release name in the workflow before building a new release.
