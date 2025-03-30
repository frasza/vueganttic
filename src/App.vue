<script setup lang="ts">
import { ref } from "vue";
import Gantt from "./components/Gantt.vue";
import type { Item } from "./components/Gantt.vue";

// Items with start and end dates
const items = ref<Item[]>([
  // Items with start and end dates - 2023
  {
    id: "item3",
    title: "Task 3 (2023)",
    startDate: new Date(2023, 0, 1), // Jan 2023
    endDate: new Date(2023, 2, 31), // Mar 2023
  },
  {
    id: "item4",
    title: "Task 4 (2023)",
    startDate: new Date(2023, 3, 1), // Apr 2023
    endDate: new Date(2023, 5, 30), // Jun 2023
  },
  // Items with start and end dates - 2024
  {
    id: "item5",
    title: "Task 5 (2024)",
    startDate: new Date(2024, 6, 1), // Jul 2024
    endDate: new Date(2024, 8, 30), // Sep 2024
  },
  // Cross-year item
  {
    id: "item6",
    title: "Task 6 (2024-2025)",
    startDate: new Date(2024, 10, 1), // Nov 2024
    endDate: new Date(2025, 1, 28), // Feb 2025
  },
  // Items with start and end dates - 2025
  {
    id: "item7",
    title: "Task 7 (2025)",
    startDate: new Date(2025, 0, 1), // Jan 2025
    endDate: new Date(2025, 2, 31), // Mar 2025
  },
  {
    id: "item8",
    title: "Task 8 (2025)",
    startDate: new Date(2025, 3, 1), // Apr 2025
    endDate: new Date(2025, 5, 30), // Jun 2025
  },
  // Multi-year spanning item
  {
    id: "item9",
    title: "Task 9 (2023-2025)",
    startDate: new Date(2023, 7, 1), // Aug 2023
    endDate: new Date(2025, 7, 31), // Aug 2025
  },
]);

// Handle individual item updates
function handleItemUpdate(updatedItem: Item) {
  const index = items.value.findIndex(
    (item) =>
      ("id" in updatedItem && "id" in item && item.id === updatedItem.id) ||
      item.title === updatedItem.title,
  );

  if (index !== -1) {
    items.value[index] = updatedItem;
  }
}
</script>

<template>
  <div class="p-4 h-screen">
    <h1 class="mb-4 text-xl font-bold">Gantt Chart</h1>
    <Gantt :items="items" @update:item="handleItemUpdate" />
  </div>
</template>
