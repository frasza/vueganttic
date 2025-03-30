# Vue Gantt Chart

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A lightweight, interactive Gantt chart component for Vue 3 applications. Easily visualize and manage time-based project data with intuitive drag-and-drop functionality.

## ✨ Features

- **Multiple View Modes**: Switch between months, weeks, or days view
- **Year Selection**: Focus on specific time periods
- **Interactive Items**: Resize and move items with drag-and-drop
- **Responsive Design**: Adapts to container width
- **Date-Based Positioning**: Accurate item placement based on date ranges
- **Custom Styling**: Clean, minimal design that's easy to customize
- **TypeScript Support**: Fully typed component API

## 📦 Installation

```bash
npm install vue-gantt-chart
```

## 🚀 Usage

```vue
<script setup lang="ts">
import { ref } from "vue";
import Gantt from "vue-gantt-chart";
import type { Item } from "vue-gantt-chart";

// Define your items with start and end dates
const items = ref<Item[]>([
  {
    id: "task1",
    title: "Project Planning",
    startDate: new Date(2023, 0, 1), // Jan 1, 2023
    endDate: new Date(2023, 1, 15), // Feb 15, 2023
  },
  {
    id: "task2",
    title: "Development Phase",
    startDate: new Date(2023, 1, 16), // Feb 16, 2023
    endDate: new Date(2023, 3, 30), // Apr 30, 2023
  },
]);

// Handle item updates
function handleItemUpdate(updatedItem: Item) {
  const index = items.value.findIndex((item) => item.id === updatedItem.id);
  if (index !== -1) {
    items.value[index] = updatedItem;
  }
}
</script>

<template>
  <div class="p-4">
    <h1 class="text-xl font-bold mb-4">Project Timeline</h1>
    <Gantt :items="items" @update:item="handleItemUpdate" />
  </div>
</template>
```

## 📝 API

### Props

| Prop  | Type     | Required | Description                                  |
| ----- | -------- | -------- | -------------------------------------------- |
| items | `Item[]` | Yes      | Array of items to display in the Gantt chart |

### Item Interface

```typescript
interface Item {
  id?: string; // Optional unique identifier
  title: string; // Item title/label
  startDate: Date; // Start date of the item
  endDate: Date; // End date of the item
}
```

### Events

| Event       | Payload | Description                              |
| ----------- | ------- | ---------------------------------------- |
| update:item | `Item`  | Emitted when an item is resized or moved |

## 🔍 Features in Detail

### View Modes

The Gantt chart supports three view modes:

- **Months**: Shows a yearly view with monthly columns
- **Weeks**: Displays weeks, ideal for mid-term planning
- **Days**: Provides a detailed daily view

### Interactive Item Manipulation

Items can be manipulated in three ways:

- **Move**: Drag the entire item to a new position
- **Resize Start**: Drag the left edge to change the start date
- **Resize End**: Drag the right edge to change the end date

All changes emit update events with the new item dates.

### Year Selection

The year selector allows focusing on the relevant time period, especially useful for long-running or multi-year projects.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/vue-gantt-chart/issues).

## 📄 License

MIT License

Copyright (c) 2023 Vue Gantt Chart
