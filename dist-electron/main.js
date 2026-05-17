import { ipcMain as r, screen as U, desktopCapturer as M, app as o, BrowserWindow as g, Menu as w } from "electron";
import { fileURLToPath as b } from "node:url";
import a from "node:path";
const N = a.dirname(b(import.meta.url)), I = process.env.VITE_DEV_SERVER_URL, y = 360, R = 320, E = 230, A = R + E, u = 260, p = 120, D = p + E;
let e = null, d = !1, s = {
  x: 0,
  y: 0,
  width: y,
  height: R
};
function P() {
  return o.isPackaged ? a.join(o.getAppPath(), "dist", "index.html") : a.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function S() {
  return o.isPackaged ? a.join(o.getAppPath(), "dist", "icon.ico") : a.join(process.env.APP_ROOT ?? process.cwd(), "public", "icon.ico");
}
function T() {
  w.setApplicationMenu(null), e = new g({
    width: y,
    height: A,
    minWidth: u,
    minHeight: D,
    useContentSize: !0,
    title: "QR Scanner",
    icon: S(),
    show: !1,
    frame: !1,
    resizable: !1,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: a.join(N, "preload.mjs"),
      contextIsolation: !0
    }
  }), e.on("closed", () => {
    d = !1, e = null;
  }), e.setContentProtection(!0), e.on("move", () => h()), e.on("resize", () => h()), e.webContents.on("context-menu", (t, n) => {
    n.isEditable && w.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" }
    ]).popup({ window: e ?? void 0 });
  }), I ? e.loadURL(I) : e.loadFile(P());
}
function f() {
  if (!e) return null;
  const t = e.getContentBounds();
  return {
    x: Math.round(t.x + s.x),
    y: Math.round(t.y + s.y),
    width: Math.max(u, Math.round(s.width)),
    height: Math.max(p, Math.round(s.height))
  };
}
function h() {
  const t = f();
  t && (e == null || e.webContents.send("scanner:continuous-roi-changed", t));
}
function x(t) {
  s = {
    x: Math.max(0, t.x),
    y: Math.max(0, t.y),
    width: Math.max(u, t.width),
    height: Math.max(p, t.height)
  };
  const n = f();
  if (!n) throw new Error("Unable to locate scan area");
  return d || (e == null || e.show(), d = !0), h(), n;
}
r.handle("scanner:start-continuous-overlay", async (t, n) => {
  if (n) return x(n);
  const c = f();
  if (!c) throw new Error("Unable to create scan area");
  return c;
});
r.handle("scanner:stop-continuous-overlay", async () => {
});
r.handle("scanner:update-scan-area", async (t, n) => x(n));
r.handle("window:minimize", () => {
  e == null || e.minimize();
});
r.handle("window:close", () => {
  e == null || e.close();
});
r.handle("scanner:capture-fullscreen", async (t, n) => {
  const c = { x: n.x + n.width / 2, y: n.y + n.height / 2 }, i = U.getDisplayNearestPoint(c), l = i.scaleFactor || 1, m = await M.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(i.bounds.width * l),
      height: Math.floor(i.bounds.height * l)
    },
    fetchWindowIcons: !1
  }), _ = m.find((O) => O.display_id === String(i.id)) || m[0];
  if (!_) throw new Error("No screen source available");
  return {
    imageDataUrl: _.thumbnail.toDataURL(),
    displayBounds: i.bounds,
    scaleFactor: l
  };
});
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), e = null);
});
o.on("activate", () => {
  g.getAllWindows().length === 0 && T();
});
o.whenReady().then(T);
export {
  I as VITE_DEV_SERVER_URL
};
