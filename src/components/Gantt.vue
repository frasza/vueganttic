<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Item from './Item.vue'
import Timeline from './Timeline.vue'
import Tooltip from './Tooltip.vue'
import { useCalculations } from '../composables/useCalculations'
import { useDrag } from '../composables/useDrag'
import type { Item as GanttItemType, ViewMode } from '../types/types'

const props = defineProps<{
  items: GanttItemType[]
  year: number
  view: ViewMode
}>()

const emit = defineEmits<{
  'update:item': [updatedItem: GanttItemType]
  'update:year': [year: number]
  'update:view': [view: ViewMode]
  select: [item: GanttItemType]
  move: [item: GanttItemType]
  resize: [item: GanttItemType]
}>()

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)

const {
  timelineWidth,
  filteredItems,
  computeDateBasedPosition,
  timeLabels,
  getYearStart,
  createDateAtDay,
  clearCache,
  pixelsToDays,
} = useCalculations(
  containerWidth,
  computed(() => props.year),
  computed(() => props.view),
  computed(() => props.items),
)

const {
  activeItemIndex,
  activeItemStyle,
  tooltipState,
  startResize,
  onMouseMove,
  onMouseUp,
} = useDrag(
  computed(() => props.year),
  getYearStart,
  createDateAtDay,
  pixelsToDays,
)

const computedObjectives = computed(() => {
  return filteredItems.value.map(computeDateBasedPosition)
})

function onResizeStart(event: MouseEvent, type: any, index: number, item: any) {
  startResize(event, type, index, item)
}

function onGlobalMouseMove(event: MouseEvent) {
  onMouseMove(event)
}

function onGlobalMouseUp(event: MouseEvent) {
  onMouseUp(event, filteredItems.value, props.items, emit)
  clearCache()
}

function updateContainerWidth() {
  nextTick(() => {
    if (containerRef.value) {
      containerWidth.value = containerRef.value.offsetWidth
      clearCache()
    }
  })
}

onMounted(() => {
  updateContainerWidth()
  window.addEventListener('resize', updateContainerWidth)
  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateContainerWidth)
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
})
</script>

<template>
  <div>
    <div ref="containerRef" class="w-full overflow-x-auto overflow-y-hidden">
      <!-- Timeline header -->
      <Timeline
        :timeLabels="timeLabels"
        :viewMode="view"
        :timelineWidth="timelineWidth" />

      <!-- Objectives -->
      <div
        class="relative mt-4"
        :style="{
          minHeight: `${computedObjectives.length * 48 + 16}px`,
          width: view === 'months' ? '100%' : `${timelineWidth}px`,
        }">
        <Item
          v-for="(objective, index) in computedObjectives"
          :key="objective.title + (objective.id || '')"
          :item="objective"
          :index="index"
          :isActive="index === activeItemIndex"
          :activeStyle="activeItemStyle"
          @resize-start="onResizeStart" />
      </div>
    </div>

    <!-- Date tooltip -->
    <Tooltip :tooltip="tooltipState" />
  </div>
</template>
