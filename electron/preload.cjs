'use strict'
// Minimal preload — exposes read-only desktop metadata to the renderer.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('mve', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
})
