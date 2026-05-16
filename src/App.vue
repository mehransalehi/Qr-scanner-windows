<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ScannerControls from './components/ScannerControls.vue'
import {
  captureRoiImage,
  onContinuousRoiChanged,
  startContinuousOverlay,
  stopContinuousOverlay,
  type Roi,
} from './modules/screenCapture'
import { decodeQrFromDataUrl, isDecoderAvailable } from './modules/decodeProcess'
import { checkServer, postQr, parseServerUrl } from './modules/apiProcess'

const errorMessage = ref('')
const serverUrl = ref(localStorage.getItem('qr-scanner-server-url') || '')
const tooltipMessage = ref('')
const tooltipType = ref<'success' | 'error'>('success')
let tooltipTimer: number | null = null

const scanDelayMs = 200 // SCAN_DELAY: change this value to adjust the delay between continuous scan attempts.
const duplicateCooldownMs = 4000
let loopTimer: number | null = null
let activeRoi: Roi | null = null
let isScanning = false
let lastSentQr = ''
let lastSentAt = 0
let removeContinuousRoiListener: (() => void) | null = null

function showTooltip(message: string, type: 'success' | 'error' = 'success') {
  tooltipMessage.value = message
  tooltipType.value = type
  if (tooltipTimer) window.clearTimeout(tooltipTimer)
  tooltipTimer = window.setTimeout(() => {
    tooltipMessage.value = ''
    tooltipTimer = null
  }, 3000)
}

function validateServerUrl() {
  try {
    parseServerUrl(serverUrl.value)
    return true
  } catch {
    showTooltip('Server must enter.', 'error')
    return false
  }
}

function saveServerUrl() {
  localStorage.setItem('qr-scanner-server-url', serverUrl.value)
}

function onServerUrlUpdate(value: string) {
  serverUrl.value = value
  saveServerUrl()
}

const decoderAvailable = isDecoderAvailable()

watch(serverUrl, saveServerUrl, { flush: 'sync' })

async function ensureOverlay() {
  if (removeContinuousRoiListener) return

  try {
    activeRoi = await startContinuousOverlay()
    removeContinuousRoiListener = onContinuousRoiChanged((roi) => {
      activeRoi = roi
    })
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
    showTooltip(errorMessage.value, 'error')
  }
}

async function processFrame(roi: Roi) {
  const roiImage = await captureRoiImage(roi)
  const qr = await decodeQrFromDataUrl(roiImage)
  if (!qr) return

  const now = Date.now()
  if (qr === lastSentQr && now - lastSentAt < duplicateCooldownMs) return
  lastSentQr = qr
  lastSentAt = now
  await postQr(qr, roiImage, serverUrl.value)
}

async function startScan() {
  stopScan(false)
  errorMessage.value = ''
  if (!decoderAvailable) {
    showTooltip('QR decoder is not available in this browser.', 'error')
    return
  }
  if (!validateServerUrl()) return

  const result = await checkServer(serverUrl.value)
  showTooltip(result.message, result.ok ? 'success' : 'error')
  if (!result.ok) return

  await ensureOverlay()
  if (!activeRoi) {
    showTooltip('Scan area is not available.', 'error')
    return
  }

  isScanning = true

  const tick = async () => {
    if (!isScanning || !activeRoi) return
    try {
      await processFrame(activeRoi)
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : String(e)
      showTooltip(errorMessage.value, 'error')
    }
    loopTimer = window.setTimeout(tick, scanDelayMs)
  }

  void tick()
}

function stopScan(closeOverlay = false) {
  if (loopTimer) window.clearTimeout(loopTimer)
  loopTimer = null
  isScanning = false
  if (closeOverlay) {
    activeRoi = null
    removeContinuousRoiListener?.()
    removeContinuousRoiListener = null
    void stopContinuousOverlay()
  }
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') stopScan()
}

window.addEventListener('keydown', onEsc)
window.addEventListener('beforeunload', saveServerUrl)

onMounted(() => {
  void ensureOverlay()
})

onBeforeUnmount(() => {
  saveServerUrl()
  window.removeEventListener('keydown', onEsc)
  window.removeEventListener('beforeunload', saveServerUrl)
  stopScan(true)
  if (tooltipTimer) window.clearTimeout(tooltipTimer)
})
</script>

<template>
  <main class="app">
    <h1>QR Scanner</h1>
    <ScannerControls
      :server-url="serverUrl"
      :tooltip-message="tooltipMessage"
      :tooltip-type="tooltipType"
      @update:server-url="onServerUrlUpdate"
      @start="startScan"
      @stop="stopScan"
    />
  </main>
</template>
