import { ipcMain, screen, desktopCapturer, dialog, app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
let win = null;
let overlayWindow = null;
const OVERLAY_DISMISS_DELAY_MS = 80;
const DEFAULT_CONTINUOUS_ROI_SIZE = 240;
const CONTINUOUS_BAR_HEIGHT = 36;
const MIN_CONTINUOUS_ROI_SIZE = 96;
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getRendererIndexPath() {
  if (!app.isPackaged) {
    return path.join(process.env.APP_ROOT ?? "", "dist", "index.html");
  }
  return path.join(app.getAppPath(), "dist", "index.html");
}
function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 780,
    icon: path.join(app.getAppPath(), "dist", "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(getRendererIndexPath());
  }
}
function getVirtualBounds() {
  const displays = screen.getAllDisplays();
  return displays.reduce(
    (acc, d) => ({
      x: Math.min(acc.x, d.bounds.x),
      y: Math.min(acc.y, d.bounds.y),
      width: Math.max(acc.x + acc.width, d.bounds.x + d.bounds.width) - Math.min(acc.x, d.bounds.x),
      height: Math.max(acc.y + acc.height, d.bounds.y + d.bounds.height) - Math.min(acc.y, d.bounds.y)
    }),
    displays[0].bounds
  );
}
function createOverlayWindow(bounds) {
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
      nodeIntegration: true
    }
  });
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
  <\/script></body></html>`;
  overlayWindow.setContentProtection(true);
  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}
ipcMain.handle("scanner:select-roi", async () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
  const virtualBounds = getVirtualBounds();
  return new Promise((resolve) => {
    let settled = false;
    let closing = false;
    const resolveOnce = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    createOverlayWindow(virtualBounds);
    const cleanup = () => {
      ipcMain.removeAllListeners("overlay:selected");
      ipcMain.removeAllListeners("overlay:cancelled");
    };
    ipcMain.once("overlay:selected", (_event, rect) => {
      cleanup();
      if (!overlayWindow) return resolveOnce(null);
      closing = true;
      const b = overlayWindow.getBounds();
      const selectedRoi = rect.width < 8 || rect.height < 8 ? null : {
        x: b.x + rect.x,
        y: b.y + rect.y,
        width: rect.width,
        height: rect.height
      };
      overlayWindow.once("closed", async () => {
        await wait(OVERLAY_DISMISS_DELAY_MS);
        resolveOnce(selectedRoi);
      });
      overlayWindow.close();
      overlayWindow = null;
    });
    ipcMain.once("overlay:cancelled", () => {
      cleanup();
      if (!overlayWindow) return resolveOnce(null);
      closing = true;
      overlayWindow.once("closed", async () => {
        await wait(OVERLAY_DISMISS_DELAY_MS);
        resolveOnce(null);
      });
      overlayWindow.close();
      overlayWindow = null;
    });
    overlayWindow == null ? void 0 : overlayWindow.once("closed", () => {
      cleanup();
      overlayWindow = null;
      if (!closing) resolveOnce(null);
    });
  });
});
function continuousOverlayRoi() {
  if (!overlayWindow) return null;
  const bounds = overlayWindow.getBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: Math.max(1, bounds.height - CONTINUOUS_BAR_HEIGHT)
  };
}
function sendContinuousOverlayRoi() {
  const roi = continuousOverlayRoi();
  if (roi) win == null ? void 0 : win.webContents.send("scanner:continuous-roi-changed", roi);
}
function createContinuousOverlayWindow(initialRoi) {
  overlayWindow = new BrowserWindow({
    x: initialRoi.x,
    y: initialRoi.y,
    width: initialRoi.width,
    height: initialRoi.height + CONTINUOUS_BAR_HEIGHT,
    minWidth: MIN_CONTINUOUS_ROI_SIZE,
    minHeight: MIN_CONTINUOUS_ROI_SIZE + CONTINUOUS_BAR_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    resizable: true,
    movable: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  });
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;width:100%;height:100%;background:transparent;font-family:Segoe UI,sans-serif;user-select:none;}
    #scanner{filter:drop-shadow(0 10px 24px rgba(0,0,0,.35));height:100%;display:flex;flex-direction:column;justify-content: stretch}
    #scanBox{position:relative;flex-grow: 1;border:2px solid #58a6ff;background:rgba(88,166,255,.5);cursor:move;-webkit-app-region:drag}
    #scanBox::after{content:'';position:absolute;inset:10px;border:1px dashed rgba(255,255,255,.75);border-radius:8px;pointer-events:none}
    #bar{height:${CONTINUOUS_BAR_HEIGHT}px;display:flex;align-items:center;gap:8px;padding:5px 7px;border:1px solid rgba(88,166,255,.75);border-top:0;border-radius:0 0 10px 10px;background:rgba(10,20,36,.92);color:white;font-size:12px;-webkit-app-region:no-drag}
    #status{font-weight:600;margin-right:auto;letter-spacing:.2px;white-space:nowrap}
    button{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:24px;border:1px solid rgba(255,255,255,.22);border-radius:6px;background:rgba(255,255,255,.12);color:white;padding:0 7px;font:inherit;line-height:1;cursor:pointer;-webkit-app-region:no-drag}
    button:hover{background:rgba(255,255,255,.22)}
    .handle{position:absolute;z-index:5;background:transparent;-webkit-app-region:no-drag}
    .n{left:12px;right:12px;top:0;height:10px;cursor:ns-resize}.s{left:12px;right:12px;bottom:${CONTINUOUS_BAR_HEIGHT - 5}px;height:10px;cursor:ns-resize}
    .w{left:0;top:12px;bottom:${CONTINUOUS_BAR_HEIGHT + 12}px;width:10px;cursor:ew-resize}.e{right:0;top:12px;bottom:${CONTINUOUS_BAR_HEIGHT + 12}px;width:10px;cursor:ew-resize}
    .nw{left:0;top:0;width:16px;height:16px;cursor:nwse-resize}.ne{right:0;top:0;width:16px;height:16px;cursor:nesw-resize}.sw{left:0;bottom:${CONTINUOUS_BAR_HEIGHT - 5}px;width:16px;height:16px;cursor:nesw-resize}.se{right:0;bottom:${CONTINUOUS_BAR_HEIGHT - 5}px;width:16px;height:16px;cursor:nwse-resize}
  </style></head><body>
    <div id="scanner">
      <div id="scanBox"></div>
      <div id="bar"><span id="status">Scanning</span><button id="copy" type="button" title="Copy last QR" aria-label="Copy last QR">⧉</button><button id="close" type="button" title="Close" aria-label="Close">X</button></div>
      <div class="handle n" data-handle="n"></div><div class="handle e" data-handle="e"></div><div class="handle s" data-handle="s"></div><div class="handle w" data-handle="w"></div>
      <div class="handle nw" data-handle="nw"></div><div class="handle ne" data-handle="ne"></div><div class="handle sw" data-handle="sw"></div><div class="handle se" data-handle="se"></div>
    </div>
    <script>
      const { ipcRenderer, clipboard } = require('electron');
      const copy = document.getElementById('copy');
      const closeButton = document.getElementById('close');
      let latestQr = '';
      let resize = null;
      const minWidth = ${MIN_CONTINUOUS_ROI_SIZE};
      const minHeight = ${MIN_CONTINUOUS_ROI_SIZE + CONTINUOUS_BAR_HEIGHT};

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
      window.addEventListener('keydown', e => { if (e.key === 'Escape') ipcRenderer.send('continuous-overlay:closed'); });
      closeButton.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        ipcRenderer.send('continuous-overlay:closed');
      });
      copy.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (latestQr) clipboard.writeText(latestQr);
      });
      ipcRenderer.on('continuous-overlay:last-qr', (_event, qr) => { latestQr = qr || ''; });
      ipcRenderer.send('continuous-overlay:roi-changed');
    <\/script>
  </body></html>`;
  overlayWindow.setContentProtection(true);
  overlayWindow.on("move", sendContinuousOverlayRoi);
  overlayWindow.on("resize", sendContinuousOverlayRoi);
  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}
