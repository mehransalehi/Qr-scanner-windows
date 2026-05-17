/// <reference types="vite/client" />

type Roi = { x: number; y: number; width: number; height: number }
type ScannerApiCleanup = () => void

declare global {
  interface Window {
    scannerApi: {
      startContinuousOverlay: (rect?: Roi) => Promise<Roi>
      stopContinuousOverlay: () => Promise<void>
      updateScanArea: (rect: Roi) => Promise<Roi>
      minimizeWindow: () => Promise<void>
      closeWindow: () => Promise<void>
      onContinuousRoiChanged: (callback: (roi: Roi) => void) => ScannerApiCleanup
      captureFullscreen: (roi: Roi) => Promise<{
        imageDataUrl: string
        displayBounds: { x: number; y: number; width: number; height: number }
        scaleFactor: number
      }>
    }
  }

  class BarcodeDetector {
    constructor(options?: { formats?: string[] })
    detect(image: CanvasImageSource): Promise<Array<{ rawValue?: string }>>
  }
}

export {}
