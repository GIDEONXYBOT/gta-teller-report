const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printHTML: (html, printer) => ipcRenderer.invoke('print-html', html, printer),
  getAvailablePrinters: () => ipcRenderer.invoke('get-printers'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),
  onTriggerUpdateCheck: (callback) => ipcRenderer.on('trigger-update-check', callback)
});
