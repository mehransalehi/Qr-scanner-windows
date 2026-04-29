<script setup lang="ts">
defineProps<{ canSave: boolean }>()
const emit = defineEmits<{
  scanOnce: []
  start: []
  stop: []
  save: []
}>()
</script>

<template>
  <div class="controls">
    <button @click="emit('scanOnce')">Scan Once</button>
    <button @click="emit('start')">Start Continuous Scan</button>
    <button class="danger" @click="emit('stop')">Stop Scan</button>
    <button :disabled="!canSave" @click="emit('save')">Save Image</button>
  </div>
</template>
