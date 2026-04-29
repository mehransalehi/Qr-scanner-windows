import { ipcMain as r, screen as m, desktopCapturer as g, dialog as x, app as h, BrowserWindow as p } from "electron";
import { fileURLToPath as v } from "node:url";
import a from "node:path";
import R from "node:fs/promises";
const y = a.dirname(v(import.meta.url));
process.env.APP_ROOT = a.join(y, "..");
const u = process.env.VITE_DEV_SERVER_URL, M = a.join(process.env.APP_ROOT, "dist-electron"), f = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = u ? a.join(process.env.APP_ROOT, "public") : f;
let c, n = null;
function w() {
  c = new p({
    width: 1100,
    height: 780,
    icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: a.join(y, "preload.mjs")
    }
  }), u ? c.loadURL(u) : c.loadFile(a.join(f, "index.html"));
}
function E(o) {
  n = new p({
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
  const o = m.getAllDisplays(), i = o.reduce(
    (t, e) => ({
      x: Math.min(t.x, e.bounds.x),
      y: Math.min(t.y, e.bounds.y),
      width: Math.max(t.x + t.width, e.bounds.x + e.bounds.width) - Math.min(t.x, e.bounds.x),
      height: Math.max(t.y + t.height, e.bounds.y + e.bounds.height) - Math.min(t.y, e.bounds.y)
    }),
    o[0].bounds
  );
  return new Promise((t) => {
    E(i);
    const e = () => {
      r.removeAllListeners("overlay:selected"), r.removeAllListeners("overlay:cancelled");
    };
    r.once("overlay:selected", (l, s) => {
      if (e(), !n) return t(null);
      const d = n.getBounds();
      if (n.close(), n = null, s.width < 8 || s.height < 8) return t(null);
      t({ x: d.x + s.x, y: d.y + s.y, width: s.width, height: s.height });
    }), r.once("overlay:cancelled", () => {
      e(), n == null || n.close(), n = null, t(null);
    }), n == null || n.once("closed", () => {
      n = null, e(), t(null);
    });
  });
});
r.handle("scanner:capture-fullscreen", async (o, i) => {
  const t = { x: i.x + i.width / 2, y: i.y + i.height / 2 }, e = m.getDisplayNearestPoint(t), l = e.scaleFactor || 1, s = await g.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(e.bounds.width * l),
      height: Math.floor(e.bounds.height * l)
    },
    fetchWindowIcons: !1
  }), d = s.find((b) => b.display_id === String(e.id)) || s[0];
  if (!d) throw new Error("No screen source available");
  return {
    imageDataUrl: d.thumbnail.toDataURL(),
    displayBounds: e.bounds,
    scaleFactor: l
  };
});
r.handle("scanner:save-image", async (o, i) => {
  const { canceled: t, filePath: e } = await x.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (t || !e) return { canceled: !0 };
  const l = i.replace(/^data:image\/png;base64,/, "");
  return await R.writeFile(e, Buffer.from(l, "base64")), { canceled: !1, filePath: e };
});
h.on("window-all-closed", () => {
  process.platform !== "darwin" && (h.quit(), c = null);
});
h.on("activate", () => {
  p.getAllWindows().length === 0 && w();
});
h.whenReady().then(w);
export {
  M as MAIN_DIST,
  f as RENDERER_DIST,
  u as VITE_DEV_SERVER_URL
};
