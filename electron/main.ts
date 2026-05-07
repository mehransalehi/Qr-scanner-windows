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
const DEFAULT_CONTINUOUS_ROI_SIZE = 240
const CONTINUOUS_BAR_HEIGHT = 36
const MIN_CONTINUOUS_ROI_SIZE = 96

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


function getVirtualBounds() {
  const displays = screen.getAllDisplays()
  return displays.reduce(
    (acc, d) => ({
      x: Math.min(acc.x, d.bounds.x),
      y: Math.min(acc.y, d.bounds.y),
      width: Math.max(acc.x + acc.width, d.bounds.x + d.bounds.width) - Math.min(acc.x, d.bounds.x),
      height: Math.max(acc.y + acc.height, d.bounds.y + d.bounds.height) - Math.min(acc.y, d.bounds.y),
    }),
    displays[0].bounds,
  )
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

  overlayWindow.setContentProtection(true)
  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

ipcMain.handle('scanner:select-roi', async (): Promise<Roi | null> => {
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }

  const virtualBounds = getVirtualBounds()

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


function createContinuousOverlayWindow(bounds: Electron.Rectangle, initialRoi: Roi) {
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

  const localInitial = {
    x: initialRoi.x - bounds.x,
    y: initialRoi.y - bounds.y,
    width: initialRoi.width,
    height: initialRoi.height,
  }

  const html = `<!doctype html><html><head><style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:Segoe UI,sans-serif;user-select:none}
    body{pointer-events:none}
    #scanner{position:absolute;pointer-events:auto;filter:drop-shadow(0 10px 24px rgba(0,0,0,.35))}
    #scanBox{position:absolute;left:0;top:0;border:2px solid #58a6ff;background:rgba(88,166,255,.5);cursor:move}
    #scanBox::after{content:'';position:absolute;inset:10px;border:1px dashed rgba(255,255,255,.75);border-radius:8px;pointer-events:none}
    #bar{position:absolute;left:0;height:${CONTINUOUS_BAR_HEIGHT}px;display:flex;align-items:center;gap:8px;padding:5px 7px;border:1px solid rgba(88,166,255,.75);border-top:0;border-radius:0 0 10px 10px;background:rgba(10,20,36,.92);color:white;font-size:12px;cursor:move}
    #status{font-weight:600;margin-right:auto;letter-spacing:.2px}
    button{border:1px solid rgba(255,255,255,.22);border-radius:6px;background:rgba(255,255,255,.12);color:white;padding:4px 8px;font:inherit;cursor:pointer}
    button:hover{background:rgba(255,255,255,.22)}
    #move{cursor:grab} #move:active{cursor:grabbing}
    .handle{position:absolute;width:14px;height:14px;background:#58a6ff;border:2px solid white;border-radius:50%;pointer-events:auto}
    .nw{left:-7px;top:-7px;cursor:nwse-resize}.ne{right:-7px;top:-7px;cursor:nesw-resize}.sw{left:-7px;bottom:${CONTINUOUS_BAR_HEIGHT - 7}px;cursor:nesw-resize}.se{right:-7px;bottom:${CONTINUOUS_BAR_HEIGHT - 7}px;cursor:nwse-resize}
  </style></head><body>
    <div id="scanner">
      <div id="scanBox"></div>
      <div id="bar"><span id="status">Scanning</span><button id="copy" type="button">Copy</button><button id="move" type="button" title="Drag to move">Move</button><button id="close" type="button">Close</button></div>
      <div class="handle nw" data-handle="nw"></div><div class="handle ne" data-handle="ne"></div><div class="handle sw" data-handle="sw"></div><div class="handle se" data-handle="se"></div>
    </div>
    <script>
      const { ipcRenderer, clipboard } = require('electron');
      const scanner = document.getElementById('scanner');
      const scanBox = document.getElementById('scanBox');
      const bar = document.getElementById('bar');
      const copy = document.getElementById('copy');
      const closeButton = document.getElementById('close');
      let rect = ${JSON.stringify(localInitial)};
      let latestQr = '';
      let drag = null;
      let ignoringMouse = true;
      const minSize = ${MIN_CONTINUOUS_ROI_SIZE};
      const barHeight = ${CONTINUOUS_BAR_HEIGHT};
      const bounds = { width: window.innerWidth, height: window.innerHeight };

      function setMouseIgnored(ignore) {
        if (ignore === ignoringMouse) return;
        ignoringMouse = ignore;
        ipcRenderer.send('continuous-overlay:set-ignore-mouse-events', ignore);
      }

      function apply(send = true) {
        rect.width = Math.max(minSize, rect.width);
        rect.height = Math.max(minSize, rect.height);
        rect.x = Math.min(Math.max(0, rect.x), bounds.width - rect.width);
        rect.y = Math.min(Math.max(0, rect.y), bounds.height - rect.height - barHeight);
        scanner.style.left = rect.x + 'px';
        scanner.style.top = rect.y + 'px';
        scanner.style.width = rect.width + 'px';
        scanner.style.height = rect.height + barHeight + 'px';
        scanBox.style.width = rect.width + 'px';
        scanBox.style.height = rect.height + 'px';
        bar.style.top = rect.height + 'px';
        bar.style.width = rect.width + 'px';
        if (send) ipcRenderer.send('continuous-overlay:roi-changed', rect);
      }

      function beginDrag(e, mode) {
        e.preventDefault();
        e.stopPropagation();
        setMouseIgnored(false);
        drag = { mode, startX: e.clientX, startY: e.clientY, start: { ...rect } };
      }

      function updateDrag(e) {
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const start = drag.start;
        if (drag.mode === 'move') {
          rect.x = start.x + dx;
          rect.y = start.y + dy;
        } else {
          if (drag.mode.includes('e')) rect.width = start.width + dx;
          if (drag.mode.includes('s')) rect.height = start.height + dy;
          if (drag.mode.includes('w')) {
            const nextWidth = start.width - dx;
            if (nextWidth >= minSize) { rect.x = start.x + dx; rect.width = nextWidth; }
          }
          if (drag.mode.includes('n')) {
            const nextHeight = start.height - dy;
            if (nextHeight >= minSize) { rect.y = start.y + dy; rect.height = nextHeight; }
          }
        }
        apply();
      }

      scanner.addEventListener('mouseenter', () => setMouseIgnored(false));
      scanner.addEventListener('mouseleave', () => { if (!drag) setMouseIgnored(true); });
      scanBox.addEventListener('mousedown', e => beginDrag(e, 'move'));
      bar.addEventListener('mousedown', e => beginDrag(e, 'move'));
      document.getElementById('move').addEventListener('mousedown', e => beginDrag(e, 'move'));
      document.querySelectorAll('.handle').forEach(handle => {
        handle.addEventListener('mousedown', e => beginDrag(e, handle.dataset.handle));
      });
      window.addEventListener('mousemove', e => {
        if (!drag) setMouseIgnored(!e.target.closest?.('#scanner'));
        updateDrag(e);
      });
      window.addEventListener('mouseup', e => {
        drag = null;
        setMouseIgnored(!e.target.closest?.('#scanner'));
      });
      window.addEventListener('keydown', e => { if (e.key === 'Escape') ipcRenderer.send('continuous-overlay:closed'); });
      document.querySelectorAll('button').forEach(button => {
        button.addEventListener('mousedown', e => e.stopPropagation());
      });
      closeButton.addEventListener('click', () => ipcRenderer.send('continuous-overlay:closed'));
      copy.addEventListener('click', e => {
        e.stopPropagation();
        if (latestQr) clipboard.writeText(latestQr);
      });
      ipcRenderer.on('continuous-overlay:last-qr', (_event, qr) => { latestQr = qr || ''; });
      apply(false);
      ipcRenderer.send('continuous-overlay:roi-changed', rect);
    </script>
  </body></html>`

  overlayWindow.setContentProtection(true)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

function getDefaultContinuousRoi(bounds: Electron.Rectangle): Roi {
  const size = Math.min(DEFAULT_CONTINUOUS_ROI_SIZE, bounds.width, bounds.height - CONTINUOUS_BAR_HEIGHT)
  return {
    x: bounds.x + Math.floor((bounds.width - size) / 2),
    y: bounds.y + Math.floor((bounds.height - size - CONTINUOUS_BAR_HEIGHT) / 2),
    width: size,
    height: size,
  }
}

function closeOverlayWindow() {
  if (!overlayWindow) return
  overlayWindow.close()
  overlayWindow = null
}

ipcMain.handle('scanner:start-continuous-overlay', async (): Promise<Roi> => {
  closeOverlayWindow()
  const virtualBounds = getVirtualBounds()
  const initialRoi = getDefaultContinuousRoi(virtualBounds)
  createContinuousOverlayWindow(virtualBounds, initialRoi)
  return initialRoi
})

ipcMain.handle('scanner:stop-continuous-overlay', async () => {
  closeOverlayWindow()
})

ipcMain.handle('scanner:update-last-qr', async (_event, qr: string) => {
  overlayWindow?.webContents.send('continuous-overlay:last-qr', qr)
})

ipcMain.on('continuous-overlay:roi-changed', (_event, rect: Roi) => {
  if (!overlayWindow || !win) return
  const bounds = overlayWindow.getBounds()
  const roi = {
    x: bounds.x + Math.round(rect.x),
    y: bounds.y + Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
  win.webContents.send('scanner:continuous-roi-changed', roi)
})

ipcMain.on('continuous-overlay:set-ignore-mouse-events', (_event, ignore: boolean) => {
  overlayWindow?.setIgnoreMouseEvents(ignore, { forward: true })
})

ipcMain.on('continuous-overlay:closed', () => {
  win?.webContents.send('scanner:continuous-overlay-closed')
  closeOverlayWindow()
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