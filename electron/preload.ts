import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron'

type Roi = { x: number; y: number; width: number; height: number }
type Cleanup = () => void

contextBridge.exposeInMainWorld('scannerApi', {
  selectRoi: () => ipcRenderer.invoke('scanner:select-roi') as Promise<Roi | null>,
  startContinuousOverlay: () => ipcRenderer.invoke('scanner:start-continuous-overlay') as Promise<Roi>,
  stopContinuousOverlay: () => ipcRenderer.invoke('scanner:stop-continuous-overlay') as Promise<void>,
  updateContinuousOverlayLastQr: (qr: string) => ipcRenderer.invoke('scanner:update-last-qr', qr) as Promise<void>,
  onContinuousRoiChanged: (callback: (roi: Roi) => void): Cleanup => {
    const listener = (_event: IpcRendererEvent, roi: Roi) => callback(roi)
    ipcRenderer.on('scanner:continuous-roi-changed', listener)
    return () => ipcRenderer.removeListener('scanner:continuous-roi-changed', listener)
  },
  onContinuousOverlayClosed: (callback: () => void): Cleanup => {
    const listener = () => callback()
    ipcRenderer.on('scanner:continuous-overlay-closed', listener)
    return () => ipcRenderer.removeListener('scanner:continuous-overlay-closed', listener)
  },
  captureFullscreen: (roi: Roi) =>
    ipcRenderer.invoke('scanner:capture-fullscreen', roi) as Promise<{
      imageDataUrl: string
      displayBounds: { x: number; y: number; width: number; height: number }
      scaleFactor: number
    }>,
  saveImage: (dataUrl: string) => ipcRenderer.invoke('scanner:save-image', dataUrl),
})
