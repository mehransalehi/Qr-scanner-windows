import { ipcRenderer, contextBridge } from 'electron'

type Roi = { x: number; y: number; width: number; height: number }

contextBridge.exposeInMainWorld('scannerApi', {
  selectRoi: () => ipcRenderer.invoke('scanner:select-roi') as Promise<Roi | null>,
  captureFullscreen: (roi: Roi) =>
    ipcRenderer.invoke('scanner:capture-fullscreen', roi) as Promise<{
      imageDataUrl: string
      displayBounds: { x: number; y: number; width: number; height: number }
      scaleFactor: number
    }>,
  saveImage: (dataUrl: string) => ipcRenderer.invoke('scanner:save-image', dataUrl),
})
