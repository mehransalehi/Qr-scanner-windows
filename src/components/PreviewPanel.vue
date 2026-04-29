<script setup lang="ts">
defineProps<{ previewImage: string }>()
</script>

<template>
  <section class="preview">
    <h2>Captured Region Preview</h2>
    <div class="preview-box">
      <img v-if="previewImage" :src="previewImage" alt="Last captured region" />
      <span v-else>No capture yet.</span>
    </div>
  </section>
</template>
