import { ipcMain as p, screen as O, desktopCapturer as A, app as o, BrowserWindow as f, Menu as z } from "electron";
import { fileURLToPath as P } from "node:url";
import h from "node:path";
const H = h.dirname(P(import.meta.url)), R = process.env.VITE_DEV_SERVER_URL, D = 360, u = 320, _ = 230, a = 260, c = 120;
let n = null, t = null, s = u, d = !1, g = !1;
function C() {
  return o.isPackaged ? h.join(o.getAppPath(), "dist", "index.html") : h.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function N() {
  return o.isPackaged ? h.join(o.getAppPath(), "dist", "icon.ico") : h.join(process.env.APP_ROOT ?? process.cwd(), "public", "icon.ico");
}
function M() {
  z.setApplicationMenu(null), n = new f({
    width: D,
    height: _,
    minWidth: a,
    minHeight: _,
    useContentSize: !0,
    title: "QR Scanner",
    icon: N(),
    webPreferences: {
      preload: h.join(H, "preload.mjs"),
      contextIsolation: !0
    }
  }), n.on("closed", () => {
    E(), n = null;
  }), n.on("move", () => I()), n.on("resize", () => I()), n.webContents.on("context-menu", (e, i) => {
    i.isEditable && z.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" }
    ]).popup({ window: n ?? void 0 });
  }), R ? n.loadURL(R) : n.loadFile(C());
}
function y() {
  return (n == null ? void 0 : n.getBounds()) ?? O.getPrimaryDisplay().workArea;
}
function T(e = y()) {
  return {
    x: e.x,
    y: e.y - s,
    width: e.width,
    height: s
  };
}
function I() {
  !t || !n || d || (d = !0, t.setBounds(T()), d = !1, m());
}
function x() {
  if (!t || !n || d) return;
  const e = t.getBounds();
  s = Math.max(c, e.height), d = !0, n.setBounds({
    x: e.x,
    y: e.y + s,
    width: Math.max(a, e.width),
    height: y().height
  }), t.setBounds({
    x: e.x,
    y: e.y,
    width: Math.max(a, e.width),
    height: s
  }), d = !1, m();
}
function W() {
  if (!t) return null;
  const e = t.getBounds();
  return {
    x: e.x,
    y: e.y,
    width: e.width,
    height: e.height
  };
}
function m() {
  const e = W();
  e && (n == null || n.webContents.send("scanner:continuous-roi-changed", e));
}
function S(e) {
  s = Math.max(c, e.height);
  const i = T();
  t = new f({
    autoHideMenuBar: !0,
    x: i.x,
    y: i.y,
    width: i.width,
    height: i.height,
    minWidth: a,
    minHeight: c,
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
  const l = `<!doctype html><html><head><style>
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
      const minWidth = ${a};
      const minHeight = ${c};

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
    <\/script>
  </body></html>`;
  t.setContentProtection(!0), t.setAlwaysOnTop(!0, "screen-saver"), t.on("move", x), t.on("resize", x), t.on("closed", () => {
    const r = !g;
    t = null, s = u, g = !1, r && o.quit();
  }), t.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(l)}`);
}
function B(e) {
  return {
    x: e.x,
    y: e.y - u,
    width: Math.max(a, e.width),
    height: u
  };
}
function E() {
  t && (g = !0, t.close(), t = null, s = u);
}
p.handle("scanner:start-continuous-overlay", async () => {
  if (!t) {
    const i = y(), l = B(i);
    S(l);
  }
  const e = W();
  if (!e) throw new Error("Unable to create scan area");
  return e;
});
p.handle("scanner:stop-continuous-overlay", async () => {
  E();
});
p.on("continuous-overlay:roi-changed", () => {
  m();
});
p.on("continuous-overlay:set-bounds", (e, i) => {
  t && (t.setBounds({
    x: Math.round(i.x),
    y: Math.round(i.y),
    width: Math.max(a, Math.round(i.width)),
    height: Math.max(c, Math.round(i.height))
  }), x());
});
p.handle("scanner:capture-fullscreen", async (e, i) => {
  const l = { x: i.x + i.width / 2, y: i.y + i.height / 2 }, r = O.getDisplayNearestPoint(l), w = r.scaleFactor || 1, v = await A.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(r.bounds.width * w),
      height: Math.floor(r.bounds.height * w)
    },
    fetchWindowIcons: !1
  }), b = v.find((U) => U.display_id === String(r.id)) || v[0];
  if (!b) throw new Error("No screen source available");
  return {
    imageDataUrl: b.thumbnail.toDataURL(),
    displayBounds: r.bounds,
    scaleFactor: w
  };
});
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), n = null);
});
o.on("activate", () => {
  f.getAllWindows().length === 0 && M();
});
o.whenReady().then(M);
export {
  R as VITE_DEV_SERVER_URL
};
