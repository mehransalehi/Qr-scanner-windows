import { ipcMain as r, BrowserWindow as w, screen as m, desktopCapturer as O, dialog as _, app as u } from "electron";
import { fileURLToPath as S } from "node:url";
import x from "node:path";
import P from "node:fs/promises";
const L = x.dirname(S(import.meta.url)), z = process.env.VITE_DEV_SERVER_URL;
let d = null, o = null, h = [];
const R = 80, C = 240, s = 36, p = 96;
function E(t) {
  return new Promise((e) => setTimeout(e, t));
}
function D() {
  return u.isPackaged ? x.join(u.getAppPath(), "dist", "index.html") : x.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function M() {
  d = new w({
    width: 1100,
    height: 780,
    icon: x.join(u.getAppPath(), "dist", "electron-vite.svg"),
    webPreferences: {
      preload: x.join(L, "preload.mjs"),
      contextIsolation: !0
    }
  }), d.on("closed", () => {
    y(), d = null;
  }), z ? d.loadURL(z) : d.loadFile(D());
}
function I() {
  const t = m.getAllDisplays();
  return t.reduce(
    (e, n) => ({
      x: Math.min(e.x, n.bounds.x),
      y: Math.min(e.y, n.bounds.y),
      width: Math.max(e.x + e.width, n.bounds.x + n.bounds.width) - Math.min(e.x, n.bounds.x),
      height: Math.max(e.y + e.height, n.bounds.y + n.bounds.height) - Math.min(e.y, n.bounds.y)
    }),
    t[0].bounds
  );
}
function U(t) {
  const e = new w({
    x: t.x,
    y: t.y,
    width: t.width,
    height: t.height,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    fullscreenable: !1,
    resizable: !1,
    movable: !1,
    webPreferences: {
      contextIsolation: !1,
      nodeIntegration: !0
    }
  }), n = `<!doctype html><html><head><style>
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
  return e.setContentProtection(!0), e.setAlwaysOnTop(!0, "screen-saver"), e.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }), e.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(n)}`), e;
}
function W() {
  h = m.getAllDisplays().map((t) => U(t.bounds)), h.forEach((t) => {
    t.once("closed", () => {
      h = h.filter((e) => e !== t);
    });
  });
}
function b() {
  const t = h;
  h = [], t.forEach((e) => {
    e.isDestroyed() || e.close();
  });
}
r.handle("scanner:select-roi", async () => (y(), new Promise((t) => {
  let e = !1, n = !1;
  const i = (c) => {
    e || (e = !0, t(c));
  };
  W();
  const a = () => {
    r.removeAllListeners("overlay:selected"), r.removeAllListeners("overlay:cancelled");
  };
  r.once("overlay:selected", (c, l) => {
    a();
    const g = w.fromWebContents(c.sender);
    if (!g || g.isDestroyed()) return i(null);
    n = !0;
    const v = g.getBounds(), k = l.width < 8 || l.height < 8 ? null : {
      x: v.x + l.x,
      y: v.y + l.y,
      width: l.width,
      height: l.height
    };
    b(), E(R).then(() => i(k));
  }), r.once("overlay:cancelled", () => {
    a(), n = !0, b(), E(R).then(() => i(null));
  }), h.forEach((c) => {
    c.once("closed", () => {
      !n && h.length === 0 && (a(), i(null));
    });
  });
})));
function T() {
  if (!o) return null;
  const t = o.getBounds();
  return {
    x: t.x,
    y: t.y,
    width: t.width,
    height: Math.max(1, t.height - s)
  };
}
function f() {
  const t = T();
  t && (d == null || d.webContents.send("scanner:continuous-roi-changed", t));
}
function A(t) {
  o = new w({
    x: t.x,
    y: t.y,
    width: t.width,
    height: t.height + s,
    minWidth: p,
    minHeight: p + s,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    fullscreenable: !1,
    resizable: !0,
    movable: !0,
    webPreferences: {
      contextIsolation: !1,
      nodeIntegration: !0
    }
  });
  const e = `<!doctype html><html><head><style>
    html,body{margin:0;width:100%;height:100%;background:transparent;font-family:Segoe UI,sans-serif;user-select:none;}
    #scanner{filter:drop-shadow(0 10px 24px rgba(0,0,0,.35));height:100%;display:flex;flex-direction:column;justify-content: stretch}
    #scanBox{position:relative;flex-grow: 1;border:2px solid #58a6ff;background:rgba(88,166,255,.5);cursor:move;-webkit-app-region:drag}
    #scanBox::after{content:'';position:absolute;inset:10px;border:1px dashed rgba(255,255,255,.75);border-radius:8px;pointer-events:none}
    #bar{height:${s}px;display:flex;align-items:center;gap:8px;padding:5px 7px;border:1px solid rgba(88,166,255,.75);border-top:0;border-radius:0 0 10px 10px;background:rgba(10,20,36,.92);color:white;font-size:12px;-webkit-app-region:no-drag}
    #status{font-weight:600;margin-right:auto;letter-spacing:.2px;white-space:nowrap}
    button{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:24px;border:1px solid rgba(255,255,255,.22);border-radius:6px;background:rgba(255,255,255,.12);color:white;padding:0 7px;font:inherit;line-height:1;cursor:pointer;-webkit-app-region:no-drag}
    button:hover{background:rgba(255,255,255,.22)}
    .handle{position:absolute;z-index:5;background:transparent;-webkit-app-region:no-drag}
    .n{left:12px;right:12px;top:0;height:10px;cursor:ns-resize}.s{left:12px;right:12px;bottom:${s - 5}px;height:10px;cursor:ns-resize}
    .w{left:0;top:12px;bottom:${s + 12}px;width:10px;cursor:ew-resize}.e{right:0;top:12px;bottom:${s + 12}px;width:10px;cursor:ew-resize}
    .nw{left:0;top:0;width:16px;height:16px;cursor:nwse-resize}.ne{right:0;top:0;width:16px;height:16px;cursor:nesw-resize}.sw{left:0;bottom:${s - 5}px;width:16px;height:16px;cursor:nesw-resize}.se{right:0;bottom:${s - 5}px;width:16px;height:16px;cursor:nwse-resize}
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
      const minWidth = ${p};
      const minHeight = ${p + s};

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
  o.setContentProtection(!0), o.on("move", f), o.on("resize", f), o.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(e)}`);
}
function B(t) {
  const e = Math.min(C, t.width, t.height - s);
  return {
    x: t.x + Math.floor((t.width - e) / 2),
    y: t.y + Math.floor((t.height - e - s) / 2),
    width: e,
    height: e
  };
}
function y() {
  b(), o && (o.close(), o = null);
}
r.handle("scanner:start-continuous-overlay", async () => {
  y();
  const t = I(), e = B(t);
  return A(e), e;
});
r.handle("scanner:stop-continuous-overlay", async () => {
  y();
});
r.handle("scanner:update-last-qr", async (t, e) => {
  o == null || o.webContents.send("continuous-overlay:last-qr", e);
});
r.on("continuous-overlay:roi-changed", () => {
  f();
});
r.on("continuous-overlay:set-bounds", (t, e) => {
  if (!o) return;
  const n = I(), i = Math.min(
    n.width,
    Math.max(p, Math.round(e.width))
  ), a = Math.min(
    n.height,
    Math.max(p + s, Math.round(e.height))
  ), c = Math.min(
    Math.max(n.x, Math.round(e.x)),
    n.x + n.width - i
  ), l = Math.min(
    Math.max(n.y, Math.round(e.y)),
    n.y + n.height - a
  );
  o.setBounds({ x: c, y: l, width: i, height: a }), f();
});
r.on("continuous-overlay:closed", () => {
  d == null || d.webContents.send("scanner:continuous-overlay-closed"), y();
});
r.handle("scanner:capture-fullscreen", async (t, e) => {
  const n = { x: e.x + e.width / 2, y: e.y + e.height / 2 }, i = m.getDisplayNearestPoint(n), a = i.scaleFactor || 1, c = await O.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(i.bounds.width * a),
      height: Math.floor(i.bounds.height * a)
    },
    fetchWindowIcons: !1
  }), l = c.find((g) => g.display_id === String(i.id)) || c[0];
  if (!l) throw new Error("No screen source available");
  return {
    imageDataUrl: l.thumbnail.toDataURL(),
    displayBounds: i.bounds,
    scaleFactor: a
  };
});
r.handle("scanner:save-image", async (t, e) => {
  const { canceled: n, filePath: i } = await _.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (n || !i) return { canceled: !0 };
  const a = e.replace(/^data:image\/png;base64,/, "");
  return await P.writeFile(i, Buffer.from(a, "base64")), { canceled: !1, filePath: i };
});
u.on("window-all-closed", () => {
  process.platform !== "darwin" && (u.quit(), d = null);
});
u.on("activate", () => {
  w.getAllWindows().length === 0 && M();
});
u.whenReady().then(M);
export {
  z as VITE_DEV_SERVER_URL
};
