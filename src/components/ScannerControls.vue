<script setup lang="ts">
defineProps<{
  serverUrl: string
  tooltipMessage: string
  tooltipType: 'success' | 'error'
}>()

const emit = defineEmits<{
  start: []
  stop: []
  'update:server-url': [value: string]
}>()
</script>

<template>
  <div class="controls">
    <div class="server-control">
      <input
        :value="serverUrl"
        type="url"
        placeholder="http://62.238.46.7/nordea"
        aria-label="Server URL"
        @input="emit('update:server-url', ($event.target as HTMLInputElement).value)"
      >
      <div v-if="tooltipMessage" class="tooltip" :class="tooltipType" role="status">
        {{ tooltipMessage }}
      </div>
    </div>
    <button @click="emit('start')">Check Server and Start Scan</button>
    <button class="danger" @click="emit('stop')">Stop Scan</button>
  </div>
</template>
