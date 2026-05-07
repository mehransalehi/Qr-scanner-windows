import { ipcMain as s, screen as b, desktopCapturer as M, dialog as R, app as l, BrowserWindow as p } from "electron";
import { fileURLToPath as L } from "node:url";
import g from "node:path";
import S from "node:fs/promises";
const _ = g.dirname(L(import.meta.url)), m = process.env.VITE_DEV_SERVER_URL;
let i = null, t = null;
const f = 80, B = 240, h = 36, D = 96;
function w(n) {
  return new Promise((e) => setTimeout(e, n));
}
function P() {
  return l.isPackaged ? g.join(l.getAppPath(), "dist", "index.html") : g.join(process.env.APP_ROOT ?? "", "dist", "index.html");
}
function v() {
  i = new p({
    width: 1100,
    height: 780,
    icon: g.join(l.getAppPath(), "dist", "electron-vite.svg"),
    webPreferences: {
      preload: g.join(_, "preload.mjs"),
      contextIsolation: !0
    }
  }), m ? i.loadURL(m) : i.loadFile(P());
}
function E() {
  const n = b.getAllDisplays();
  return n.reduce(
    (e, o) => ({
      x: Math.min(e.x, o.bounds.x),
      y: Math.min(e.y, o.bounds.y),
      width: Math.max(e.x + e.width, o.bounds.x + o.bounds.width) - Math.min(e.x, o.bounds.x),
      height: Math.max(e.y + e.height, o.bounds.y + o.bounds.height) - Math.min(e.y, o.bounds.y)
    }),
    n[0].bounds
  );
}
function k(n) {
  t = new p({
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
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
  });
  const e = `<!doctype html><html><head><style>
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
  <\/script></body></html>`;
  t.setContentProtection(!0), t.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(e)}`);
}
s.handle("scanner:select-roi", async () => {
  t && (t.close(), t = null);
  const n = E();
  return new Promise((e) => {
    let o = !1, r = !1;
    const a = (u) => {
      o || (o = !0, e(u));
    };
    k(n);
    const c = () => {
      s.removeAllListeners("overlay:selected"), s.removeAllListeners("overlay:cancelled");
    };
    s.once("overlay:selected", (u, d) => {
      if (c(), !t) return a(null);
      r = !0;
      const x = t.getBounds(), I = d.width < 8 || d.height < 8 ? null : {
        x: x.x + d.x,
        y: x.y + d.y,
        width: d.width,
        height: d.height
      };
      t.once("closed", async () => {
        await w(f), a(I);
      }), t.close(), t = null;
    }), s.once("overlay:cancelled", () => {
      if (c(), !t) return a(null);
      r = !0, t.once("closed", async () => {
        await w(f), a(null);
      }), t.close(), t = null;
    }), t == null || t.once("closed", () => {
      c(), t = null, r || a(null);
    });
  });
});
function O(n, e) {
  t = new p({
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
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
  });
  const o = {
    x: e.x - n.x,
    y: e.y - n.y,
    width: e.width,
    height: e.height
  }, r = `<!doctype html><html><head><style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:Segoe UI,sans-serif;user-select:none}
    body{pointer-events:none}
    #scanner{position:absolute;pointer-events:auto;filter:drop-shadow(0 10px 24px rgba(0,0,0,.35))}
    #scanBox{position:absolute;left:0;top:0;border:2px solid #58a6ff;background:rgba(88,166,255,.5);cursor:move}
    #scanBox::after{content:'';position:absolute;inset:10px;border:1px dashed rgba(255,255,255,.75);border-radius:8px;pointer-events:none}
    #bar{position:absolute;left:0;height:${h}px;display:flex;align-items:center;gap:8px;padding:5px 7px;border:1px solid rgba(88,166,255,.75);border-top:0;border-radius:0 0 10px 10px;background:rgba(10,20,36,.92);color:white;font-size:12px;cursor:move}
    #status{font-weight:600;margin-right:auto;letter-spacing:.2px}
    button{border:1px solid rgba(255,255,255,.22);border-radius:6px;background:rgba(255,255,255,.12);color:white;padding:4px 8px;font:inherit;cursor:pointer}
    button:hover{background:rgba(255,255,255,.22)}
    #move{cursor:grab} #move:active{cursor:grabbing}
    .handle{position:absolute;width:14px;height:14px;background:#58a6ff;border:2px solid white;border-radius:50%;pointer-events:auto}
    .nw{left:-7px;top:-7px;cursor:nwse-resize}.ne{right:-7px;top:-7px;cursor:nesw-resize}.sw{left:-7px;bottom:${h - 7}px;cursor:nesw-resize}.se{right:-7px;bottom:${h - 7}px;cursor:nwse-resize}
  </style></head><body>
    <div id="scanner">
      <div id="scanBox"></div>
      <div id="bar"><span id="status">Scanning</span><button id="copy" type="button">Copy</button><button id="move" type="button" title="Drag to move">Move</button><button id="close" type="button">Close</button></div>
      <div class="handle nw" data-handle="nw"></div><div class="handle ne" data-handle="ne"></div><div class="handle sw" data-handle="sw"></div><div class="handle se" data-handle="se"></div>
    </div>
    <script>
      const { ipcRenderer, clipboard } = require('electron');
      const scanner = document.getElementById('scanner');
      const scanBox = document.getElementById('scanBox');
      const bar = document.getElementById('bar');
      const copy = document.getElementById('copy');
      const closeButton = document.getElementById('close');
      let rect = ${JSON.stringify(o)};
      let latestQr = '';
      let drag = null;
      let ignoringMouse = true;
      const minSize = ${D};
      const barHeight = ${h};
      const bounds = { width: window.innerWidth, height: window.innerHeight };

      function setMouseIgnored(ignore) {
        if (ignore === ignoringMouse) return;
        ignoringMouse = ignore;
        ipcRenderer.send('continuous-overlay:set-ignore-mouse-events', ignore);
      }

      function apply(send = true) {
        rect.width = Math.max(minSize, rect.width);
        rect.height = Math.max(minSize, rect.height);
        rect.x = Math.min(Math.max(0, rect.x), bounds.width - rect.width);
        rect.y = Math.min(Math.max(0, rect.y), bounds.height - rect.height - barHeight);
        scanner.style.left = rect.x + 'px';
        scanner.style.top = rect.y + 'px';
        scanner.style.width = rect.width + 'px';
        scanner.style.height = rect.height + barHeight + 'px';
        scanBox.style.width = rect.width + 'px';
        scanBox.style.height = rect.height + 'px';
        bar.style.top = rect.height + 'px';
        bar.style.width = rect.width + 'px';
        if (send) ipcRenderer.send('continuous-overlay:roi-changed', rect);
      }

      function beginDrag(e, mode) {
        e.preventDefault();
        e.stopPropagation();
        setMouseIgnored(false);
        drag = { mode, startX: e.clientX, startY: e.clientY, start: { ...rect } };
      }

      function updateDrag(e) {
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const start = drag.start;
        if (drag.mode === 'move') {
          rect.x = start.x + dx;
          rect.y = start.y + dy;
        } else {
          if (drag.mode.includes('e')) rect.width = start.width + dx;
          if (drag.mode.includes('s')) rect.height = start.height + dy;
          if (drag.mode.includes('w')) {
            const nextWidth = start.width - dx;
            if (nextWidth >= minSize) { rect.x = start.x + dx; rect.width = nextWidth; }
          }
          if (drag.mode.includes('n')) {
            const nextHeight = start.height - dy;
            if (nextHeight >= minSize) { rect.y = start.y + dy; rect.height = nextHeight; }
          }
        }
        apply();
      }

      scanner.addEventListener('mouseenter', () => setMouseIgnored(false));
      scanner.addEventListener('mouseleave', () => { if (!drag) setMouseIgnored(true); });
      scanBox.addEventListener('mousedown', e => beginDrag(e, 'move'));
      bar.addEventListener('mousedown', e => beginDrag(e, 'move'));
      document.getElementById('move').addEventListener('mousedown', e => beginDrag(e, 'move'));
      document.querySelectorAll('.handle').forEach(handle => {
        handle.addEventListener('mousedown', e => beginDrag(e, handle.dataset.handle));
      });
      window.addEventListener('mousemove', e => {
        if (!drag) setMouseIgnored(!e.target.closest?.('#scanner'));
        updateDrag(e);
      });
      window.addEventListener('mouseup', e => {
        drag = null;
        setMouseIgnored(!e.target.closest?.('#scanner'));
      });
      window.addEventListener('keydown', e => { if (e.key === 'Escape') ipcRenderer.send('continuous-overlay:closed'); });
      document.querySelectorAll('button').forEach(button => {
        button.addEventListener('mousedown', e => e.stopPropagation());
      });
      closeButton.addEventListener('click', () => ipcRenderer.send('continuous-overlay:closed'));
      copy.addEventListener('click', e => {
        e.stopPropagation();
        if (latestQr) clipboard.writeText(latestQr);
      });
      ipcRenderer.on('continuous-overlay:last-qr', (_event, qr) => { latestQr = qr || ''; });
      apply(false);
      ipcRenderer.send('continuous-overlay:roi-changed', rect);
    <\/script>
  </body></html>`;
  t.setContentProtection(!0), t.setIgnoreMouseEvents(!0, { forward: !0 }), t.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(r)}`);
}
function U(n) {
  const e = Math.min(B, n.width, n.height - h);
  return {
    x: n.x + Math.floor((n.width - e) / 2),
    y: n.y + Math.floor((n.height - e - h) / 2),
    width: e,
    height: e
  };
}
function y() {
  t && (t.close(), t = null);
}
s.handle("scanner:start-continuous-overlay", async () => {
  y();
  const n = E(), e = U(n);
  return O(n, e), e;
});
s.handle("scanner:stop-continuous-overlay", async () => {
  y();
});
s.handle("scanner:update-last-qr", async (n, e) => {
  t == null || t.webContents.send("continuous-overlay:last-qr", e);
});
s.on("continuous-overlay:roi-changed", (n, e) => {
  if (!t || !i) return;
  const o = t.getBounds(), r = {
    x: o.x + Math.round(e.x),
    y: o.y + Math.round(e.y),
    width: Math.round(e.width),
    height: Math.round(e.height)
  };
  i.webContents.send("scanner:continuous-roi-changed", r);
});
s.on("continuous-overlay:set-ignore-mouse-events", (n, e) => {
  t == null || t.setIgnoreMouseEvents(e, { forward: !0 });
});
s.on("continuous-overlay:closed", () => {
  i == null || i.webContents.send("scanner:continuous-overlay-closed"), y();
});
s.handle("scanner:capture-fullscreen", async (n, e) => {
  const o = { x: e.x + e.width / 2, y: e.y + e.height / 2 }, r = b.getDisplayNearestPoint(o), a = r.scaleFactor || 1, c = await M.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.floor(r.bounds.width * a),
      height: Math.floor(r.bounds.height * a)
    },
    fetchWindowIcons: !1
  }), u = c.find((d) => d.display_id === String(r.id)) || c[0];
  if (!u) throw new Error("No screen source available");
  return {
    imageDataUrl: u.thumbnail.toDataURL(),
    displayBounds: r.bounds,
    scaleFactor: a
  };
});
s.handle("scanner:save-image", async (n, e) => {
  const { canceled: o, filePath: r } = await R.showSaveDialog({
    title: "Save Captured Image",
    defaultPath: `qr-capture-${Date.now()}.png`,
    filters: [{ name: "PNG Image", extensions: ["png"] }]
  });
  if (o || !r) return { canceled: !0 };
  const a = e.replace(/^data:image\/png;base64,/, "");
  return await S.writeFile(r, Buffer.from(a, "base64")), { canceled: !1, filePath: r };
});
l.on("window-all-closed", () => {
  process.platform !== "darwin" && (l.quit(), i = null);
});
l.on("activate", () => {
  p.getAllWindows().length === 0 && v();
});
l.whenReady().then(v);
export {
  m as VITE_DEV_SERVER_URL
};
