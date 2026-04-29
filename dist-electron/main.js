import { ipcMain as d, screen as w, desktopCapturer as R, dialog as E, app as u, BrowserWindow as m } from "electron";
import { fileURLToPath as P } from "node:url";
import l from "node:path";
import _ from "node:fs/promises";
const b = l.dirname(P(import.meta.url));
process.env.APP_ROOT = l.join(b, "..");
const p = process.env.VITE_DEV_SERVER_URL, T = l.join(process.env.APP_ROOT, "dist-electron"), g = l.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = p ? l.join(process.env.APP_ROOT, "public") : g;
let h, t = null;
function x() {
  h = new m({
    width: 1100,
    height: 780,
    icon: l.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: l.join(b, "preload.mjs")
    }
  }), p ? h.loadURL(p) : h.loadFile(l.join(g, "index.html"));
}
function I(s) {
  t = new m({
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
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
  const s = w.getAllDisplays(), i = s.reduce(
    (n, e) => ({
      x: Math.min(n.x, e.bounds.x),
      y: Math.min(n.y, e.bounds.y),
      width: Math.max(n.x + n.width, e.bounds.x + e.bounds.width) - Math.min(n.x, e.bounds.x),
      height: Math.max(n.y + n.height, e.bounds.y + e.bounds.height) - Math.min(n.y, e.bounds.y)
    }),
    s[0].bounds
  );
  return new Promise((n) => {
    let e = !1;
    const o = (r) => {
      e || (e = !0, n(r));
    };
    I(i);
    const c = () => {
      d.removeAllListeners("overlay:selected"), d.removeAllListeners("overlay:cancelled");
    };
    d.once("overlay:selected", (r, a) => {
      if (c(), !t) return o(null);
      const y = t.getBounds(), v = a.width < 8 || a.height < 8 ? null : { x: y.x + a.x, y: y.y + a.y, width: a.width, height: a.height }, f = t;
      f.once("closed", () => o(v)), f.close(), t = null;
    }), d.once("overlay:cancelled", () => {
      c();
      const r = t;
      if (!r) return o(null);
      r.once("closed", () => o(null)), r.close(), t = null;
    }), t == null || t.once("closed", () => {
      c(), t = null, o(null);
    });
  });
});
d.handle("scanner:capture-fullscreen", async (s, i) => {
  const n = { x: i.x + i.width / 2, y: i.y + i.height / 2 }, e = w.getDisplayNearestPoint(n), o = e.scaleFactor || 1, c = await R.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(e.bounds.width * o),
      height: Math.floor(e.bounds.height * o)
    },
    fetchWindowIcons: !1
  }), r = c.find((a) => a.display_id === String(e.id)) || c[0];
  if (!r) throw new Error("No screen source available");
  return {
    imageDataUrl: r.thumbnail.toDataURL(),
    displayBounds: e.bounds,
    scaleFactor: o
  };
});
d.handle("scanner:save-image", async (s, i) => {
  const { canceled: n, filePath: e } = await E.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (n || !e) return { canceled: !0 };
  const o = i.replace(/^data:image\/png;base64,/, "");
  return await _.writeFile(e, Buffer.from(o, "base64")), { canceled: !1, filePath: e };
});
u.on("window-all-closed", () => {
  process.platform !== "darwin" && (u.quit(), h = null);
});
u.on("activate", () => {
  m.getAllWindows().length === 0 && x();
});
u.whenReady().then(x);
export {
  T as MAIN_DIST,
  g as RENDERER_DIST,
  p as VITE_DEV_SERVER_URL
};
