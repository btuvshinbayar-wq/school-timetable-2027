/**
 * Десктоп программын аюулгүй гүүр: renderer зөвхөн эдгээр функцийг дуудна (Node-д шууд хандахгүй).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  license: {
    status: () => ipcRenderer.invoke('license:status'),
    activate: (key) => ipcRenderer.invoke('license:activate', key),
    importFile: () => ipcRenderer.invoke('license:importFile'),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
  },
  backup: {
    save: (json) => ipcRenderer.invoke('backup:save', json),
    list: () => ipcRenderer.invoke('backup:list'),
    load: (filename) => ipcRenderer.invoke('backup:load', filename),
    openFolder: () => ipcRenderer.invoke('backup:openFolder'),
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    saveFile: (defaultName, content) => ipcRenderer.invoke('app:saveFile', defaultName, content),
    copy: (text) => ipcRenderer.invoke('app:copy', text),
  },
});
