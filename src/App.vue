<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import ScannerControls from './components/ScannerControls.vue'
import ScannerStatus from './components/ScannerStatus.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import {
  captureRoiImage,
  onContinuousOverlayClosed,
  onContinuousRoiChanged,
  saveImage,
  selectRoi,
  startContinuousOverlay,
  stopContinuousOverlay,
  updateContinuousOverlayLastQr,
  withPadding,
  type Roi,
} from './modules/screenCapture'
import { decodeQrFromDataUrl, isDecoderAvailable } from './modules/decodeProcess'
import { postQr } from './modules/apiProcess'

type ScannerState = 'Idle' | 'Selecting region' | 'Scanning once' | 'Continuous scanning' | 'Stopped'

const state = ref<ScannerState>('Idle')
const lastQr = ref('—')
const apiResponse = ref('—')
const previewImage = ref('')
const errorMessage = ref('')

const scanDelayMs = 200 // SCAN_DELAY: change this value to adjust the delay between continuous scan attempts.
const duplicateCooldownMs = 4000
let loopTimer: number | null = null
let activeRoi: Roi | null = null
let lastSentQr = ''
let lastSentAt = 0
let removeContinuousRoiListener: (() => void) | null = null
let removeContinuousClosedListener: (() => void) | null = null

const decoderAvailable = isDecoderAvailable()

async function processFrame(roi: Roi) {
  const roiImage = await captureRoiImage(roi)
  previewImage.value = roiImage
  const qr = await decodeQrFromDataUrl(roiImage)
  if (!qr) return
  lastQr.value = qr
  await updateContinuousOverlayLastQr(qr)

  const now = Date.now()
  if (qr === lastSentQr && now - lastSentAt < duplicateCooldownMs) return
  lastSentQr = qr
  lastSentAt = now
  apiResponse.value = await postQr(qr,previewImage.value)
}

async function scanOnce() {
  stopScan()
  errorMessage.value = ''
  state.value = 'Selecting region'
  const roi = await selectRoi()
  if (!roi) return (state.value = 'Idle')

  state.value = 'Scanning once'
  try {
    await processFrame(withPadding(roi))
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
  state.value = 'Idle'
}

async function startContinuousScan() {
  stopScan()
  errorMessage.value = ''

  try {
    activeRoi = await startContinuousOverlay()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
    state.value = 'Idle'
    return
  }

  removeContinuousRoiListener = onContinuousRoiChanged((roi) => {
    activeRoi = roi
  })
  removeContinuousClosedListener = onContinuousOverlayClosed(() => {
    stopScan(false)
  })

  if (lastQr.value !== '—') await updateContinuousOverlayLastQr(lastQr.value)
  state.value = 'Continuous scanning'

  const tick = async () => {
    if (state.value !== 'Continuous scanning' || !activeRoi) return
    try {
      await processFrame(activeRoi)
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : String(e)
    }
    loopTimer = window.setTimeout(tick, scanDelayMs)
  }

  void tick()
}

function stopScan(closeOverlay = true) {
  if (loopTimer) window.clearTimeout(loopTimer)
  loopTimer = null
  activeRoi = null
  removeContinuousRoiListener?.()
  removeContinuousClosedListener?.()
  removeContinuousRoiListener = null
  removeContinuousClosedListener = null
  if (closeOverlay) void stopContinuousOverlay()
  if (state.value === 'Continuous scanning' || state.value === 'Scanning once') state.value = 'Stopped'
}

async function onSave() {
  if (!previewImage.value) return
  const result = await saveImage(previewImage.value)
  apiResponse.value = result.canceled ? 'Save canceled' : `Saved: ${result.filePath}`
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') stopScan()
}
window.addEventListener('keydown', onEsc)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEsc)
  stopScan()
})
</script>

<template>
  <main class="app">
    <h1>Windows Screen QR Scanner</h1>
    <ScannerControls :can-save="!!previewImage" @scan-once="scanOnce" @start="startContinuousScan" @stop="stopScan" @save="onSave" />
    <ScannerStatus :state="state" :last-qr="lastQr" :api-response="apiResponse" :error-message="errorMessage" :decoder-available="decoderAvailable" />
    <PreviewPanel :preview-image="previewImage" />
  </main>
</template>
