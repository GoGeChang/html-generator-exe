// vite.config.js
const path = require('path')
const vue = require('@vitejs/plugin-vue')

module.exports = {
  root: path.resolve(__dirname, 'renderer'),
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer', 'src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 9010,
    strictPort: true,
    open: false
  },
  build: {
    outDir: path.resolve(__dirname, 'renderer-dist'),
    emptyOutDir: true
  }
}
