import { app, BrowserWindow, ipcMain, desktopCapturer, screen, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let win: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null

type Roi = { x: number; y: number; width: number; height: number }

const OVERLAY_DISMISS_DELAY_MS = 80

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * ✅ FIX: correct renderer path for production
 * NEVER assume APP_ROOT or dist-electron structure
 */
function getRendererIndexPath() {
  if (!app.isPackaged) {
    // dev fallback (optional safety)
    return path.join(process.env.APP_ROOT ?? '', 'dist', 'index.html')
  }

  // production: inside app.asar
  return path.join(app.getAppPath(), 'dist', 'index.html')
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 780,
    icon: path.join(app.getAppPath(), 'dist', 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(getRendererIndexPath())
  }
}

function createOverlayWindow(bounds: Electron.Rectangle) {
  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    resizable: false,
    movable: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  })

  const html = `<!doctype html><html><head><style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;cursor:crosshair;background:rgba(0,0,0,.45)}
    #box{position:absolute;border:2px solid #58a6ff;background:rgba(88,166,255,.15);display:none}
    #hint{position:fixed;top:16px;left:16px;color:white;font-family:Segoe UI,sans-serif;background:rgba(0,0,0,.5);padding:10px 12px;border-radius:8px}
  </style></head><body><div id='hint'>Drag to select scan region. Press ESC to cancel.</div><div id='box'></div>
  <script>
    const { ipcRenderer } = require('electron');
    let start=null; const box=document.getElementById('box');

    const norm=(a,b)=>({
      x:Math.min(a.x,b.x),
      y:Math.min(a.y,b.y),
      width:Math.abs(a.x-b.x),
      height:Math.abs(a.y-b.y)
    });

    window.addEventListener('mousedown',e=>{
      start={x:e.clientX,y:e.clientY};
      box.style.display='block';
    });

    window.addEventListener('mousemove',e=>{
      if(!start)return;
      const r=norm(start,{x:e.clientX,y:e.clientY});
      Object.assign(box.style,{
        left:r.x+'px',
        top:r.y+'px',
        width:r.width+'px',
        height:r.height+'px'
      });
    });

    window.addEventListener('mouseup',e=>{
      if(!start)return;
      const r=norm(start,{x:e.clientX,y:e.clientY});
      ipcRenderer.send('overlay:selected',r);
    });

    window.addEventListener('keydown',e=>{
      if(e.key==='Escape') ipcRenderer.send('overlay:cancelled');
    });
  </script></body></html>`

  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

ipcMain.handle('scanner:select-roi', async (): Promise<Roi | null> => {
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }

  const displays = screen.getAllDisplays()
  const virtualBounds = displays.reduce(
    (acc, d) => ({
      x: Math.min(acc.x, d.bounds.x),
      y: Math.min(acc.y, d.bounds.y),
      width: Math.max(acc.x + acc.width, d.bounds.x + d.bounds.width) - Math.min(acc.x, d.bounds.x),
      height: Math.max(acc.y + acc.height, d.bounds.y + d.bounds.height) - Math.min(acc.y, d.bounds.y),
    }),
    displays[0].bounds,
  )

  return new Promise((resolve) => {
    let settled = false
    let closing = false

    const resolveOnce = (value: Roi | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    createOverlayWindow(virtualBounds)

    const cleanup = () => {
      ipcMain.removeAllListeners('overlay:selected')
      ipcMain.removeAllListeners('overlay:cancelled')
    }

    ipcMain.once('overlay:selected', (_event, rect: Roi) => {
      cleanup()
      if (!overlayWindow) return resolveOnce(null)

      closing = true

      const b = overlayWindow.getBounds()
      const selectedRoi =
        rect.width < 8 || rect.height < 8
          ? null
          : {
              x: b.x + rect.x,
              y: b.y + rect.y,
              width: rect.width,
              height: rect.height,
            }

      overlayWindow.once('closed', async () => {
        await wait(OVERLAY_DISMISS_DELAY_MS)
        resolveOnce(selectedRoi)
      })

      overlayWindow.close()
      overlayWindow = null
    })

    ipcMain.once('overlay:cancelled', () => {
      cleanup()
      if (!overlayWindow) return resolveOnce(null)

      closing = true

      overlayWindow.once('closed', async () => {
        await wait(OVERLAY_DISMISS_DELAY_MS)
        resolveOnce(null)
      })

      overlayWindow.close()
      overlayWindow = null
    })

    overlayWindow?.once('closed', () => {
      cleanup()
      overlayWindow = null
      if (!closing) resolveOnce(null)
    })
  })
})

ipcMain.handle('scanner:capture-fullscreen', async (_event, roi: Roi) => {
  const centerPoint = { x: roi.x + roi.width / 2, y: roi.y + roi.height / 2 }
  const targetDisplay = screen.getDisplayNearestPoint(centerPoint)
  const scaleFactor = targetDisplay.scaleFactor || 1

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.floor(targetDisplay.bounds.width * scaleFactor),
      height: Math.floor(targetDisplay.bounds.height * scaleFactor),
    },
    fetchWindowIcons: false,
  })

  const source =
    sources.find((s) => s.display_id === String(targetDisplay.id)) || sources[0]

  if (!source) throw new Error('No screen source available')

  return {
    imageDataUrl: source.thumbnail.toDataURL(),
    displayBounds: targetDisplay.bounds,
    scaleFactor,
  }
})

ipcMain.handle('scanner:save-image', async (_event, base64Image: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Captured Image',
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  })

  if (canceled || !filePath) return { canceled: true }

  const normalized = base64Image.replace(/^data:image\/png;base64,/, '')
  await fs.writeFile(filePath, Buffer.from(normalized, 'base64'))

  return { canceled: false, filePath }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(createWindow)