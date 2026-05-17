<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ScannerControls from './components/ScannerControls.vue'
import {
  captureRoiImage,
  onContinuousRoiChanged,
  startContinuousOverlay,
  stopContinuousOverlay,
  updateScanArea,
  type Roi,
} from './modules/screenCapture'
import { decodeQrFromDataUrl, isDecoderAvailable } from './modules/decodeProcess'
import { checkServer, postQr, parseServerUrl } from './modules/apiProcess'

const errorMessage = ref('')
const serverUrl = ref(localStorage.getItem('qr-scanner-server-url') || '')
const tooltipMessage = ref('')
const tooltipType = ref<'success' | 'error'>('success')
const scanAreaRef = ref<HTMLElement | null>(null)
const isScanning = ref(false)
let tooltipTimer: number | null = null

const scanDelayMs = 200 // SCAN_DELAY: change this value to adjust the delay between continuous scan attempts.
const duplicateCooldownMs = 4000
let loopTimer: number | null = null
let activeRoi: Roi | null = null
let lastSentQr = ''
let lastSentAt = 0
let removeContinuousRoiListener: (() => void) | null = null
let scanAreaObserver: ResizeObserver | null = null
let scanRequestId = 0

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

async function refreshScanArea() {
  if (!scanAreaRef.value) return

  try {
    activeRoi = await updateScanArea(scanAreaRef.value)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
    showTooltip(errorMessage.value, 'error')
  }
}

async function ensureScanArea() {
  if (!scanAreaRef.value) {
    showTooltip('Scan area is not available.', 'error')
    return
  }

  try {
    activeRoi = await startContinuousOverlay(scanAreaRef.value)
    if (!removeContinuousRoiListener) {
      removeContinuousRoiListener = onContinuousRoiChanged((roi) => {
        activeRoi = roi
      })
    }
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
  const requestId = ++scanRequestId
  stopScan(false, false)
  isScanning.value = true
  errorMessage.value = ''
  if (!decoderAvailable) {
    isScanning.value = false
    showTooltip('QR decoder is not available in this browser.', 'error')
    return
  }
  if (!validateServerUrl()) {
    isScanning.value = false
    return
  }

  const result = await checkServer(serverUrl.value)
  if (requestId !== scanRequestId) return
  showTooltip(result.message, result.ok ? 'success' : 'error')
  if (!result.ok) {
    isScanning.value = false
    return
  }

  await ensureScanArea()
  if (requestId !== scanRequestId) return
  if (!activeRoi) {
    isScanning.value = false
    showTooltip('Scan area is not available.', 'error')
    return
  }

  const tick = async () => {
    if (!isScanning.value || !activeRoi) return
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

function stopScan(closeScanArea = false, invalidateRequest = true) {
  if (invalidateRequest) scanRequestId += 1
  if (loopTimer) window.clearTimeout(loopTimer)
  loopTimer = null
  isScanning.value = false
  if (closeScanArea) {
    activeRoi = null
    removeContinuousRoiListener?.()
    removeContinuousRoiListener = null
    void stopContinuousOverlay()
  }
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') stopScan()
}

function minimizeWindow() {
  void window.scannerApi.minimizeWindow()
}

function closeWindow() {
  void window.scannerApi.closeWindow()
}

window.addEventListener('keydown', onEsc)
window.addEventListener('beforeunload', saveServerUrl)
window.addEventListener('resize', refreshScanArea)
window.addEventListener('move', refreshScanArea)

onMounted(() => {
  void ensureScanArea()
  if (scanAreaRef.value) {
    scanAreaObserver = new ResizeObserver(() => {
      void refreshScanArea()
    })
    scanAreaObserver.observe(scanAreaRef.value)
  }
})

onBeforeUnmount(() => {
  saveServerUrl()
  window.removeEventListener('keydown', onEsc)
  window.removeEventListener('beforeunload', saveServerUrl)
  window.removeEventListener('resize', refreshScanArea)
  window.removeEventListener('move', refreshScanArea)
  scanAreaObserver?.disconnect()
  stopScan(true)
  if (tooltipTimer) window.clearTimeout(tooltipTimer)
})
</script>

<template>
  <main class="app">
    <section ref="scanAreaRef" class="scan-area" aria-label="QR scan capture area">
      <div class="scan-area-frame"></div>
    </section>
    <section class="control-panel">
      <div class="window-header">
        <h1>QR Scanner</h1>
        <div class="window-actions" aria-label="Window controls">
          <button type="button" class="window-action" aria-label="Minimize" @click="minimizeWindow">−</button>
          <button type="button" class="window-action close" aria-label="Close" @click="closeWindow">×</button>
        </div>
      </div>
      <ScannerControls
        :server-url="serverUrl"
        :tooltip-message="tooltipMessage"
        :tooltip-type="tooltipType"
        :is-scanning="isScanning"
        @update:server-url="onServerUrlUpdate"
        @start="startScan"
        @stop="stopScan"
      />
    </section>
  </main>
</template>
