'use strict'
// Minimal preload — exposes read-only desktop metadata to the renderer.
// In smoke mode also installs an early global error trap so that unhandled
// rejections / window errors during app startup are captured (executeJavaScript
// from the main process propagates page-level unhandled rejections as its own
// error, which makes debugging hard without this).
const { contextBridge } = require('electron')

const smokeErrors = []

contextBridge.exposeInMainWorld('mve', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  smokeErrors: () => smokeErrors.slice(),
})

if (process.env.MVE_SMOKE_TEST === '1' || process.argv.includes('--smoke')) {
  window.addEventListener('unhandledrejection', (e) => {
    const d = e && e.reason
    smokeErrors.push('UNHANDLED: ' + (d && (d.stack || d.message) || String(d)))
  })
  window.addEventListener('error', (e) => {
    smokeErrors.push('ERROR: ' + (e.error && (e.error.stack || e.error.message) || e.message))
  })
}
