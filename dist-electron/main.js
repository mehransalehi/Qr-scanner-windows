import { ipcMain as h, screen as P, desktopCapturer as W, app as r, BrowserWindow as y, Menu as x } from "electron";
import { fileURLToPath as D } from "node:url";
import c from "node:path";
const v = c.dirname(D(import.meta.url)), I = process.env.VITE_DEV_SERVER_URL, R = 360, E = 320, T = 230, H = E + T, M = 260, g = 120, C = g + T;
let t = null, m = !1, o = {
  x: 0,
  y: 0,
  width: R,
  height: E
};
function L() {
  return r.isPackaged ? c.join(r.getAppPath(), "dist", "index.html") : c.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function F() {
  return r.isPackaged ? c.join(r.getAppPath(), "dist", "icon.ico") : c.join(process.env.APP_ROOT ?? process.cwd(), "public", "icon.ico");
}
function O() {
  x.setApplicationMenu(null), t = new y({
    width: R,
    height: H,
    minWidth: M,
    minHeight: C,
    useContentSize: !0,
    title: "QR Scanner",
    icon: F(),
    show: !1,
    frame: !1,
    resizable: !1,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: c.join(v, "preload.mjs"),
      contextIsolation: !0
    }
  }), t.on("closed", () => {
    m = !1, t = null;
  }), t.setContentProtection(!0), t.once("ready-to-show", () => {
    w();
  }), t.on("move", () => f()), t.on("resize", () => {
    w(), f();
  }), t.webContents.on("context-menu", (e, n) => {
    n.isEditable && x.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" }
    ]).popup({ window: t ?? void 0 });
  }), I ? t.loadURL(I) : t.loadFile(L());
}
function _() {
  if (!t) return null;
  const e = t.getContentBounds();
  return {
    x: Math.round(e.x + o.x),
    y: Math.round(e.y + o.y),
    width: Math.max(M, Math.round(o.width)),
    height: Math.max(g, Math.round(o.height))
  };
}
function f() {
  const e = _();
  e && (t == null || t.webContents.send("scanner:continuous-roi-changed", e));
}
function w() {
  if (!t || process.platform === "darwin") return;
  const e = t.getContentBounds(), n = [], i = (S, b, N, A) => {
    const p = {
      x: Math.max(0, Math.round(S)),
      y: Math.max(0, Math.round(b)),
      width: Math.max(0, Math.round(N)),
      height: Math.max(0, Math.round(A))
    };
    p.width > 0 && p.height > 0 && n.push(p);
  }, a = Math.max(0, Math.round(o.x)), s = Math.max(0, Math.round(o.y)), l = Math.min(e.width - a, Math.round(o.width)), d = Math.min(e.height - s, Math.round(o.height));
  i(a, s, l, d);
  const u = Math.min(e.height, Math.max(0, s + d));
  i(0, u, e.width, e.height - u), t.setShape(n);
}
function U(e) {
  o = {
    x: Math.max(0, e.x),
    y: Math.max(0, e.y),
    width: Math.max(M, e.width),
    height: Math.max(g, e.height)
  }, w();
  const n = _();
  if (!n) throw new Error("Unable to locate scan area");
  return m || (t == null || t.show(), m = !0), f(), n;
}
h.handle("scanner:start-continuous-overlay", async (e, n) => {
  if (n) return U(n);
  const i = _();
  if (!i) throw new Error("Unable to create scan area");
  return i;
});
h.handle("scanner:stop-continuous-overlay", async () => {
});
h.handle("scanner:update-scan-area", async (e, n) => U(n));
h.handle("window:minimize", () => {
  t == null || t.minimize();
});
h.handle("window:close", () => {
  t == null || t.close();
});
h.handle("scanner:capture-fullscreen", async (e, n) => {
  const i = { x: n.x + n.width / 2, y: n.y + n.height / 2 }, a = P.getDisplayNearestPoint(i), s = a.scaleFactor || 1, l = await W.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(a.bounds.width * s),
      height: Math.floor(a.bounds.height * s)
    },
    fetchWindowIcons: !1
  }), d = l.find((u) => u.display_id === String(a.id)) || l[0];
  if (!d) throw new Error("No screen source available");
  return {
    imageDataUrl: d.thumbnail.toDataURL(),
    displayBounds: a.bounds,
    scaleFactor: s
  };
});
r.on("window-all-closed", () => {
  process.platform !== "darwin" && (r.quit(), t = null);
});
r.on("activate", () => {
  y.getAllWindows().length === 0 && O();
});
r.whenReady().then(O);
export {
  I as VITE_DEV_SERVER_URL
};
