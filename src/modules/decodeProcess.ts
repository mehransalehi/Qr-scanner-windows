const detector = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null

export function isDecoderAvailable() {
  return Boolean(detector)
}

export async function decodeQrFromDataUrl(dataUrl: string): Promise<string | null> {
  if (!detector) return null
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const hits = await detector.detect(image)
  return hits[0]?.rawValue ?? null
}
