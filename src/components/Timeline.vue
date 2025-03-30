<script setup lang="ts">
import type { TimeLabel, ViewMode } from '../types/types'

defineProps<{
  timeLabels: TimeLabel[]
  viewMode: ViewMode
  timelineWidth: number
}>()
</script>

<template>
  <div
    class="flex h-10 border-b border-gray-200 bg-white"
    :style="{
      width: viewMode === 'months' ? '100%' : `${timelineWidth}px`,
    }">
    <div
      v-for="(label, index) in timeLabels"
      :key="index"
      class="flex h-full items-center justify-center text-sm font-medium text-gray-600 min-w-max"
      :class="[
        index < timeLabels.length - 1 || viewMode !== 'months'
          ? 'border-r'
          : '',
        'border-gray-200',
      ]"
      :style="{ width: `${label.width}px` }">
      {{ label.text }}
    </div>
  </div>
</template>
