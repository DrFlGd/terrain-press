'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, net, protocol, shell } = require('electron');
const { resolveAssetPath } = require('./asset-path');

// A secure, standard origin is necessary for relative assets, fetch() and Web Workers.
// No HTTP server, network connection, Node.js API, or preload is exposed to the page.
protocol.registerSchemesAsPrivileged([
  { scheme: 'terrain', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

function siteDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'site')
    : path.resolve(__dirname, '..', 'site');
}

function openExternal(url) {
  try {
    const target = new URL(url);
    if ((target.protocol === 'https:' || target.protocol === 'http:') &&
        !target.username && !target.password) {
      shell.openExternal(target.href).catch(console.error);
    }
  } catch {
    // Ignore invalid or unsafe URLs.
  }
}

function createWindow() {
  const win = new BrowserWindow({
    title: 'Terrain Press',
    width: 1440,
    height: 920,
    minWidth: 850,
    minHeight: 650,
    backgroundColor: '#101820',
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('terrain://app/')) {
      event.preventDefault();
      openExternal(url);
    }
  });

  win.loadURL('terrain://app/index.html');
}

app.whenReady().then(() => {
  const root = siteDirectory();
  protocol.handle('terrain', request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    const file = resolveAssetPath(root, request.url);
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
