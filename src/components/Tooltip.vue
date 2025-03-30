<script setup lang="ts">
import type { TooltipState } from '../types/types'

defineProps<{
  tooltip: TooltipState
}>()
</script>

<template>
  <div
    v-if="tooltip.show"
    class="fixed z-50 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg pointer-events-none"
    :style="tooltip.style">
    {{ tooltip.content }}
  </div>
</template>
