import { ipcMain as p, screen as _, desktopCapturer as U, app as s, BrowserWindow as x, Menu as W } from "electron";
import { fileURLToPath as H } from "node:url";
import c from "node:path";
const C = c.dirname(H(import.meta.url)), b = process.env.VITE_DEV_SERVER_URL, D = 360, u = 240, z = 230, r = 260, l = 120;
let n = null, t = null, o = u, a = !1;
function A() {
  return s.isPackaged ? c.join(s.getAppPath(), "dist", "index.html") : c.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function I() {
  n = new x({
    width: D,
    height: z,
    minWidth: r,
    minHeight: z,
    useContentSize: !0,
    icon: c.join(s.getAppPath(), "dist", "electron-vite.svg"),
    webPreferences: {
      preload: c.join(C, "preload.mjs"),
      contextIsolation: !0
    }
  }), n.on("closed", () => {
    T(), n = null;
  }), n.on("move", () => R()), n.on("resize", () => R()), n.webContents.on("context-menu", (e, i) => {
    i.isEditable && W.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" }
    ]).popup({ window: n ?? void 0 });
  }), b ? n.loadURL(b) : n.loadFile(A());
}
function f() {
  return (n == null ? void 0 : n.getContentBounds()) ?? _.getPrimaryDisplay().workArea;
}
function O(e = f()) {
  return {
    x: e.x,
    y: e.y - o,
    width: e.width,
    height: o
  };
}
function R() {
  !t || !n || a || (a = !0, t.setBounds(O()), a = !1, y());
}
function g() {
  if (!t || !n || a) return;
  const e = t.getBounds();
  o = Math.max(l, e.height), a = !0, n.setContentBounds({
    x: e.x,
    y: e.y + o,
    width: Math.max(r, e.width),
    height: f().height
  }), t.setBounds({
    x: e.x,
    y: e.y,
    width: Math.max(r, e.width),
    height: o
  }), a = !1, y();
}
function M() {
  if (!t) return null;
  const e = t.getBounds();
  return {
    x: e.x,
    y: e.y,
    width: e.width,
    height: e.height
  };
}
function y() {
  const e = M();
  e && (n == null || n.webContents.send("scanner:continuous-roi-changed", e));
}
function N(e) {
  o = Math.max(l, e.height);
  const i = O();
  t = new x({
    autoHideMenuBar: !0,
    x: i.x,
    y: i.y,
    width: i.width,
    height: i.height,
    minWidth: r,
    minHeight: l,
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
  const d = `<!doctype html><html><head><style>
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
      const minWidth = ${r};
      const minHeight = ${l};

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
  t.setContentProtection(!0), t.setAlwaysOnTop(!0, "screen-saver"), t.on("move", g), t.on("resize", g), t.on("closed", () => {
    t = null, o = u;
  }), t.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(d)}`);
}
function P(e) {
  return {
    x: e.x,
    y: e.y - u,
    width: Math.max(r, e.width),
    height: u
  };
}
function T() {
  t && (t.close(), t = null, o = u);
}
p.handle("scanner:start-continuous-overlay", async () => {
  if (!t) {
    const i = f(), d = P(i);
    N(d);
  }
  const e = M();
  if (!e) throw new Error("Unable to create scan area");
  return e;
});
p.handle("scanner:stop-continuous-overlay", async () => {
  T();
});
p.on("continuous-overlay:roi-changed", () => {
  y();
});
p.on("continuous-overlay:set-bounds", (e, i) => {
  t && (t.setBounds({
    x: Math.round(i.x),
    y: Math.round(i.y),
    width: Math.max(r, Math.round(i.width)),
    height: Math.max(l, Math.round(i.height))
  }), g());
});
p.handle("scanner:capture-fullscreen", async (e, i) => {
  const d = { x: i.x + i.width / 2, y: i.y + i.height / 2 }, h = _.getDisplayNearestPoint(d), w = h.scaleFactor || 1, m = await U.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(h.bounds.width * w),
      height: Math.floor(h.bounds.height * w)
    },
    fetchWindowIcons: !1
  }), v = m.find((E) => E.display_id === String(h.id)) || m[0];
  if (!v) throw new Error("No screen source available");
  return {
    imageDataUrl: v.thumbnail.toDataURL(),
    displayBounds: h.bounds,
    scaleFactor: w
  };
});
s.on("window-all-closed", () => {
  process.platform !== "darwin" && (s.quit(), n = null);
});
s.on("activate", () => {
  x.getAllWindows().length === 0 && I();
});
s.whenReady().then(I);
export {
  b as VITE_DEV_SERVER_URL
};
