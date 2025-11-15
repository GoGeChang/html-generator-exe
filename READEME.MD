# html2electron-exe

把任意静态 HTML（单文件或整站目录）一键打包成桌面应用（Electron EXE / macOS DMG）

本项目是一个跨平台的 **静态站点 → 桌面应用生成器**。  
你可以把一个 `index.html` 或一个包含 HTML/CSS/JS/图片的完整目录拖进来，它会自动生成一套独立运行的 Electron 应用。

⚠ 当前版本重点支持 **macOS → 生成 EXE / DMG**  
Windows 原生环境适配中（Windows 上可运行，但自动打包流程仍在完善）。

---

## ✨ 功能特点

### ✔ 一键将 HTML 转换为可执行应用

- 支持单文件 `index.html`
- 支持整个静态网站目录（HTML + CSS + JS + 图片）
- 自动复制资源、生成最终应用

### ✔ 自动生成跨平台 Electron 应用

- macOS：生成 `.app` + `.dmg`
- Windows：生成 `.exe`（mac 打包流程已通）

### ✔ 完整无边框但保留系统窗口按钮

- 去掉 Electron 默认英文菜单栏
- 保留关闭 / 缩小 / 全屏窗口控制（符合用户习惯）

### ✔ 可配置图标 / 应用名

- 用户可指定应用标题
- 用户可指定应用图标（`.png`）

### ✔ 基于模板的独立应用壳（electron-wrapper）

- 模板中只有启动壳与加载逻辑
- 用户的 HTML 放入时自动覆盖模板 `dist/`

---

## 🧱 项目结构

```
html2electron-exe
├── generator-app/         🚀 应用生成器（你看到的 GUI）
│   ├── main.js            主进程（核心打包逻辑）
│   ├── preload.js
│   ├── renderer-dist/     前端界面构建后的产物
│   ├── templates/
│   │   └── electron-wrapper/  🧩 用来生成最终应用的模板壳
│   └── package.json
└── templates/
    └── electron-wrapper/   🔧 最终应用壳模板
```

---

## 🚀 使用方式（开发者）

### 1. 克隆项目

```bash
git clone https://github.com/xxxxx/html2electron-exe.git
cd html2electron-exe/generator-app
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发模式

```bash
npm run dev
```

### 4. 打包生成器（mac）

```bash
npm run build:renderer
npm run dist:mac
```

运行后输出的 DMG 安装包就是最终的“网站应用生成器”。

---

## 🖥 使用方式（最终用户：mac）

1. 打开“网站应用生成器”
2. 拖入：
   - `index.html` 文件  
     或
   - 整个网站目录（含 HTML/CSS/JS/图片）
3. 填写应用名称、图标（可选）
4. 点击「生成应用」
5. 稍等片刻，即可得到一个可直接运行的桌面应用

---

## 🧩 生成逻辑概述

流程如下：

1. 复制模板：`templates/electron-wrapper`
2. 清空模板 `dist/`，复制用户提供的 HTML/目录
3. 生成 `config.json`（记录窗口标题等）
4. 使用 `electron-builder` 在 _临时目录_ 中对模板壳进行二次打包
5. 最终产出 `.exe` / `.app` / `.dmg`

特别说明：  
为了让应用更纯净，我们移除了模板工程的 `node_modules`，不包含默认的 Electron runtime（防止 default_app.asar 问题）。

---

## 🧪 当前兼容性

| 功能             | macOS    | Windows                | Linux  |
| ---------------- | -------- | ---------------------- | ------ |
| 运行生成器       | ✔ 已完成 | ✔ 已可运行             | 未测试 |
| 打包 HTML → 应用 | ✔ 稳定   | ⚠ 带有局限（正在完善） | 未测试 |
| 自定义标题       | ✔        | ✔                      | -      |
| 自定义图标       | ✔        | ✔                      | -      |
| 去除菜单栏       | ✔        | ✔                      | -      |

### ⚠ Windows 重要说明

macOS 下构建 Windows 版生成器可运行，但：

- Windows 上打包时依赖的 `app-builder.exe` 偶尔会执行失败
- 问题原因在于 **交叉平台打包的 node_modules 与 Windows 运行环境不完全兼容**

因此 Windows 版将在后续版本重新设计并正式支持。

---

## 🛣 后续路线图

- [ ] Windows 本地构建完整支持
- [ ] Windows 免 Node 环境一键打包
- [ ] Linux 支持（AppImage / deb）
- [ ] 可选无框 + 自定义标题栏
- [ ] 更丰富的应用模板

---

## 🤝 参与贡献

欢迎 PR、Issue。  
如果你遇到某个页面无法正确渲染、某些 JS 无效、打包后行为异常，都欢迎提交问题。

---

## 📄 License

MIT License  
可以自由商用 / 修改 / 再发布。

---

如果你正在用这个工具把网站变成桌面应用，希望它也能帮到更多人 😀
