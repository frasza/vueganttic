<script setup lang="ts">
import type { ComputedItem, ResizeType } from '../types/types'

const props = defineProps<{
  item: ComputedItem
  index: number
  isActive: boolean
  activeStyle: {
    transform: string
    width: string
  }
}>()

const emit = defineEmits<{
  'resize-start': [
    event: MouseEvent,
    type: ResizeType,
    index: number,
    item: ComputedItem,
  ]
}>()

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function onResizeStart(event: MouseEvent, type: ResizeType) {
  emit('resize-start', event, type, props.index, props.item)
}
</script>

<template>
  <div class="relative mb-4 h-12">
    <div
      class="absolute flex h-full items-center rounded-lg border border-sky-200 bg-sky-50 px-3 hover:bg-sky-100 gantt-item cursor-move will-change-transform"
      :class="{
        'transition-none': isActive,
        'transition-transform': !isActive,
      }"
      :style="isActive ? activeStyle : item.style"
      @mousedown.stop="onResizeStart($event, 'move')">
      <!-- Left resize handle -->
      <div
        class="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize group"
        @mousedown.stop="onResizeStart($event, 'start')">
        <div
          class="absolute left-0 top-0 bottom-0 w-1 h-full bg-sky-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
      </div>

      <div class="flex flex-col overflow-hidden">
        <span class="truncate text-sm font-medium text-primary">
          {{ item.title }}
        </span>
        <span class="truncate text-xs text-gray-500">
          {{ formatDate(item.startDate) }} -
          {{ formatDate(item.endDate) }}
        </span>
      </div>

      <!-- Right resize handle -->
      <div
        class="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize group"
        @mousedown.stop="onResizeStart($event, 'end')">
        <div
          class="absolute right-0 top-0 bottom-0 w-1 h-full bg-sky-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
      </div>
    </div>
  </div>
</template>
