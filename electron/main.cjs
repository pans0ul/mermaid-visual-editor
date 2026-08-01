'use strict'
// Mermaid Visual Editor — Electron desktop shell.
//
// The Next.js static export (out/) is served over http://127.0.0.1:<port>
// from the main process. Serving over HTTP (instead of file://) keeps the
// app's absolute asset paths (_next/static/...), clipboard access and
// download links working exactly like the browser version.
//
// Smoke-test mode:  pnpm desktop:smoke   (or  electron . --smoke)
//   loads the app, waits for React hydration, captures a screenshot,
//   asserts the React Flow canvas mounted, then exits 0/1.

const { app, BrowserWindow, shell } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')

const SMOKE = process.argv.includes('--smoke') || process.env.MVE_SMOKE_TEST === '1'
if (SMOKE) {
  // Chromium sandbox helpers are usually unavailable on CI/headless boxes.
  app.commandLine.appendSwitch('no-sandbox')
  app.disableHardwareAcceleration()
}

// ---------------------------------------------------------------------------
// Locate the static export
// ---------------------------------------------------------------------------
function resolveOutDir() {
  if (app.isPackaged) {
    // electron-builder packs `files` into app.asar under resources/
    return path.join(process.resourcesPath, 'app.asar', 'out')
  }
  return path.join(__dirname, '..', 'out')
}

const OUT_DIR = resolveOutDir()

// ---------------------------------------------------------------------------
// Minimal static file server (SPA fallback + correct MIME types)
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml',
}

function sendFile(res, absPath, ext) {
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control':
      ext === '.html' || ext === '.txt' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  fs.createReadStream(absPath).pipe(res)
}

function createServer() {
  return http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)
      const target = pathname === '/' ? '/index.html' : pathname.endsWith('/') ? pathname + 'index.html' : pathname

      const absPath = path.normalize(path.join(OUT_DIR, target))
      // Path-traversal guard
      if (absPath !== OUT_DIR && !absPath.startsWith(OUT_DIR + path.sep)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      const ext = path.extname(absPath).toLowerCase()
      fs.stat(absPath, (err, stat) => {
        if (!err && stat.isFile()) return sendFile(res, absPath, ext)
        // SPA fallback — unknown routes get index.html
        if (req.method === 'GET' && !ext) {
          return sendFile(res, path.join(OUT_DIR, 'index.html'), '.html')
        }
        res.writeHead(404)
        res.end('Not found')
      })
    } catch {
      res.writeHead(500)
      res.end('Internal error')
    }
  })
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
let server = null
let mainWindow = null

function createWindow() {
  const port = server.address().port
  const appOrigin = `http://127.0.0.1:${port}`

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1120',
    icon: path.join(__dirname, '..', 'electron-assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Keep the app pinned to the local bundle — open everything else in the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== appOrigin) {
        event.preventDefault()
        if (/^https?:/i.test(url)) shell.openExternal(url)
      }
    } catch {
      event.preventDefault()
    }
  })

  if (SMOKE) {
    const consoleErrors = []
    mainWindow.webContents.on('console-message', (event, levelOrDetails, maybeMessage) => {
      // Electron >=32 passes an event object; older versions pass (level, message).
      const level = typeof levelOrDetails === 'object' ? levelOrDetails.level : levelOrDetails
      const message = typeof levelOrDetails === 'object' ? levelOrDetails.message : maybeMessage
      if (level >= 3) consoleErrors.push(String(message))
    })
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[smoke] renderer gone:', JSON.stringify(details))
      app.exit(1)
    })
    mainWindow.webContents.once('did-finish-load', () => runSmoke(consoleErrors))
  }

  mainWindow.loadURL(`${appOrigin}/`)
}

function runSmoke(consoleErrors) {
  const wc = mainWindow.webContents
  // Give React time to hydrate and the first paint to settle.
  setTimeout(async () => {
    try {
      const report = await wc.executeJavaScript(`(() => {
        const body = document.body ? document.body.innerText : ''
        return {
          title: document.title,
          flowCanvasMounted: !!document.querySelector('.react-flow'),
          toolbarButtons: document.querySelectorAll('button').length,
          bodyLength: body.length,
        }
      })()`)
      const img = await wc.capturePage()
      const shotPath = path.join(process.cwd(), 'smoke-screenshot.png')
      fs.writeFileSync(shotPath, img.toPNG())
      console.log('[smoke] screenshot:', shotPath)
      console.log('[smoke] page:', JSON.stringify(report))
      const fatal = consoleErrors.filter((m) => !/favicon/i.test(m))
      if (fatal.length) console.log('[smoke] console errors:', JSON.stringify(fatal, null, 2))
      const ok = report.flowCanvasMounted && report.bodyLength > 0 && fatal.length === 0
      console.log(ok ? '[smoke] PASS' : '[smoke] FAIL')
      app.exit(ok ? 0 : 1)
    } catch (err) {
      console.error('[smoke] error:', err)
      app.exit(1)
    }
  }, 4000)
}

app.whenReady().then(() => {
  server = createServer()
  server.listen(0, '127.0.0.1', createWindow)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('will-quit', () => {
  if (server) server.close()
})
