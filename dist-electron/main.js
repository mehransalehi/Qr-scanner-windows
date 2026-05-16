import { ipcMain as w, screen as M, desktopCapturer as U, app as c, BrowserWindow as v, Menu as B } from "electron";
import { fileURLToPath as T } from "node:url";
import p from "node:path";
const C = p.dirname(T(import.meta.url)), z = process.env.VITE_DEV_SERVER_URL;
let o = null, i = null, s = null, h = null, y = !1;
const S = 240, r = 24, d = 96;
function W() {
  return c.isPackaged ? p.join(c.getAppPath(), "dist", "index.html") : p.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function O() {
  o = new v({
    width: 1100,
    height: 780,
    icon: p.join(c.getAppPath(), "dist", "electron-vite.svg"),
    webPreferences: {
      preload: p.join(C, "preload.mjs"),
      contextIsolation: !0
    }
  }), o.on("closed", () => {
    I(), o = null;
  }), o.on("move", () => m()), o.on("resize", () => A()), o.webContents.on("context-menu", (e, t) => {
    t.isEditable && B.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" }
    ]).popup({ window: o ?? void 0 });
  }), z ? o.loadURL(z) : o.loadFile(W());
}
function l() {
  return (o == null ? void 0 : o.getContentBounds()) ?? M.getPrimaryDisplay().workArea;
}
function g(e, t = l()) {
  const n = Math.min(
    Math.max(d, Math.round(e.width)),
    Math.max(d, t.width - r * 2)
  ), a = Math.min(
    Math.max(d, Math.round(e.height)),
    Math.max(d, t.height - r * 2)
  ), u = Math.min(
    Math.max(r, Math.round(e.x)),
    Math.max(r, t.width - n - r)
  ), x = Math.min(
    Math.max(r, Math.round(e.y)),
    Math.max(r, t.height - a - r)
  );
  return { x: u, y: x, width: n, height: a };
}
function _(e, t = l()) {
  const n = g(e, t);
  return {
    x: t.x + n.x,
    y: t.y + n.y,
    width: n.width,
    height: n.height
  };
}
function m(e = l()) {
  !i || !s || (y = !0, i.setBounds(_(s, e)), y = !1, f());
}
function R() {
  if (!i || y) return;
  const e = l(), t = i.getBounds();
  s = g(
    {
      x: t.x - e.x,
      y: t.y - e.y,
      width: t.width,
      height: t.height
    },
    e
  ), m(e);
}
function A() {
  if (!i || !s) return;
  const e = l();
  h && (s = g(
    {
      x: s.x / h.width * e.width,
      y: s.y / h.height * e.height,
      width: s.width / h.width * e.width,
      height: s.height / h.height * e.height
    },
    e
  )), h = e, m(e);
}
function E() {
  if (!i) return null;
  const e = i.getBounds();
  return {
    x: e.x,
    y: e.y,
    width: e.width,
    height: e.height
  };
}
function f() {
  const e = E();
  e && (o == null || o.webContents.send("scanner:continuous-roi-changed", e));
}
function L(e) {
  const t = l();
  s = g(e, t), h = t;
  const n = _(s, t);
  i = new v({
    autoHideMenuBar: !0,
    parent: o ?? void 0,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    minWidth: d,
    minHeight: d,
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
  const a = `<!doctype html><html><head><style>
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
      const minWidth = ${d};
      const minHeight = ${d};

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
  i.setContentProtection(!0), i.setAlwaysOnTop(!0, "screen-saver"), i.on("move", () => {
    R(), f();
  }), i.on("resize", () => {
    R(), f();
  }), i.on("closed", () => {
    i = null, s = null, h = null;
  }), i.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(a)}`);
}
function k(e) {
  const t = Math.min(
    S,
    Math.max(d, e.width - r * 2),
    Math.max(d, e.height - r * 2)
  );
  return {
    x: Math.max(r, Math.floor((e.width - t) / 2)),
    y: Math.max(r, Math.floor((e.height - t) / 2)),
    width: t,
    height: t
  };
}
function I() {
  i && (i.close(), i = null, s = null, h = null);
}
w.handle("scanner:start-continuous-overlay", async () => {
  if (!i) {
    const t = l(), n = s ?? k(t);
    L(n);
  }
  const e = E();
  if (!e) throw new Error("Unable to create scan area");
  return e;
});
w.handle("scanner:stop-continuous-overlay", async () => {
  I();
});
w.on("continuous-overlay:roi-changed", () => {
  f();
});
w.on("continuous-overlay:set-bounds", (e, t) => {
  if (!i) return;
  const n = l();
  s = g(
    {
      x: t.x - n.x,
      y: t.y - n.y,
      width: t.width,
      height: t.height
    },
    n
  ), m(n);
});
w.handle("scanner:capture-fullscreen", async (e, t) => {
  const n = { x: t.x + t.width / 2, y: t.y + t.height / 2 }, a = M.getDisplayNearestPoint(n), u = a.scaleFactor || 1, x = await U.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(a.bounds.width * u),
      height: Math.floor(a.bounds.height * u)
    },
    fetchWindowIcons: !1
  }), b = x.find((P) => P.display_id === String(a.id)) || x[0];
  if (!b) throw new Error("No screen source available");
  return {
    imageDataUrl: b.thumbnail.toDataURL(),
    displayBounds: a.bounds,
    scaleFactor: u
  };
});
c.on("window-all-closed", () => {
  process.platform !== "darwin" && (c.quit(), o = null);
});
c.on("activate", () => {
  v.getAllWindows().length === 0 && O();
});
c.whenReady().then(O);
export {
  z as VITE_DEV_SERVER_URL
};
