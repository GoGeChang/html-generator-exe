const { app, BrowserWindow, ipcMain, dialog, session } = require('electron')
const path = require('path')
const fs = require('fs')
const fsExtra = require('fs-extra')
const os = require('os')
const { spawn } = require('child_process')



let mainWindow = null

const isDev = process.env.NODE_ENV === 'development'
const APP_TITLE = '网站应用生成器'

if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}


function createWindow() {
  const iconPath = resolveAppIconPath()
  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    title: APP_TITLE,
    icon: iconPath,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.setTitle(APP_TITLE)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev) {
    // 开发：优先使用环境变量指向的 Vite Dev Server，其次尝试常用端口 5173
    const devServerURL = process.env.VITE_DEV_SERVER_URL
      || process.env.ELECTRON_RENDERER_URL
      || process.env.VITE_DEV_URL
      || 'http://localhost:9010'
    mainWindow.loadURL(devServerURL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 生产：加载 Vite 构建后的文件
    mainWindow.loadFile(path.join(__dirname, 'renderer-dist', 'index.html'))
  }
}

const baseCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' ws://localhost:9010 ws://127.0.0.1:9010"
].join('; ')

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...(details.responseHeaders || {}) }
    headers['Content-Security-Policy'] = [baseCsp]
    callback({ responseHeaders: headers })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.handle('choose-icon', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择图标文件',
    filters: [{ name: 'Images', extensions: ['ico', 'png', 'icns'] }],
    properties: ['openFile']
  })
  if (canceled || filePaths.length === 0) return { canceled: true }
  return { canceled: false, filePath: filePaths[0] }
})

const HTML_EXTS = new Set(['.html', '.htm'])

function isHtmlFile(filePath) {
  return HTML_EXTS.has(path.extname(filePath || '').toLowerCase())
}

function resolveWindowsArchPreference(arch = 'x86', bits = '64') {
  const normalizedArch = arch === 'arm' ? 'arm' : 'x86'
  const normalizedBits = bits === '32' ? '32' : '64'

  if (normalizedArch === 'arm') {
    if (normalizedBits !== '64') {
      return { error: 'Windows ARM 构建目前仅支持 64 位 (arm64)。' }
    }
    return { args: ['--arm64'], label: 'Windows ARM64' }
  }

  if (normalizedBits === '32') {
    return { args: ['--ia32'], label: 'Windows x86 32 位' }
  }

  return { args: ['--x64'], label: 'Windows x86 64 位' }
}

function resolveTemplatesRoot() {
  if (app.isPackaged) {
    const appPath = app.getAppPath()
    const asarTemplates = path.join(appPath, 'templates')
    if (fs.existsSync(asarTemplates)) return asarTemplates

    const unpacked = path.join(process.resourcesPath, 'templates')
    if (fs.existsSync(unpacked)) return unpacked

    const fallback = path.join(process.resourcesPath, 'app.asar.unpacked', 'templates')
    if (fs.existsSync(fallback)) return fallback

    return asarTemplates
  }
  return path.join(app.getAppPath(), '..', 'templates')
}

function resolveAppIconPath() {
  try {
    const icon = path.join(resolveTemplatesRoot(), 'electron-wrapper', 'build', 'icon.png')
    return fs.existsSync(icon) ? icon : undefined
  } catch (_) {
    return undefined
  }
}

ipcMain.handle('choose-source-folder', async (_event, payload) => {
  let startDir
  let mode = 'auto'

  if (typeof payload === 'string') {
    startDir = payload
  } else if (payload && typeof payload === 'object') {
    startDir = payload.startDir
    mode = payload.mode || 'auto'
  }

  const start = (typeof startDir === 'string' && fs.existsSync(startDir)) ? startDir : undefined

  const props = (() => {
    if (mode === 'directory') return ['openDirectory']
    if (mode === 'html') return ['openFile']
    return ['openDirectory', 'openFile']
  })()

  const filters = props.includes('openFile')
    ? [
      { name: 'HTML', extensions: ['html', 'htm'] },
      { name: '所有文件', extensions: ['*'] }
    ]
    : undefined

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择要打包的网页文件夹或 HTML 文件',
    properties: props,
    filters,
    defaultPath: start
  })

  if (canceled || !filePaths?.length) return { canceled: true }
  const selectedPath = filePaths[0]
  try {
    const stat = fs.lstatSync(selectedPath)
    const isDirectory = stat.isDirectory()
    if (!isDirectory && !isHtmlFile(selectedPath)) {
      return { canceled: false, error: '请选择文件夹或 HTML 文件', sourcePath: selectedPath, isDirectory: false }
    }
    return {
      canceled: false,
      sourcePath: selectedPath,
      folderPath: selectedPath,
      isDirectory
    }
  } catch (err) {
    return { canceled: false, error: err.message }
  }
})

