import { ipcMain as r, screen as x, desktopCapturer as R, dialog as E, app as l, BrowserWindow as m } from "electron";
import { fileURLToPath as P } from "node:url";
import h from "node:path";
import _ from "node:fs/promises";
const M = h.dirname(P(import.meta.url)), y = process.env.VITE_DEV_SERVER_URL;
let p = null, t = null;
const w = 80;
function g(o) {
  return new Promise((a) => setTimeout(a, o));
}
function I() {
  return l.isPackaged ? h.join(l.getAppPath(), "dist", "index.html") : h.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function b() {
  p = new m({
    width: 1100,
    height: 780,
    icon: h.join(l.getAppPath(), "dist", "electron-vite.svg"),
    webPreferences: {
      preload: h.join(M, "preload.mjs"),
      contextIsolation: !0
    }
  }), y ? p.loadURL(y) : p.loadFile(I());
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

    const norm=(a,b)=>({
      x:Math.min(a.x,b.x),
      y:Math.min(a.y,b.y),
      width:Math.abs(a.x-b.x),
      height:Math.abs(a.y-b.y)
    });

    window.addEventListener('mousedown',e=>{
      start={x:e.clientX,y:e.clientY};
      box.style.display='block';
    });

    window.addEventListener('mousemove',e=>{
      if(!start)return;
      const r=norm(start,{x:e.clientX,y:e.clientY});
      Object.assign(box.style,{
        left:r.x+'px',
        top:r.y+'px',
        width:r.width+'px',
        height:r.height+'px'
      });
    });

    window.addEventListener('mouseup',e=>{
      if(!start)return;
      const r=norm(start,{x:e.clientX,y:e.clientY});
      ipcRenderer.send('overlay:selected',r);
    });

    window.addEventListener('keydown',e=>{
      if(e.key==='Escape') ipcRenderer.send('overlay:cancelled');
    });
  <\/script></body></html>`)}`);
}
r.handle("scanner:select-roi", async () => {
  t && (t.close(), t = null);
  const o = x.getAllDisplays(), a = o.reduce(
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
    const s = (u) => {
      e || (e = !0, n(u));
    };
    L(a);
    const d = () => {
      r.removeAllListeners("overlay:selected"), r.removeAllListeners("overlay:cancelled");
    };
    r.once("overlay:selected", (u, c) => {
      if (d(), !t) return s(null);
      i = !0;
      const f = t.getBounds(), v = c.width < 8 || c.height < 8 ? null : {
        x: f.x + c.x,
        y: f.y + c.y,
        width: c.width,
        height: c.height
      };
      t.once("closed", async () => {
        await g(w), s(v);
      }), t.close(), t = null;
    }), r.once("overlay:cancelled", () => {
      if (d(), !t) return s(null);
      i = !0, t.once("closed", async () => {
        await g(w), s(null);
      }), t.close(), t = null;
    }), t == null || t.once("closed", () => {
      d(), t = null, i || s(null);
    });
  });
});
r.handle("scanner:capture-fullscreen", async (o, a) => {
  const n = { x: a.x + a.width / 2, y: a.y + a.height / 2 }, e = x.getDisplayNearestPoint(n), i = e.scaleFactor || 1, s = await R.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(e.bounds.width * i),
      height: Math.floor(e.bounds.height * i)
    },
    fetchWindowIcons: !1
  }), d = s.find((u) => u.display_id === String(e.id)) || s[0];
  if (!d) throw new Error("No screen source available");
  return {
    imageDataUrl: d.thumbnail.toDataURL(),
    displayBounds: e.bounds,
    scaleFactor: i
  };
});
r.handle("scanner:save-image", async (o, a) => {
  const { canceled: n, filePath: e } = await E.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (n || !e) return { canceled: !0 };
  const i = a.replace(/^data:image\/png;base64,/, "");
  return await _.writeFile(e, Buffer.from(i, "base64")), { canceled: !1, filePath: e };
});
l.on("window-all-closed", () => {
  process.platform !== "darwin" && (l.quit(), p = null);
});
l.on("activate", () => {
  m.getAllWindows().length === 0 && b();
});
l.whenReady().then(b);
export {
  y as VITE_DEV_SERVER_URL
};
