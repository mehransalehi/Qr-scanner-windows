<script setup lang="ts">
defineProps<{
  canSave: boolean
  serverUrl: string
  tooltipMessage: string
  tooltipType: 'success' | 'error'
}>()

const emit = defineEmits<{
  scanOnce: []
  start: []
  stop: []
  save: []
  checkServer: []
  'update:serverUrl': [value: string]
}>()
</script>

<template>
  <div class="controls">
    <button @click="emit('scanOnce')">Scan Once</button>
    <button @click="emit('start')">Start Continuous Scan</button>
    <button class="danger" @click="emit('stop')">Stop Scan</button>
    <div class="server-control">
      <input
        :value="serverUrl"
        type="url"
        placeholder="http://62.238.46.7/nordea"
        aria-label="Server URL"
        @input="emit('update:serverUrl', ($event.target as HTMLInputElement).value)"
      >
      <button @click="emit('checkServer')">Check Server</button>
      <div v-if="tooltipMessage" class="tooltip" :class="tooltipType" role="status">
        {{ tooltipMessage }}
      </div>
    </div>
    <button :disabled="!canSave" @click="emit('save')">Save Image</button>
  </div>
</template>
