import { app, BrowserWindow, ipcMain, desktopCapturer, screen, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

type Roi = { x: number; y: number; width: number; height: number }

const DEFAULT_CONTINUOUS_ROI_WIDTH = 360
const DEFAULT_CONTINUOUS_ROI_HEIGHT = 240
const DEFAULT_MAIN_WINDOW_HEIGHT = 230
const MIN_CONTINUOUS_ROI_WIDTH = 260
const MIN_CONTINUOUS_ROI_HEIGHT = 120

let win: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let overlayHeight = DEFAULT_CONTINUOUS_ROI_HEIGHT
let isSyncingAttachedWindows = false


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
  // Menu.setApplicationMenu(null)
  win = new BrowserWindow({
    width: DEFAULT_CONTINUOUS_ROI_WIDTH,
    height: DEFAULT_MAIN_WINDOW_HEIGHT,
    minWidth: MIN_CONTINUOUS_ROI_WIDTH,
    minHeight: DEFAULT_MAIN_WINDOW_HEIGHT,
    useContentSize: true,
    icon: path.join(app.getAppPath(), 'dist', 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
    },
  })

  win.on('closed', () => {
    closeOverlayWindow()
    win = null
  })

  win.on('move', () => syncOverlayToMainWindow())
  win.on('resize', () => syncOverlayToMainWindow())

  win.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return

    Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' },
    ]).popup({ window: win ?? undefined })
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(getRendererIndexPath())
  }
}



function getMainContentBounds() {
  return win?.getContentBounds() ?? screen.getPrimaryDisplay().workArea
}

function getAttachedOverlayBounds(mainBounds = getMainContentBounds()): Electron.Rectangle {
  return {
    x: mainBounds.x,
    y: mainBounds.y - overlayHeight,
    width: mainBounds.width,
    height: overlayHeight,
  }
}

function syncOverlayToMainWindow() {
  if (!overlayWindow || !win || isSyncingAttachedWindows) return
  isSyncingAttachedWindows = true
  overlayWindow.setBounds(getAttachedOverlayBounds())
  isSyncingAttachedWindows = false
  sendContinuousOverlayRoi()
}

function syncMainWindowToOverlay() {
  if (!overlayWindow || !win || isSyncingAttachedWindows) return
  const overlayBounds = overlayWindow.getBounds()
  overlayHeight = Math.max(MIN_CONTINUOUS_ROI_HEIGHT, overlayBounds.height)
  isSyncingAttachedWindows = true
  win.setContentBounds({
    x: overlayBounds.x,
    y: overlayBounds.y + overlayHeight,
    width: Math.max(MIN_CONTINUOUS_ROI_WIDTH, overlayBounds.width),
    height: getMainContentBounds().height,
  })
  overlayWindow.setBounds({
    x: overlayBounds.x,
    y: overlayBounds.y,
    width: Math.max(MIN_CONTINUOUS_ROI_WIDTH, overlayBounds.width),
    height: overlayHeight,
  })
  isSyncingAttachedWindows = false
  sendContinuousOverlayRoi()
}

function continuousOverlayRoi(): Roi | null {
  if (!overlayWindow) return null
  const bounds = overlayWindow.getBounds()
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  }
}

function sendContinuousOverlayRoi() {
  const roi = continuousOverlayRoi()
  if (roi) win?.webContents.send('scanner:continuous-roi-changed', roi)
}

