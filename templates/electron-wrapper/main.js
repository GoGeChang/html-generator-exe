const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

function loadConfig() {
  const configPath = path.join(__dirname, 'config.json')
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')) }
  catch { return { title: "HTML App", icon: null } }
}

let win = null
const isWindows = process.platform === 'win32'

function create() {
  const cfg = loadConfig()
  win = new BrowserWindow({
    width: 1024,
    height: 800,
    title: cfg.title,
    show: false,
    icon: cfg.icon ? path.join(__dirname, '..', cfg.icon) : undefined,
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#0f141f'
  })
  win.setMenuBarVisibility(false)
  win.setAutoHideMenuBar(true)
  Menu.setApplicationMenu(null)

  const entryPath = path.join(__dirname, 'dist', 'index.html')

  const loadFallback = (message) => {
    const info = message || '未找到可加载的页面'
    const html = `<h1 style="font-family:sans-serif;padding:32px;">${info}</h1>`
    win.loadURL(`data:text/html,${encodeURIComponent(html)}`)
  }

  win.once('ready-to-show', () => win.show())

  win.webContents.on('did-fail-load', (_event, code, desc) => {
    loadFallback(`加载页面失败：${desc || code}`)
  })

  if (fs.existsSync(entryPath)) {
    win.loadFile(entryPath).catch(err => {
      loadFallback(`无法加载 dist/index.html：${err?.message || err}`)
    })
  } else {
    loadFallback('未找到 dist/index.html，请确认打包内容。')
  }
}

app.whenReady().then(create)
app.on('window-all-closed', () => app.quit())
