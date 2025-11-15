const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  buildFromFolder: payload => ipcRenderer.invoke('build-from-folder', payload),
  chooseIcon: () => ipcRenderer.invoke('choose-icon'),
  chooseFolder: startDir => ipcRenderer.invoke('choose-source-folder', startDir),
  chooseFiles: options => ipcRenderer.invoke('choose-files', options),
  ensureFolderPaths: paths => ipcRenderer.invoke('ensure-folder-paths', paths),
  onBuildProgress: callback => {
    ipcRenderer.on('build-progress', (_event, data) => {
      if (typeof callback === 'function') {
        callback(data)
      }
    })
  }
})
