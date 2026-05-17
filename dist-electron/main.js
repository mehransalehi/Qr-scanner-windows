import { ipcMain as c, screen as O, desktopCapturer as U, app as o, BrowserWindow as I, Menu as f } from "electron";
import { fileURLToPath as M } from "node:url";
import a from "node:path";
const N = a.dirname(M(import.meta.url)), m = process.env.VITE_DEV_SERVER_URL, g = 360, y = 320, R = 230, b = y + R, u = 260, h = 120, A = h + R;
let e = null, i = {
  x: 0,
  y: 0,
  width: g,
  height: y
};
function D() {
  return o.isPackaged ? a.join(o.getAppPath(), "dist", "index.html") : a.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function v() {
  return o.isPackaged ? a.join(o.getAppPath(), "dist", "icon.ico") : a.join(process.env.APP_ROOT ?? process.cwd(), "public", "icon.ico");
}
function E() {
  f.setApplicationMenu(null), e = new I({
    width: g,
    height: b,
    minWidth: u,
    minHeight: A,
    useContentSize: !0,
    title: "QR Scanner",
    icon: v(),
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: a.join(N, "preload.mjs"),
      contextIsolation: !0
    }
  }), e.on("closed", () => {
    e = null;
  }), e.on("move", () => d()), e.on("resize", () => d()), e.webContents.on("context-menu", (n, t) => {
    t.isEditable && f.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" }
    ]).popup({ window: e ?? void 0 });
  }), m ? e.loadURL(m) : e.loadFile(D());
}
function p() {
  if (!e) return null;
  const n = e.getContentBounds();
  return {
    x: Math.round(n.x + i.x),
    y: Math.round(n.y + i.y),
    width: Math.max(u, Math.round(i.width)),
    height: Math.max(h, Math.round(i.height))
  };
}
function d() {
  const n = p();
  n && (e == null || e.webContents.send("scanner:continuous-roi-changed", n));
}
function T(n) {
  i = {
    x: Math.max(0, n.x),
    y: Math.max(0, n.y),
    width: Math.max(u, n.width),
    height: Math.max(h, n.height)
  };
  const t = p();
  if (!t) throw new Error("Unable to locate scan area");
  return d(), t;
}
c.handle("scanner:start-continuous-overlay", async (n, t) => {
  if (t) return T(t);
  const s = p();
  if (!s) throw new Error("Unable to create scan area");
  return s;
});
c.handle("scanner:stop-continuous-overlay", async () => {
});
c.handle("scanner:update-scan-area", async (n, t) => T(t));
c.handle("scanner:capture-fullscreen", async (n, t) => {
  const s = { x: t.x + t.width / 2, y: t.y + t.height / 2 }, r = O.getDisplayNearestPoint(s), l = r.scaleFactor || 1, _ = await U.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(r.bounds.width * l),
      height: Math.floor(r.bounds.height * l)
    },
    fetchWindowIcons: !1
  }), w = _.find((x) => x.display_id === String(r.id)) || _[0];
  if (!w) throw new Error("No screen source available");
  return {
    imageDataUrl: w.thumbnail.toDataURL(),
    displayBounds: r.bounds,
    scaleFactor: l
  };
});
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), e = null);
});
o.on("activate", () => {
  I.getAllWindows().length === 0 && E();
});
o.whenReady().then(E);
export {
  m as VITE_DEV_SERVER_URL
};