function getDefaultContinuousRoi(bounds) {
  const size = Math.min(DEFAULT_CONTINUOUS_ROI_SIZE, bounds.width, bounds.height - CONTINUOUS_BAR_HEIGHT);
  return {
    x: bounds.x + Math.floor((bounds.width - size) / 2),
    y: bounds.y + Math.floor((bounds.height - size - CONTINUOUS_BAR_HEIGHT) / 2),
    width: size,
    height: size
  };
}
function closeOverlayWindow() {
  if (!overlayWindow) return;
  overlayWindow.close();
  overlayWindow = null;
}
ipcMain.handle("scanner:start-continuous-overlay", async () => {
  closeOverlayWindow();
  const virtualBounds = getVirtualBounds();
  const initialRoi = getDefaultContinuousRoi(virtualBounds);
  createContinuousOverlayWindow(initialRoi);
  return initialRoi;
});
ipcMain.handle("scanner:stop-continuous-overlay", async () => {
  closeOverlayWindow();
});
ipcMain.handle("scanner:update-last-qr", async (_event, qr) => {
  overlayWindow == null ? void 0 : overlayWindow.webContents.send("continuous-overlay:last-qr", qr);
});
ipcMain.on("continuous-overlay:roi-changed", () => {
  sendContinuousOverlayRoi();
});
ipcMain.on("continuous-overlay:set-bounds", (_event, requestedBounds) => {
  if (!overlayWindow) return;
  const virtualBounds = getVirtualBounds();
  const width = Math.min(
    virtualBounds.width,
    Math.max(MIN_CONTINUOUS_ROI_SIZE, Math.round(requestedBounds.width))
  );
  const height = Math.min(
    virtualBounds.height,
    Math.max(MIN_CONTINUOUS_ROI_SIZE + CONTINUOUS_BAR_HEIGHT, Math.round(requestedBounds.height))
  );
  const x = Math.min(
    Math.max(virtualBounds.x, Math.round(requestedBounds.x)),
    virtualBounds.x + virtualBounds.width - width
  );
  const y = Math.min(
    Math.max(virtualBounds.y, Math.round(requestedBounds.y)),
    virtualBounds.y + virtualBounds.height - height
  );
  overlayWindow.setBounds({ x, y, width, height });
  sendContinuousOverlayRoi();
});
ipcMain.on("continuous-overlay:closed", () => {
  win == null ? void 0 : win.webContents.send("scanner:continuous-overlay-closed");
  closeOverlayWindow();
});
ipcMain.handle("scanner:capture-fullscreen", async (_event, roi) => {
  const centerPoint = { x: roi.x + roi.width / 2, y: roi.y + roi.height / 2 };
  const targetDisplay = screen.getDisplayNearestPoint(centerPoint);
  const scaleFactor = targetDisplay.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(targetDisplay.bounds.width * scaleFactor),
      height: Math.floor(targetDisplay.bounds.height * scaleFactor)
    },
    fetchWindowIcons: false
  });
  const source = sources.find((s) => s.display_id === String(targetDisplay.id)) || sources[0];
  if (!source) throw new Error("No screen source available");
  return {
    imageDataUrl: source.thumbnail.toDataURL(),
    displayBounds: targetDisplay.bounds,
    scaleFactor
  };
});
ipcMain.handle("scanner:save-image", async (_event, base64Image) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (canceled || !filePath) return { canceled: true };
  const normalized = base64Image.replace(/^data:image\/png;base64,/, "");
  await fs.writeFile(filePath, Buffer.from(normalized, "base64"));
  return { canceled: false, filePath };
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.whenReady().then(createWindow);
export {
  VITE_DEV_SERVER_URL
};
