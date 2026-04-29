import { ipcMain as r, screen as f, desktopCapturer as x, dialog as v, app as h, BrowserWindow as m } from "electron";
import { fileURLToPath as R } from "node:url";
import a from "node:path";
import E from "node:fs/promises";
const w = a.dirname(R(import.meta.url));
process.env.APP_ROOT = a.join(w, "..");
const p = process.env.VITE_DEV_SERVER_URL, D = a.join(process.env.APP_ROOT, "dist-electron"), b = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = p ? a.join(process.env.APP_ROOT, "public") : b;
let c, n = null;
function g() {
  c = new m({
    width: 1100,
    height: 780,
    icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: a.join(w, "preload.mjs")
    }
  }), p ? c.loadURL(p) : c.loadFile(a.join(b, "index.html"));
}
function P(o) {
  n = new m({
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
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
  }), n.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;cursor:crosshair;background:rgba(0,0,0,.45)}
    #box{position:absolute;border:2px solid #58a6ff;background:rgba(88,166,255,.15);display:none}
    #hint{position:fixed;top:16px;left:16px;color:white;font-family:Segoe UI,sans-serif;background:rgba(0,0,0,.5);padding:10px 12px;border-radius:8px}
  </style></head><body><div id='hint'>Drag to select scan region. Press ESC to cancel.</div><div id='box'></div>
  <script>
    const { ipcRenderer } = require('electron');
    let start=null; const box=document.getElementById('box');
    const norm=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});
    window.addEventListener('mousedown',e=>{start={x:e.clientX,y:e.clientY};box.style.display='block';});
    window.addEventListener('mousemove',e=>{if(!start)return;const r=norm(start,{x:e.clientX,y:e.clientY});Object.assign(box.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});});
    window.addEventListener('mouseup',e=>{if(!start)return;const r=norm(start,{x:e.clientX,y:e.clientY});ipcRenderer.send('overlay:selected',r);});
    window.addEventListener('keydown',e=>{if(e.key==='Escape')ipcRenderer.send('overlay:cancelled');});
  <\/script></body></html>`)}`);
}
r.handle("scanner:select-roi", async () => {
  n && (n.close(), n = null);
  const o = f.getAllDisplays(), s = o.reduce(
    (t, e) => ({
      x: Math.min(t.x, e.bounds.x),
      y: Math.min(t.y, e.bounds.y),
      width: Math.max(t.x + t.width, e.bounds.x + e.bounds.width) - Math.min(t.x, e.bounds.x),
      height: Math.max(t.y + t.height, e.bounds.y + e.bounds.height) - Math.min(t.y, e.bounds.y)
    }),
    o[0].bounds
  );
  return new Promise((t) => {
    P(s);
    const e = () => {
      r.removeAllListeners("overlay:selected"), r.removeAllListeners("overlay:cancelled");
    };
    r.once("overlay:selected", (l, i) => {
      if (e(), !n) return t(null);
      const d = n.getBounds(), u = i.width < 8 || i.height < 8 ? null : { x: d.x + i.x, y: d.y + i.y, width: i.width, height: i.height }, y = n;
      y.once("closed", () => t(u)), y.close(), n = null;
    }), r.once("overlay:cancelled", () => {
      e(), n == null || n.close(), n = null, t(null);
    }), n == null || n.once("closed", () => {
      n = null, e(), t(null);
    });
  });
});
r.handle("scanner:capture-fullscreen", async (o, s) => {
  const t = { x: s.x + s.width / 2, y: s.y + s.height / 2 }, e = f.getDisplayNearestPoint(t), l = e.scaleFactor || 1, i = await x.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(e.bounds.width * l),
      height: Math.floor(e.bounds.height * l)
    },
    fetchWindowIcons: !1
  }), d = i.find((u) => u.display_id === String(e.id)) || i[0];
  if (!d) throw new Error("No screen source available");
  return {
    imageDataUrl: d.thumbnail.toDataURL(),
    displayBounds: e.bounds,
    scaleFactor: l
  };
});
r.handle("scanner:save-image", async (o, s) => {
  const { canceled: t, filePath: e } = await v.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (t || !e) return { canceled: !0 };
  const l = s.replace(/^data:image\/png;base64,/, "");
  return await E.writeFile(e, Buffer.from(l, "base64")), { canceled: !1, filePath: e };
});
h.on("window-all-closed", () => {
  process.platform !== "darwin" && (h.quit(), c = null);
});
h.on("activate", () => {
  m.getAllWindows().length === 0 && g();
});
h.whenReady().then(g);
export {
  D as MAIN_DIST,
  b as RENDERER_DIST,
  p as VITE_DEV_SERVER_URL
};
