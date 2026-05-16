export type Roi = { x: number; y: number; width: number; height: number }

const ROI_PADDING = 8

export async function startContinuousOverlay(): Promise<Roi> {
  return window.scannerApi.startContinuousOverlay()
}

export async function stopContinuousOverlay(): Promise<void> {
  return window.scannerApi.stopContinuousOverlay()
}

export function onContinuousRoiChanged(callback: (roi: Roi) => void) {
  return window.scannerApi.onContinuousRoiChanged(callback)
}

export function withPadding(roi: Roi): Roi {
  return {
    x: roi.x - ROI_PADDING,
    y: roi.y - ROI_PADDING,
    width: roi.width + ROI_PADDING * 2,
    height: roi.height + ROI_PADDING * 2,
  }
}

export async function captureRoiImage(roi: Roi): Promise<string> {
  const capture = await window.scannerApi.captureFullscreen(roi)
  const img = new Image()
  img.src = capture.imageDataUrl
  await img.decode()

  const sx = (roi.x - capture.displayBounds.x) * capture.scaleFactor
  const sy = (roi.y - capture.displayBounds.y) * capture.scaleFactor
  const sw = roi.width * capture.scaleFactor
  const sh = roi.height * capture.scaleFactor

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(sw))
  canvas.height = Math.max(1, Math.floor(sh))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