function createContinuousOverlayWindow(initialRoi: Roi) {
  overlayHeight = Math.max(MIN_CONTINUOUS_ROI_HEIGHT, initialRoi.height)
  const initialBounds = getAttachedOverlayBounds()

  overlayWindow = new BrowserWindow({
    autoHideMenuBar: true,
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    minWidth: MIN_CONTINUOUS_ROI_WIDTH,
    minHeight: MIN_CONTINUOUS_ROI_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    resizable: true,
    movable: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  })

  const html = `<!doctype html><html><head><style>
    html,body{margin:0;width:100%;height:100%;background:transparent;font-family:Segoe UI,sans-serif;user-select:none;overflow:hidden;}
    #scanner{position:relative;width:100%;height:100%;filter:drop-shadow(0 10px 24px rgba(0,0,0,.35));}
    #scanBox{position:absolute;inset:0;border:2px solid #58a6ff;border-radius:10px;background:rgba(88,166,255,.28);cursor:move;-webkit-app-region:drag}
    #scanBox::after{content:'';position:absolute;inset:10px;border:1px dashed rgba(255,255,255,.75);border-radius:8px;pointer-events:none}
    .handle{position:absolute;z-index:5;background:transparent;-webkit-app-region:no-drag}
    .n{left:12px;right:12px;top:0;height:10px;cursor:ns-resize}.s{left:12px;right:12px;bottom:0;height:10px;cursor:ns-resize}
    .w{left:0;top:12px;bottom:12px;width:10px;cursor:ew-resize}.e{right:0;top:12px;bottom:12px;width:10px;cursor:ew-resize}
    .nw{left:0;top:0;width:16px;height:16px;cursor:nwse-resize}.ne{right:0;top:0;width:16px;height:16px;cursor:nesw-resize}.sw{left:0;bottom:0;width:16px;height:16px;cursor:nesw-resize}.se{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize}
  </style></head><body>
    <div id="scanner">
      <div id="scanBox"></div>
      <div class="handle n" data-handle="n"></div><div class="handle e" data-handle="e"></div><div class="handle s" data-handle="s"></div><div class="handle w" data-handle="w"></div>
      <div class="handle nw" data-handle="nw"></div><div class="handle ne" data-handle="ne"></div><div class="handle sw" data-handle="sw"></div><div class="handle se" data-handle="se"></div>
    </div>
    <script>
      const { ipcRenderer } = require('electron');
      let resize = null;
      const minWidth = ${MIN_CONTINUOUS_ROI_WIDTH};
      const minHeight = ${MIN_CONTINUOUS_ROI_HEIGHT};

      function beginResize(e, edge) {
        e.preventDefault();
        e.stopPropagation();
        resize = {
          edge,
          startX: e.screenX,
          startY: e.screenY,
          bounds: {
            x: window.screenX,
            y: window.screenY,
            width: window.outerWidth,
            height: window.outerHeight,
          },
        };
      }

      function updateResize(e) {
        if (!resize) return;
        const dx = e.screenX - resize.startX;
        const dy = e.screenY - resize.startY;
        const next = { ...resize.bounds };
        if (resize.edge.includes('e')) next.width = resize.bounds.width + dx;
        if (resize.edge.includes('s')) next.height = resize.bounds.height + dy;
        if (resize.edge.includes('w')) {
          next.x = resize.bounds.x + dx;
          next.width = resize.bounds.width - dx;
        }
        if (resize.edge.includes('n')) {
          next.y = resize.bounds.y + dy;
          next.height = resize.bounds.height - dy;
        }
        if (next.width < minWidth) {
          if (resize.edge.includes('w')) next.x -= minWidth - next.width;
          next.width = minWidth;
        }
        if (next.height < minHeight) {
          if (resize.edge.includes('n')) next.y -= minHeight - next.height;
          next.height = minHeight;
        }
        ipcRenderer.send('continuous-overlay:set-bounds', next);
      }

      document.querySelectorAll('.handle').forEach(handle => {
        handle.addEventListener('mousedown', e => beginResize(e, handle.dataset.handle));
      });
      window.addEventListener('mousemove', updateResize);
      window.addEventListener('mouseup', () => { resize = null; });
      ipcRenderer.send('continuous-overlay:roi-changed');
    </script>
  </body></html>`

  overlayWindow.setContentProtection(true)
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.on('move', syncMainWindowToOverlay)
  overlayWindow.on('resize', syncMainWindowToOverlay)
  overlayWindow.on('closed', () => {
    overlayWindow = null
    overlayHeight = DEFAULT_CONTINUOUS_ROI_HEIGHT
  })
  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

function getDefaultContinuousRoi(bounds: Electron.Rectangle): Roi {
  return {
    x: bounds.x,
    y: bounds.y - DEFAULT_CONTINUOUS_ROI_HEIGHT,
    width: Math.max(MIN_CONTINUOUS_ROI_WIDTH, bounds.width),
    height: DEFAULT_CONTINUOUS_ROI_HEIGHT,
  }
}

function closeOverlayWindow() {
  if (!overlayWindow) return
  overlayWindow.close()
  overlayWindow = null
  overlayHeight = DEFAULT_CONTINUOUS_ROI_HEIGHT
}

ipcMain.handle('scanner:start-continuous-overlay', async (): Promise<Roi> => {
  if (!overlayWindow) {
    const parentBounds = getMainContentBounds()
    const initialRoi = getDefaultContinuousRoi(parentBounds)
    createContinuousOverlayWindow(initialRoi)
  }
  const roi = continuousOverlayRoi()
  if (!roi) throw new Error('Unable to create scan area')
  return roi
})

ipcMain.handle('scanner:stop-continuous-overlay', async () => {
  closeOverlayWindow()
})


ipcMain.on('continuous-overlay:roi-changed', () => {
  sendContinuousOverlayRoi()
})

ipcMain.on('continuous-overlay:set-bounds', (_event, requestedBounds: Electron.Rectangle) => {
  if (!overlayWindow) return
  overlayWindow.setBounds({
    x: Math.round(requestedBounds.x),
    y: Math.round(requestedBounds.y),
    width: Math.max(MIN_CONTINUOUS_ROI_WIDTH, Math.round(requestedBounds.width)),
    height: Math.max(MIN_CONTINUOUS_ROI_HEIGHT, Math.round(requestedBounds.height)),
  })
  syncMainWindowToOverlay()
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