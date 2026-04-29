let barcodeDetector: BarcodeDetector | null = null
if ('BarcodeDetector' in window) {
  barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] })
}

type ZxingBrowserReader = {
  decodeFromImageUrl(url?: string): Promise<{ getText(): string }>
}

let zxingReaderPromise: Promise<ZxingBrowserReader | null> | null = null

async function getZxingReader(): Promise<ZxingBrowserReader | null> {
  if (zxingReaderPromise) return zxingReaderPromise

  const moduleName = '@zxing/browser'
  zxingReaderPromise = import(/* @vite-ignore */ moduleName)
    .then((mod) => {
      const ReaderCtor = mod.BrowserQRCodeReader ?? mod.BrowserMultiFormatReader
      return ReaderCtor ? new ReaderCtor() : null
    })
    .catch(() => null)

  return zxingReaderPromise
}

export function isDecoderAvailable() {
  return Boolean(barcodeDetector)
}

export async function decodeQrFromDataUrl(dataUrl: string): Promise<string | null> {
  if (barcodeDetector) {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const hits = await barcodeDetector.detect(image)
    return hits[0]?.rawValue ?? null
  }

  const zxingReader = await getZxingReader()
  if (!zxingReader) return null

  try {
    const result = await zxingReader.decodeFromImageUrl(dataUrl)
    return result.getText()
  } catch {
    return null
  }
}
