import { ipcMain as l, screen as L, desktopCapturer as F, app as i, BrowserWindow as S, Menu as O } from "electron";
import { fileURLToPath as B } from "node:url";
import d from "node:path";
const j = d.dirname(B(import.meta.url)), U = process.env.VITE_DEV_SERVER_URL, b = 360, N = 320, W = 230, z = N + W, y = 260, R = 120, V = R + W;
let t = null, _ = !1, a = {
  x: 0,
  y: 0,
  width: b,
  height: N
};
function G() {
  return i.isPackaged ? d.join(i.getAppPath(), "dist", "index.html") : d.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function k() {
  return i.isPackaged ? d.join(i.getAppPath(), "dist", "icon.ico") : d.join(process.env.APP_ROOT ?? process.cwd(), "public", "icon.ico");
}
function A() {
  O.setApplicationMenu(null), t = new S({
    width: b,
    height: z,
    minWidth: y,
    minHeight: V,
    useContentSize: !0,
    title: "QR Scanner",
    icon: k(),
    show: !1,
    frame: !1,
    resizable: !1,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: d.join(j, "preload.mjs"),
      contextIsolation: !0
    }
  }), t.on("closed", () => {
    _ = !1, t = null;
  }), t.setContentProtection(!0), t.once("ready-to-show", () => {
    I();
  }), t.on("move", () => x()), t.on("resize", () => {
    I(), x();
  }), t.webContents.on("context-menu", (e, n) => {
    n.isEditable && O.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" }
    ]).popup({ window: t ?? void 0 });
  }), U ? t.loadURL(U) : t.loadFile(G());
}
function E() {
  if (!t) return null;
  const e = t.getContentBounds();
  return {
    x: Math.round(e.x + a.x),
    y: Math.round(e.y + a.y),
    width: Math.max(y, Math.round(a.width)),
    height: Math.max(R, Math.round(a.height))
  };
}
function x() {
  const e = E();
  e && (t == null || t.webContents.send("scanner:continuous-roi-changed", e));
}
function I() {
  if (!t || process.platform === "darwin") return;
  const e = t.getContentBounds(), n = [], o = (D, H, v, C) => {
    const g = {
      x: Math.max(0, Math.round(D)),
      y: Math.max(0, Math.round(H)),
      width: Math.max(0, Math.round(v)),
      height: Math.max(0, Math.round(C))
    };
    g.width > 0 && g.height > 0 && n.push(g);
  }, r = Math.max(0, Math.round(a.x)), s = Math.max(0, Math.round(a.y)), m = Math.min(e.width - r, Math.round(a.width)), u = Math.min(e.height - s, Math.round(a.height)), c = 8, h = 12, p = r + c, f = s + c, w = Math.max(0, m - c * 2), M = Math.max(0, u - c * 2);
  o(p, f, w, h), o(p, f + M - h, w, h), o(p, f, h, M), o(p + w - h, f, h, M);
  const T = Math.min(e.height, Math.max(0, s + u));
  o(0, T, e.width, e.height - T), t.setShape(n);
}
function P(e) {
  a = {
    x: Math.max(0, e.x),
    y: Math.max(0, e.y),
    width: Math.max(y, e.width),
    height: Math.max(R, e.height)
  }, I();
  const n = E();
  if (!n) throw new Error("Unable to locate scan area");
  return _ || (t == null || t.show(), _ = !0), x(), n;
}
l.handle("scanner:start-continuous-overlay", async (e, n) => {
  if (n) return P(n);
  const o = E();
  if (!o) throw new Error("Unable to create scan area");
  return o;
});
l.handle("scanner:stop-continuous-overlay", async () => {
});
l.handle("scanner:update-scan-area", async (e, n) => P(n));
l.handle("window:minimize", () => {
  t == null || t.minimize();
});
l.handle("window:close", () => {
  t == null || t.close();
});
l.handle("scanner:capture-fullscreen", async (e, n) => {
  const o = { x: n.x + n.width / 2, y: n.y + n.height / 2 }, r = L.getDisplayNearestPoint(o), s = r.scaleFactor || 1, m = await F.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(r.bounds.width * s),
      height: Math.floor(r.bounds.height * s)
    },
    fetchWindowIcons: !1
  }), u = m.find((c) => c.display_id === String(r.id)) || m[0];
  if (!u) throw new Error("No screen source available");
  return {
    imageDataUrl: u.thumbnail.toDataURL(),
    displayBounds: r.bounds,
    scaleFactor: s
  };
});
i.on("window-all-closed", () => {
  process.platform !== "darwin" && (i.quit(), t = null);
});
i.on("activate", () => {
  S.getAllWindows().length === 0 && A();
});
i.whenReady().then(A);
export {
  U as VITE_DEV_SERVER_URL
};
