import { ipcMain as s, screen as R, desktopCapturer as I, dialog as k, app as u, BrowserWindow as w } from "electron";
import { fileURLToPath as _ } from "node:url";
import g from "node:path";
import P from "node:fs/promises";
const L = g.dirname(_(import.meta.url)), m = process.env.VITE_DEV_SERVER_URL;
let d = null, n = null;
const v = 80, S = 240, a = 36, p = 96;
function z(t) {
  return new Promise((e) => setTimeout(e, t));
}
function O() {
  return u.isPackaged ? g.join(u.getAppPath(), "dist", "index.html") : g.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function M() {
  d = new w({
    width: 1100,
    height: 780,
    icon: g.join(u.getAppPath(), "dist", "electron-vite.svg"),
    webPreferences: {
      preload: g.join(L, "preload.mjs"),
      contextIsolation: !0
    }
  }), m ? d.loadURL(m) : d.loadFile(O());
}
function b() {
  const t = R.getAllDisplays();
  return t.reduce(
    (e, o) => ({
      x: Math.min(e.x, o.bounds.x),
      y: Math.min(e.y, o.bounds.y),
      width: Math.max(e.x + e.width, o.bounds.x + o.bounds.width) - Math.min(e.x, o.bounds.x),
      height: Math.max(e.y + e.height, o.bounds.y + o.bounds.height) - Math.min(e.y, o.bounds.y)
    }),
    t[0].bounds
  );
}
function U(t) {
  n = new w({
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
  });
  const e = `<!doctype html><html><head><style>
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
  n.setContentProtection(!0), n.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(e)}`);
}
s.handle("scanner:select-roi", async () => {
  n && (n.close(), n = null);
  const t = b();
  return new Promise((e) => {
    let o = !1, i = !1;
    const r = (h) => {
      o || (o = !0, e(h));
    };
    U(t);
    const l = () => {
      s.removeAllListeners("overlay:selected"), s.removeAllListeners("overlay:cancelled");
    };
    s.once("overlay:selected", (h, c) => {
      if (l(), !n) return r(null);
      i = !0;
      const y = n.getBounds(), E = c.width < 8 || c.height < 8 ? null : {
        x: y.x + c.x,
        y: y.y + c.y,
        width: c.width,
        height: c.height
      };
      n.once("closed", async () => {
        await z(v), r(E);
      }), n.close(), n = null;
    }), s.once("overlay:cancelled", () => {
      if (l(), !n) return r(null);
      i = !0, n.once("closed", async () => {
        await z(v), r(null);
      }), n.close(), n = null;
    }), n == null || n.once("closed", () => {
      l(), n = null, i || r(null);
    });
  });
});
function C() {
  if (!n) return null;
  const t = n.getBounds();
  return {
    x: t.x,
    y: t.y,
    width: t.width,
    height: Math.max(1, t.height - a)
  };
}
function x() {
  const t = C();
  t && (d == null || d.webContents.send("scanner:continuous-roi-changed", t));
}
function D(t) {
  n = new w({
    x: t.x,
    y: t.y,
    width: t.width,
    height: t.height + a,
    minWidth: p,
    minHeight: p + a,
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
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:Segoe UI,sans-serif;user-select:none}
    #scanner{position:absolute;inset:0;filter:drop-shadow(0 10px 24px rgba(0,0,0,.35))}
    #scanBox{position:absolute;left:0;top:0;width:100%;height:calc(100% - ${a}px);border:2px solid #58a6ff;background:rgba(88,166,255,.5);cursor:move;-webkit-app-region:drag}
    #scanBox::after{content:'';position:absolute;inset:10px;border:1px dashed rgba(255,255,255,.75);border-radius:8px;pointer-events:none}
    #bar{position:absolute;left:0;bottom:0;width:100%;height:${a}px;display:flex;align-items:center;gap:8px;padding:5px 7px;border:1px solid rgba(88,166,255,.75);border-top:0;border-radius:0 0 10px 10px;background:rgba(10,20,36,.92);color:white;font-size:12px;cursor:move;-webkit-app-region:drag}
    #status{font-weight:600;margin-right:auto;letter-spacing:.2px;white-space:nowrap}
    button{border:1px solid rgba(255,255,255,.22);border-radius:6px;background:rgba(255,255,255,.12);color:white;padding:4px 8px;font:inherit;cursor:pointer;-webkit-app-region:no-drag}
    button:hover{background:rgba(255,255,255,.22)}
    #move{cursor:grab;-webkit-app-region:drag} #move:active{cursor:grabbing}
    .handle{position:absolute;width:18px;height:18px;background:#58a6ff;border:2px solid white;border-radius:50%;z-index:5;-webkit-app-region:no-drag}
    .nw{left:-2px;top:-2px;cursor:nwse-resize}.ne{right:-2px;top:-2px;cursor:nesw-resize}.sw{left:-2px;bottom:${a - 2}px;cursor:nesw-resize}.se{right:-2px;bottom:${a - 2}px;cursor:nwse-resize}
  </style></head><body>
    <div id="scanner">
      <div id="scanBox"></div>
      <div id="bar"><span id="status">Scanning</span><button id="copy" type="button">Copy</button><button id="move" type="button" title="Drag to move">Move</button><button id="close" type="button">Close</button></div>
      <div class="handle nw" data-handle="nw"></div><div class="handle ne" data-handle="ne"></div><div class="handle sw" data-handle="sw"></div><div class="handle se" data-handle="se"></div>
    </div>
    <script>
      const { ipcRenderer, clipboard } = require('electron');
      const copy = document.getElementById('copy');
      const closeButton = document.getElementById('close');
      let latestQr = '';
      let resize = null;
      const minWidth = ${p};
      const minHeight = ${p + a};

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
  n.setContentProtection(!0), n.on("move", x), n.on("resize", x), n.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(e)}`);
}
function B(t) {
  const e = Math.min(S, t.width, t.height - a);
  return {
    x: t.x + Math.floor((t.width - e) / 2),
    y: t.y + Math.floor((t.height - e - a) / 2),
    width: e,
    height: e
  };
}
function f() {
  n && (n.close(), n = null);
}
s.handle("scanner:start-continuous-overlay", async () => {
  f();
  const t = b(), e = B(t);
  return D(e), e;
});
s.handle("scanner:stop-continuous-overlay", async () => {
  f();
});
s.handle("scanner:update-last-qr", async (t, e) => {
  n == null || n.webContents.send("continuous-overlay:last-qr", e);
});
s.on("continuous-overlay:roi-changed", () => {
  x();
});
s.on("continuous-overlay:set-bounds", (t, e) => {
  if (!n) return;
  const o = b(), i = Math.min(
    o.width,
    Math.max(p, Math.round(e.width))
  ), r = Math.min(
    o.height,
    Math.max(p + a, Math.round(e.height))
  ), l = Math.min(
    Math.max(o.x, Math.round(e.x)),
    o.x + o.width - i
  ), h = Math.min(
    Math.max(o.y, Math.round(e.y)),
    o.y + o.height - r
  );
  n.setBounds({ x: l, y: h, width: i, height: r }), x();
});
s.on("continuous-overlay:closed", () => {
  d == null || d.webContents.send("scanner:continuous-overlay-closed"), f();
});
s.handle("scanner:capture-fullscreen", async (t, e) => {
  const o = { x: e.x + e.width / 2, y: e.y + e.height / 2 }, i = R.getDisplayNearestPoint(o), r = i.scaleFactor || 1, l = await I.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(i.bounds.width * r),
      height: Math.floor(i.bounds.height * r)
    },
    fetchWindowIcons: !1
  }), h = l.find((c) => c.display_id === String(i.id)) || l[0];
  if (!h) throw new Error("No screen source available");
  return {
    imageDataUrl: h.thumbnail.toDataURL(),
    displayBounds: i.bounds,
    scaleFactor: r
  };
});
s.handle("scanner:save-image", async (t, e) => {
  const { canceled: o, filePath: i } = await k.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (o || !i) return { canceled: !0 };
  const r = e.replace(/^data:image\/png;base64,/, "");
  return await P.writeFile(i, Buffer.from(r, "base64")), { canceled: !1, filePath: i };
});
u.on("window-all-closed", () => {
  process.platform !== "darwin" && (u.quit(), d = null);
});
u.on("activate", () => {
  w.getAllWindows().length === 0 && M();
});
u.whenReady().then(M);
export {
  m as VITE_DEV_SERVER_URL
};
