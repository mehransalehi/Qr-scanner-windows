import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron'

type Roi = { x: number; y: number; width: number; height: number }
type Cleanup = () => void

contextBridge.exposeInMainWorld('scannerApi', {
  startContinuousOverlay: (rect?: Roi) => ipcRenderer.invoke('scanner:start-continuous-overlay', rect) as Promise<Roi>,
  stopContinuousOverlay: () => ipcRenderer.invoke('scanner:stop-continuous-overlay') as Promise<void>,
  updateScanArea: (rect: Roi) => ipcRenderer.invoke('scanner:update-scan-area', rect) as Promise<Roi>,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
  onContinuousRoiChanged: (callback: (roi: Roi) => void): Cleanup => {
    const listener = (_event: IpcRendererEvent, roi: Roi) => callback(roi)
    ipcRenderer.on('scanner:continuous-roi-changed', listener)
    return () => ipcRenderer.removeListener('scanner:continuous-roi-changed', listener)
  },
  captureFullscreen: (roi: Roi) =>
    ipcRenderer.invoke('scanner:capture-fullscreen', roi) as Promise<{
      imageDataUrl: string
      displayBounds: { x: number; y: number; width: number; height: number }
      scaleFactor: number
    }>,
})
