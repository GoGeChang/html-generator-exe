
// renderer/renderer.js
// 提供统一的 Electron IPC 调用封装，供 Vue 组件/逻辑调用

export const electronAPI = {
  async chooseIcon() {
    if (window.electronAPI?.chooseIcon) {
      return await window.electronAPI.chooseIcon()
    }
    if (window.api?.invoke) {
      // 兜底：用文件选择器挑选图标
      return await window.api.invoke('choose-files', {
        title: '选择图标',
        multi: false,
        filters: [
          { name: 'Images', extensions: ['png', 'ico', 'icns', 'jpg', 'jpeg'] }
        ]
      })
    }
    return { canceled: true }
  },

  async buildFromFolder(payload = {}) {
    if (window.electronAPI?.buildFromFolder) {
      return await window.electronAPI.buildFromFolder(payload)
    }
    if (window.api?.invoke) {
      return await window.api.invoke('build-from-folder', payload)
    }
    throw new Error('No bridge to main process found')
  },

  async chooseFiles(options = {}) {
    if (window.electronAPI?.chooseFiles) {
      return await window.electronAPI.chooseFiles(options)
    }
    if (window.api?.invoke) return await window.api.invoke('choose-files', options)
    return { canceled: true, filePaths: [] }
  },

  async chooseFolder(options) {
    const payload = typeof options === 'object' && options !== null
      ? options
      : { startDir: options }
    if (window.electronAPI?.chooseFolder) {
      return await window.electronAPI.chooseFolder(payload)
    }
    if (window.api?.invoke) return await window.api.invoke('choose-source-folder', payload)
    return { canceled: true }
  },

  async ensureFolderPaths(paths = []) {
    if (window.electronAPI?.ensureFolderPaths) {
      return await window.electronAPI.ensureFolderPaths(paths)
    }
    if (window.api?.invoke) return await window.api.invoke('ensure-folder-paths', paths)
    const entries = (Array.isArray(paths) ? paths : [])
      .filter(Boolean)
      .map(p => ({ path: p, isDirectory: true }))
    return { entries }
  }
}