ipcMain.handle('choose-files', async (_event, options = {}) => {
  const { filters, multi, title, defaultPath } = options
  const defPath = (typeof defaultPath === 'string' && fs.existsSync(defaultPath)) ? defaultPath : undefined
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: title || '选择文件',
    filters: Array.isArray(filters) && filters.length > 0 ? filters : [
      { name: 'All Files', extensions: ['*'] },
      { name: 'HTML', extensions: ['html', 'htm'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'ico', 'svg'] },
      { name: 'Scripts', extensions: ['js'] },
      { name: 'Styles', extensions: ['css'] }
    ],
    properties: ['openFile', ...(multi ? ['multiSelections'] : [])],
    defaultPath: defPath
  })
  if (canceled || filePaths.length === 0) return { canceled: true, filePaths: [] }
  return { canceled: false, filePaths }
})

ipcMain.handle('ensure-folder-paths', async (_event, paths = []) => {
  try {
    const entries = []
    for (const raw of Array.isArray(paths) ? paths : []) {
      if (typeof raw !== 'string') continue
      try {
        const stat = fs.lstatSync(raw)
        if (stat.isDirectory()) {
          entries.push({ path: raw, isDirectory: true })
        } else if (stat.isFile() && isHtmlFile(raw)) {
          entries.push({ path: raw, isDirectory: false })
        }
      } catch (_) {
        continue
      }
    }
    return { entries }
  } catch (err) {
    return { entries: [], error: err.message }
  }
})

ipcMain.handle('build-from-folder', async (event, payload = {}) => {
  const sender = event && event.sender

  const report = (step, message) => {
    if (!sender) return
    try {
      sender.send('build-progress', {
        step,
        message,
        timestamp: Date.now()
      })
    } catch (e) {
      // ignore send errors
    }
  }

  report('start', '开始准备构建，请稍候...')

  const {
    folderPath,
    title,
    iconPath,
    platform = 'win',
    winArch = 'x86',
    winBits = '64'
  } = payload
  const sourcePath = folderPath || payload.sourcePath

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { success: false, error: '请选择有效的站点目录或 HTML 文件' }
  }

  let sourceStat
  try {
    sourceStat = fs.lstatSync(sourcePath)
  } catch (err) {
    return { success: false, error: err.message }
  }

  const isDirectory = sourceStat.isDirectory()
  const isHtml = !isDirectory && sourceStat.isFile() && isHtmlFile(sourcePath)

  if (!isDirectory && !isHtml) {
    return { success: false, error: '仅支持文件夹或 HTML 文件（*.html, *.htm）' }
  }

  report('analyze-source', isDirectory
    ? '已识别为站点目录，开始准备模板工程...'
    : '已识别为单个 HTML 文件，开始准备模板工程...')

  const target = platform === 'mac' ? 'mac' : 'win'
  let windowsArch = null

  if (target === 'win') {
    windowsArch = resolveWindowsArchPreference(winArch, winBits)
    if (windowsArch?.error) {
      return { success: false, error: windowsArch.error }
    }
  }

  const buildMeta = {
    win: {
      args: ['--win', 'portable'],
      targetNames: ['portable'],
      ext: '.exe',
      title: '选择生成 EXE 的输出位置',
      filters: [{ name: 'Windows 可执行程序', extensions: ['exe'] }],
      artifactExts: ['.exe'],
      extraArgs: windowsArch?.args || []
    },
    mac: {
      args: ['--mac', 'dmg'],
      targetNames: ['dmg'],
      ext: '.dmg',
      title: '选择生成 macOS 安装包的位置',
      filters: [{ name: 'macOS 安装镜像', extensions: ['dmg'] }],
      artifactExts: ['.dmg', '.pkg', '.zip'],
      extraArgs: []
    }
  }[target]

  try {
    report('choose-output', '请选择生成文件的保存位置...')
    const { canceled, filePath: outputPath } = await dialog.showSaveDialog({
      title: buildMeta.title,
      defaultPath: `${title || 'MyHtmlApp'}${buildMeta.ext}`,
      filters: buildMeta.filters
    })

    if (canceled || !outputPath) return { success: false, error: '用户取消导出' }

    report('copy-template', '正在复制模板工程...')
    const templateDir = path.join(resolveTemplatesRoot(), 'electron-wrapper')

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-wrap-'))
    const workDir = path.join(tempRoot, 'project')

    await copyTemplateSkeleton(templateDir, workDir)
    report('copy-template-done', '模板工程已准备，正在复制站点文件...')

    const distDir = path.join(workDir, 'dist')
    await fsExtra.emptyDir(distDir)

    if (isDirectory) {
      await fsExtra.copy(sourcePath, distDir)
    } else if (isHtml) {
      await fsExtra.ensureDir(distDir)
      await fsExtra.copyFile(sourcePath, path.join(distDir, 'index.html'))
    }

    report('config', '站点文件已复制，正在写入应用配置...')
    const configPath = path.join(workDir, 'config.json')
    const config = {
      title: title || 'My HTML App',
      icon: null
    }

    if (iconPath) {
      const buildDir = path.join(workDir, 'build')
      await fsExtra.ensureDir(buildDir)
      const ext = path.extname(iconPath).toLowerCase()
      const iconName = `icon${ext || '.png'}`
      await fsExtra.copy(iconPath, path.join(buildDir, iconName))
      config.icon = path.join('build', iconName)

      if (target === 'win' && ext !== '.ico') {
        // 尝试保留模板自带的 icon.ico，若需要自定义需提供 .ico
        console.warn('Windows 构建建议使用 .ico 图标，否则将使用模板默认图标')
      }

      if (target === 'mac' && ext === '.icns') {
        // 已复制为 icon.icns，electron-builder 会自动使用
      } else if (target === 'mac') {
        console.warn('macOS 构建建议使用 .icns 图标，否则将使用模板默认图标')
      }
    }

    await fsExtra.writeJson(configPath, config, { spaces: 2 })

    report('build', '配置完成，正在使用 electron-builder 打包，这一步可能需要一些时间...')
    await runElectronBuilder(workDir, {
      platform: target,
      targetNames: buildMeta.targetNames,
      archArgs: buildMeta.extraArgs
    })

    report('build-done', '打包完成，正在导出最终文件...')
    const outDir = path.join(workDir, 'build-output')
    const artifact = fs.readdirSync(outDir)
      .find(f => buildMeta.artifactExts.includes(path.extname(f).toLowerCase()))

    if (!artifact) throw new Error('未找到构建产物，请检查 electron-builder 日志')

    await fsExtra.copy(path.join(outDir, artifact), outputPath)

    report('success', '构建成功！')
    return { success: true, outputPath }

  } catch (err) {
    report('error', `构建失败：${err.message || String(err)}`)
    return { success: false, error: err.message }
  }
})

