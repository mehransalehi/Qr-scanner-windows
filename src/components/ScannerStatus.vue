<script setup lang="ts">
defineProps<{ state: string; lastQr: string; apiResponse: string; errorMessage: string; decoderAvailable: boolean }>()
</script>

<template>
  <section class="status">
    <p><strong>State:</strong> {{ state }}</p>
    <p><strong>Last QR:</strong> {{ lastQr }}</p>
    <!-- <p><strong>API Response:</strong> {{ apiResponse }}</p>
    <p v-if="!decoderAvailable" class="warn">BarcodeDetector unavailable in this runtime. Falling back to @zxing/browser when installed.</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p> -->
  </section>
</template>
