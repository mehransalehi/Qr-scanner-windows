import { ipcMain as d, screen as b, desktopCapturer as E, dialog as P, app as p, BrowserWindow as m } from "electron";
import { fileURLToPath as _ } from "node:url";
import l from "node:path";
import I from "node:fs/promises";
const g = l.dirname(_(import.meta.url));
process.env.APP_ROOT = l.join(g, "..");
const y = process.env.VITE_DEV_SERVER_URL, S = l.join(process.env.APP_ROOT, "dist-electron"), x = l.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = y ? l.join(process.env.APP_ROOT, "public") : x;
let u, t = null;
function v() {
  u = new m({
    width: 1100,
    height: 780,
    icon: l.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: l.join(g, "preload.mjs")
    }
  }), y ? u.loadURL(y) : u.loadFile(l.join(x, "index.html"));
}
function L(o) {
  t = new m({
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
  }), t.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><style>
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
d.handle("scanner:select-roi", async () => {
  t && (t.close(), t = null);
  const o = b.getAllDisplays(), s = o.reduce(
    (n, e) => ({
      x: Math.min(n.x, e.bounds.x),
      y: Math.min(n.y, e.bounds.y),
      width: Math.max(n.x + n.width, e.bounds.x + e.bounds.width) - Math.min(n.x, e.bounds.x),
      height: Math.max(n.y + n.height, e.bounds.y + e.bounds.height) - Math.min(n.y, e.bounds.y)
    }),
    o[0].bounds
  );
  return new Promise((n) => {
    let e = !1, i = !1;
    const r = (a) => {
      e || (e = !0, n(a));
    };
    L(s);
    const c = () => {
      d.removeAllListeners("overlay:selected"), d.removeAllListeners("overlay:cancelled");
    };
    d.once("overlay:selected", (a, h) => {
      if (c(), !t) return r(null);
      i = !0;
      const f = t.getBounds(), R = h.width < 8 || h.height < 8 ? null : { x: f.x + h.x, y: f.y + h.y, width: h.width, height: h.height }, w = t;
      w.once("closed", () => r(R)), w.close(), t = null;
    }), d.once("overlay:cancelled", () => {
      c();
      const a = t;
      if (!a) return r(null);
      i = !0, a.once("closed", () => r(null)), a.close(), t = null;
    }), t == null || t.once("closed", () => {
      c(), t = null, i || r(null);
    });
  });
});
d.handle("scanner:capture-fullscreen", async (o, s) => {
  const n = { x: s.x + s.width / 2, y: s.y + s.height / 2 }, e = b.getDisplayNearestPoint(n), i = e.scaleFactor || 1, r = await E.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(e.bounds.width * i),
      height: Math.floor(e.bounds.height * i)
    },
    fetchWindowIcons: !1
  }), c = r.find((a) => a.display_id === String(e.id)) || r[0];
  if (!c) throw new Error("No screen source available");
  return {
    imageDataUrl: c.thumbnail.toDataURL(),
    displayBounds: e.bounds,
    scaleFactor: i
  };
});
d.handle("scanner:save-image", async (o, s) => {
  const { canceled: n, filePath: e } = await P.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (n || !e) return { canceled: !0 };
  const i = s.replace(/^data:image\/png;base64,/, "");
  return await I.writeFile(e, Buffer.from(i, "base64")), { canceled: !1, filePath: e };
});
p.on("window-all-closed", () => {
  process.platform !== "darwin" && (p.quit(), u = null);
});
p.on("activate", () => {
  m.getAllWindows().length === 0 && v();
});
p.whenReady().then(v);
export {
  S as MAIN_DIST,
  x as RENDERER_DIST,
  y as VITE_DEV_SERVER_URL
};
