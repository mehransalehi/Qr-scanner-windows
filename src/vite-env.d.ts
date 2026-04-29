/// <reference types="vite/client" />

type Roi = { x: number; y: number; width: number; height: number }

declare global {
  interface Window {
    scannerApi: {
      selectRoi: () => Promise<Roi | null>
      captureFullscreen: (roi: Roi) => Promise<{
        imageDataUrl: string
        displayBounds: { x: number; y: number; width: number; height: number }
        scaleFactor: number
      }>
      saveImage: (dataUrl: string) => Promise<{ canceled: boolean; filePath?: string }>
    }
  }

  class BarcodeDetector {
    constructor(options?: { formats?: string[] })
    detect(image: CanvasImageSource): Promise<Array<{ rawValue?: string }>>
  }
}

export {}
