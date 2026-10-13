'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('terrainPacks', Object.freeze({
  status: () => ipcRenderer.invoke('terrain-packs:status'),
  chooseDirectory: () => ipcRenderer.invoke('terrain-packs:choose-directory'),
  download: id => ipcRenderer.invoke('terrain-packs:download', id),
  cancel: id => ipcRenderer.invoke('terrain-packs:cancel', id),
  remove: id => ipcRenderer.invoke('terrain-packs:remove', id),
  onProgress: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_, progress) => callback(progress);
    ipcRenderer.on('terrain-packs:progress', listener);
    return () => ipcRenderer.removeListener('terrain-packs:progress', listener);
  }
}));
