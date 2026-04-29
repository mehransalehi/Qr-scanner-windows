"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("scannerApi", {
  selectRoi: () => electron.ipcRenderer.invoke("scanner:select-roi"),
  captureFullscreen: (roi) => electron.ipcRenderer.invoke("scanner:capture-fullscreen", roi),
  saveImage: (dataUrl) => electron.ipcRenderer.invoke("scanner:save-image", dataUrl)
});
