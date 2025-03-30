<script setup lang="ts">
import { ref, computed } from 'vue'
import Gantt from './components/Gantt.vue'
import type { Item } from './types/types'
import type { ViewMode } from './types/types'

// Controls state
const selectedYear = ref(new Date().getFullYear())
const viewMode = ref<ViewMode>('months')

// Get available years from items
const availableYears = computed(() => {
  const years = new Set<number>()
  years.add(new Date().getFullYear())

  items.value.forEach((item) => {
    if (item.startDate) years.add(item.startDate.getFullYear())
    if (item.endDate) years.add(item.endDate.getFullYear())
  })

  return Array.from(years).sort()
})

// Items with start and end dates
const items = ref<Item[]>([
  {
    id: 'item3',
    title: 'Task 3 (2023)',
    startDate: new Date(2023, 0, 1),
    endDate: new Date(2023, 2, 31),
  },
  {
    id: 'item4',
    title: 'Task 4 (2023)',
    startDate: new Date(2023, 3, 1),
    endDate: new Date(2023, 5, 30),
  },
  {
    id: 'item5',
    title: 'Task 5 (2024)',
    startDate: new Date(2024, 6, 1),
    endDate: new Date(2024, 8, 30),
  },
  {
    id: 'item6',
    title: 'Task 6 (2024-2025)',
    startDate: new Date(2024, 10, 1),
    endDate: new Date(2025, 1, 28),
  },
  {
    id: 'item7',
    title: 'Task 7 (2025)',
    startDate: new Date(2025, 0, 1),
    endDate: new Date(2025, 2, 31),
  },
  {
    id: 'item8',
    title: 'Task 8 (2025)',
    startDate: new Date(2025, 3, 1),
    endDate: new Date(2025, 5, 30),
  },
  {
    id: 'item9',
    title: 'Task 9 (2023-2025)',
    startDate: new Date(2023, 7, 1),
    endDate: new Date(2025, 7, 31),
  },
])

function handleItemUpdate(updatedItem: Item) {
  const index = items.value.findIndex(
    (item) =>
      ('id' in updatedItem && 'id' in item && item.id === updatedItem.id) ||
      item.title === updatedItem.title,
  )

  if (index !== -1) {
    items.value[index] = updatedItem
  }
}
</script>

<template>
  <div class="p-4 h-screen">
    <h1 class="mb-4 text-xl font-bold">Gantt Chart</h1>

    <!-- Controls -->
    <div class="mb-4 flex items-center space-x-4">
      <!-- Year selector -->
      <div class="flex items-center">
        <label for="year-select" class="mr-2 text-sm font-medium text-gray-700"
          >Year:</label
        >
        <select
          id="year-select"
          v-model="selectedYear"
          class="rounded-md border border-gray-300 bg-white py-1 px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>

      <!-- View mode selector -->
      <div class="flex items-center ml-auto">
        <span class="mr-2 text-sm font-medium text-gray-700">View:</span>
        <div class="border border-gray-200 rounded-md flex bg-white">
          <button
            type="button"
            class="py-1 px-3 text-sm font-medium transition-colors focus:outline-none"
            :class="
              viewMode === 'months'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50'
            "
            @click="viewMode = 'months'">
            Monthly
          </button>
          <button
            type="button"
            class="py-1 px-3 text-sm font-medium border-l border-gray-200 transition-colors focus:outline-none"
            :class="
              viewMode === 'weeks'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50'
            "
            @click="viewMode = 'weeks'">
            Weekly
          </button>
          <button
            type="button"
            class="py-1 px-3 text-sm font-medium border-l border-gray-200 transition-colors focus:outline-none"
            :class="
              viewMode === 'days'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50'
            "
            @click="viewMode = 'days'">
            Daily
          </button>
        </div>
      </div>
    </div>

    <Gantt
      :items="items"
      :year="selectedYear"
      :view="viewMode"
      @update:item="handleItemUpdate" />
  </div>
</template>
