import { app, BrowserWindow, ipcMain, desktopCapturer, screen, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

type Roi = { x: number; y: number; width: number; height: number }
type ScanAreaRect = Roi

const DEFAULT_CONTINUOUS_ROI_WIDTH = 360
const DEFAULT_CONTINUOUS_ROI_HEIGHT = 320
const DEFAULT_MAIN_WINDOW_HEIGHT = 230
const DEFAULT_WINDOW_HEIGHT = DEFAULT_CONTINUOUS_ROI_HEIGHT + DEFAULT_MAIN_WINDOW_HEIGHT
const MIN_CONTINUOUS_ROI_WIDTH = 260
const MIN_CONTINUOUS_ROI_HEIGHT = 120
const MIN_WINDOW_HEIGHT = MIN_CONTINUOUS_ROI_HEIGHT + DEFAULT_MAIN_WINDOW_HEIGHT

let win: BrowserWindow | null = null
let hasShownWindow = false
let currentScanAreaRect: ScanAreaRect = {
  x: 0,
  y: 0,
  width: DEFAULT_CONTINUOUS_ROI_WIDTH,
  height: DEFAULT_CONTINUOUS_ROI_HEIGHT,
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

function getAppIconPath() {
  if (app.isPackaged) return path.join(app.getAppPath(), 'dist', 'icon.ico')
  return path.join(process.env.APP_ROOT ?? process.cwd(), 'public', 'icon.ico')
}

function createWindow() {
  Menu.setApplicationMenu(null)
  win = new BrowserWindow({
    width: DEFAULT_CONTINUOUS_ROI_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_CONTINUOUS_ROI_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    useContentSize: true,
    title: 'QR Scanner',
    icon: getAppIconPath(),
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
    },
  })

  win.on('closed', () => {
    hasShownWindow = false
    win = null
  })

  win.setContentProtection(true)

  win.once('ready-to-show', () => {
    updateWindowShape()
  })

  win.on('move', () => sendContinuousOverlayRoi())
  win.on('resize', () => {
    updateWindowShape()
    sendContinuousOverlayRoi()
  })

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

function embeddedScanAreaRoi(): Roi | null {
  if (!win) return null
  const contentBounds = win.getContentBounds()
  return {
    x: Math.round(contentBounds.x + currentScanAreaRect.x),
    y: Math.round(contentBounds.y + currentScanAreaRect.y),
    width: Math.max(MIN_CONTINUOUS_ROI_WIDTH, Math.round(currentScanAreaRect.width)),
    height: Math.max(MIN_CONTINUOUS_ROI_HEIGHT, Math.round(currentScanAreaRect.height)),
  }
}

function sendContinuousOverlayRoi() {
  const roi = embeddedScanAreaRoi()
  if (roi) win?.webContents.send('scanner:continuous-roi-changed', roi)
}

function updateWindowShape() {
  if (!win || process.platform === 'darwin') return

  const contentBounds = win.getContentBounds()
  const shapeRects: Electron.Rectangle[] = []
  const addShapeRect = (x: number, y: number, width: number, height: number) => {
    const rect = {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height)),
    }
    if (rect.width > 0 && rect.height > 0) shapeRects.push(rect)
  }

  const scanX = Math.max(0, Math.round(currentScanAreaRect.x))
  const scanY = Math.max(0, Math.round(currentScanAreaRect.y))
  const scanWidth = Math.min(contentBounds.width - scanX, Math.round(currentScanAreaRect.width))
  const scanHeight = Math.min(contentBounds.height - scanY, Math.round(currentScanAreaRect.height))

  // Keep the whole scan area in the native window shape so clicks and drags
  // anywhere inside the transparent top area are handled by this app instead
  // of falling through to windows underneath it.
  addShapeRect(scanX, scanY, scanWidth, scanHeight)

  const controlPanelY = Math.min(contentBounds.height, Math.max(0, scanY + scanHeight))
  addShapeRect(0, controlPanelY, contentBounds.width, contentBounds.height - controlPanelY)
  win.setShape(shapeRects)
}

function updateScanAreaRect(rect: ScanAreaRect): Roi {
  currentScanAreaRect = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.max(MIN_CONTINUOUS_ROI_WIDTH, rect.width),
    height: Math.max(MIN_CONTINUOUS_ROI_HEIGHT, rect.height),
  }
  updateWindowShape()
  const roi = embeddedScanAreaRoi()
  if (!roi) throw new Error('Unable to locate scan area')
  if (!hasShownWindow) {
    win?.show()
    hasShownWindow = true
  }
  sendContinuousOverlayRoi()
  return roi
}

ipcMain.handle('scanner:start-continuous-overlay', async (_event, rect?: ScanAreaRect): Promise<Roi> => {
  if (rect) return updateScanAreaRect(rect)
  const roi = embeddedScanAreaRoi()
  if (!roi) throw new Error('Unable to create scan area')
  return roi
})

ipcMain.handle('scanner:stop-continuous-overlay', async () => {
  // The scan area is now part of the main window, so there is no separate window to close.
})

ipcMain.handle('scanner:update-scan-area', async (_event, rect: ScanAreaRect): Promise<Roi> => {
  return updateScanAreaRect(rect)
})

ipcMain.handle('window:minimize', () => {
  win?.minimize()
})

ipcMain.handle('window:close', () => {
  win?.close()
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
