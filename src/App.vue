<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'

type ScannerState = 'Idle' | 'Selecting region' | 'Scanning once' | 'Continuous scanning' | 'Stopped'

const state = ref<ScannerState>('Idle')
const lastQr = ref('—')
const apiResponse = ref('—')
const previewImage = ref<string>('')
const errorMessage = ref('')

const fps = 5
const duplicateCooldownMs = 4000
let loopTimer: number | null = null
let activeRoi: { x: number; y: number; width: number; height: number } | null = null
let lastSentQr = ''
let lastSentAt = 0

const detector = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null

async function decodeQrFromDataUrl(dataUrl: string): Promise<string | null> {
  if (!detector) return null
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const hits = await detector.detect(image)
  return hits[0]?.rawValue ?? null
}

async function captureRoiImage(roi: { x: number; y: number; width: number; height: number }) {
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

async function sendToApi(qr: string) {
  try {
    const res = await fetch('http://localhost:3000/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr }),
    })
    const text = await res.text()
    apiResponse.value = `HTTP ${res.status}: ${text || 'OK'}`
  } catch (e) {
    apiResponse.value = `API Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

async function processFrame(roi: { x: number; y: number; width: number; height: number }) {
  const roiImage = await captureRoiImage(roi)
  previewImage.value = roiImage
  const qr = await decodeQrFromDataUrl(roiImage)
  if (!qr) return
  lastQr.value = qr

  const now = Date.now()
  if (qr === lastSentQr && now - lastSentAt < duplicateCooldownMs) return
  lastSentQr = qr
  lastSentAt = now
  await sendToApi(qr)
}

async function scanOnce() {
  stopScan()
  errorMessage.value = ''
  state.value = 'Selecting region'
  const roi = await window.scannerApi.selectRoi()
  if (!roi) {
    state.value = 'Idle'
    return
  }
  state.value = 'Scanning once'
  try {
    await processFrame(roi)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
  state.value = 'Idle'
}

async function startContinuousScan() {
  stopScan()
  errorMessage.value = ''
  state.value = 'Selecting region'
  const roi = await window.scannerApi.selectRoi()
  if (!roi) {
    state.value = 'Idle'
    return
  }

  activeRoi = roi
  state.value = 'Continuous scanning'

  const tick = async () => {
    if (state.value !== 'Continuous scanning' || !activeRoi) return
    try {
      await processFrame(activeRoi)
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : String(e)
    }
    loopTimer = window.setTimeout(tick, 1000 / fps)
  }
  void tick()
}

function stopScan() {
  if (loopTimer) {
    window.clearTimeout(loopTimer)
    loopTimer = null
  }
  activeRoi = null
  if (state.value === 'Continuous scanning' || state.value === 'Scanning once') state.value = 'Stopped'
}

async function saveImage() {
  if (!previewImage.value) return
  const result = await window.scannerApi.saveImage(previewImage.value)
  apiResponse.value = result.canceled ? 'Save canceled' : `Saved: ${result.filePath}`
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') stopScan()
}
window.addEventListener('keydown', onEsc)
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc))
</script>

<template>
  <main class="app">
    <h1>Windows Screen QR Scanner</h1>
    <div class="controls">
      <button @click="scanOnce">Scan Once</button>
      <button @click="startContinuousScan">Start Continuous Scan</button>
      <button class="danger" @click="stopScan">Stop Scan</button>
      <button :disabled="!previewImage" @click="saveImage">Save Image</button>
    </div>

    <section class="status">
      <p><strong>State:</strong> {{ state }}</p>
      <p><strong>Last QR:</strong> {{ lastQr }}</p>
      <p><strong>API Response:</strong> {{ apiResponse }}</p>
      <p v-if="!detector" class="warn">BarcodeDetector unavailable in this runtime.</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </section>

    <section class="preview">
      <h2>Captured Region Preview</h2>
      <div class="preview-box">
        <img v-if="previewImage" :src="previewImage" alt="Last captured region" />
        <span v-else>No capture yet.</span>
      </div>
    </section>
  </main>
</template>