async function runElectronBuilder(cwd, options = {}) {
  const { platform = 'win', targetNames = [], archArgs = [] } = options

  let builder
  try {
    if (app.isPackaged) {
      // 打包后的生成器：从 resources/vendor/node_modules 里加载 electron-builder
      const vendorNodeModules = path.join(process.resourcesPath, 'vendor', 'node_modules')
      const builderModulePath = path.join(vendorNodeModules, 'electron-builder')
      builder = require(builderModulePath)
    } else {
      // 开发环境：直接用当前工程的 node_modules
      builder = require('electron-builder')
    }
  } catch (err) {
    throw new Error('无法加载 electron-builder 模块: ' + err.message)
  }

  const { build, Platform, Arch } = builder

  let platformObj
  if (platform === 'mac') {
    platformObj = Platform.MAC
  } else if (platform === 'linux') {
    platformObj = Platform.LINUX
  } else {
    platformObj = Platform.WINDOWS
  }

  const archs = []
  if (archArgs.includes('--x64')) archs.push(Arch.x64)
  if (archArgs.includes('--ia32')) archs.push(Arch.ia32)
  if (archArgs.includes('--arm64')) archs.push(Arch.arm64)
  if (archs.length === 0) archs.push(Arch.x64)

  const targets = platformObj.createTarget(
    targetNames && targetNames.length ? targetNames : undefined,
    archs
  )

  const prevNoAsar = process.noAsar
  process.noAsar = true
  try {
    await build({
      targets,
      projectDir: cwd
    })
  } catch (err) {
    throw new Error('electron-builder 失败: ' + (err.message || String(err)))
  } finally {
    process.noAsar = prevNoAsar
  }
}


async function copyTemplateSkeleton(templateDir, workDir) {
  await fsExtra.ensureDir(workDir)

  const filter = (src) => {
    const rel = path.relative(templateDir, src)
    if (!rel || rel.startsWith('..')) return true
    // 不把模板里的 node_modules 复制进临时工程，避免携带默认的 Electron runtime（default_app.asar）
    if (rel.split(path.sep).includes('node_modules')) return false
    return true
  }

  await fsExtra.copy(templateDir, workDir, { dereference: true, filter })

}

async function ensureElectronBuilder(workDir) {
  // 需要的模块列表：electron-builder 及其关键依赖
  const modules = ['electron-builder', 'builder-util', 'app-builder-lib', 'app-builder-bin']


  for (const name of modules) {
    const targetDir = path.join(workDir, 'node_modules', name)
    if (fs.existsSync(targetDir)) {
      continue
    }

    // 从打包后的资源中找到对应 vendor 目录
    let bundledDir
    if (app.isPackaged) {
      // 生成器打包后，在 resources/vendor 下
      bundledDir = path.join(process.resourcesPath, 'vendor', name)
    } else {
      // 开发环境：直接用当前工程的 node_modules
      bundledDir = path.join(__dirname, 'node_modules', name)
    }

    if (!fs.existsSync(bundledDir)) {
      // dev 模式下，如果没找到也算致命错误，方便排查
      throw new Error(`找不到内置的模块 ${name}，路径: ${bundledDir}`)
    }

    await fsExtra.ensureDir(path.dirname(targetDir))
    await fsExtra.copy(bundledDir, targetDir, { dereference: true })
  }
}

function resolveBundledBuilderPath() {
  const candidates = [
    path.join(__dirname, 'node_modules', 'electron-builder'),
    path.join(app.getAppPath(), 'node_modules', 'electron-builder'),
    path.join(process.resourcesPath, 'vendor', 'electron-builder'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'vendor', 'electron-builder')
  ]

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  return null
}
