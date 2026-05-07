"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("scannerApi", {
  selectRoi: () => electron.ipcRenderer.invoke("scanner:select-roi"),
  startContinuousOverlay: () => electron.ipcRenderer.invoke("scanner:start-continuous-overlay"),
  stopContinuousOverlay: () => electron.ipcRenderer.invoke("scanner:stop-continuous-overlay"),
  updateContinuousOverlayLastQr: (qr) => electron.ipcRenderer.invoke("scanner:update-last-qr", qr),
  onContinuousRoiChanged: (callback) => {
    const listener = (_event, roi) => callback(roi);
    electron.ipcRenderer.on("scanner:continuous-roi-changed", listener);
    return () => electron.ipcRenderer.removeListener("scanner:continuous-roi-changed", listener);
  },
  onContinuousOverlayClosed: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("scanner:continuous-overlay-closed", listener);
    return () => electron.ipcRenderer.removeListener("scanner:continuous-overlay-closed", listener);
  },
  captureFullscreen: (roi) => electron.ipcRenderer.invoke("scanner:capture-fullscreen", roi),
  saveImage: (dataUrl) => electron.ipcRenderer.invoke("scanner:save-image", dataUrl)
});
