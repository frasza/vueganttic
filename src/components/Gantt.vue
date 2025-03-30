<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from "vue";

// Types
export interface Item {
  title: string;
  id?: string;
  startDate: Date;
  endDate: Date;
}

interface ComputedItem extends Item {
  start: number;
  width: number;
  durationMonths: number;
  left: string;
  style: {
    left: string;
    width: string;
  };
}

type ResizeType = "start" | "end" | "move" | null;
type ViewMode = "months" | "weeks" | "days";

// Props and emits
const props = defineProps<{
  items: Item[];
}>();

const emit = defineEmits<{
  "update:item": [updatedItem: Item];
}>();

// Refs
const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const selectedYear = ref(new Date().getFullYear());
const viewMode = ref<ViewMode>("months");

// Drag state
const isDragging = ref(false);
const dragType = ref<ResizeType>(null);
const activeItemIndex = ref<number | null>(null);
const initialMouseX = ref(0);
const initialItemStart = ref(0);
const initialItemWidth = ref(0);
const initialItemStartPx = ref(0);

// Date calculations
const availableYears = computed(() => {
  const years = new Set<number>();
  // Add current year
  years.add(new Date().getFullYear());

  props.items.forEach((item) => {
    if (item.startDate) years.add(item.startDate.getFullYear());
    if (item.endDate) years.add(item.endDate.getFullYear());
  });

  return Array.from(years).sort();
});

const filteredItems = computed(() => {
  return props.items.filter((item) => {
    // Include if item spans or is within the selected year
    const startYear = item.startDate.getFullYear();
    const endYear = item.endDate.getFullYear();
    return startYear <= selectedYear.value && endYear >= selectedYear.value;
  });
});

const earliestDate = computed(() => {
  // Start with the first day of selected year as default
  let earliest = new Date(selectedYear.value, 0, 1);

  filteredItems.value.forEach((item) => {
    // If item starts before selected year, use Jan 1 of selected year
    if (item.startDate.getFullYear() < selectedYear.value) {
      const adjustedDate = new Date(selectedYear.value, 0, 1);
      if (adjustedDate < earliest) earliest = adjustedDate;
    }
    // If item starts in selected year, use actual start date
    else if (item.startDate.getFullYear() === selectedYear.value) {
      if (item.startDate < earliest) earliest = new Date(item.startDate);
    }
  });

  // Format earliest date based on view mode
  if (viewMode.value === "months") {
    earliest.setDate(1); // First day of the month
  } else if (viewMode.value === "weeks") {
    // Set to the beginning of the week
    const day = earliest.getDay();
    earliest.setDate(earliest.getDate() - day);
  }
  return earliest;
});

const totalTimeUnits = computed(() => {
  if (viewMode.value === "months") {
    return 12; // Always show 12 months for consistent display
  } else if (viewMode.value === "weeks") {
    // Calculate weeks in the year (approximately 52)
    const startOfYear = new Date(selectedYear.value, 0, 1);
    const endOfYear = new Date(selectedYear.value, 11, 31, 23, 59, 59);
    return (
      Math.ceil(
        (endOfYear.getTime() - startOfYear.getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      ) + 1
    );
  } else {
    // days
    // Calculate days in the year
    const startOfYear = new Date(selectedYear.value, 0, 1);
    const endOfYear = new Date(selectedYear.value, 11, 31, 23, 59, 59);
    return (
      Math.ceil(
        (endOfYear.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1
    );
  }
});

// Size calculations
const timeUnitWidth = computed(() => {
  if (containerWidth.value === 0 || totalTimeUnits.value === 0) {
    // Default fallback widths based on view mode
    if (viewMode.value === "months") return 112;
    if (viewMode.value === "weeks") return 50;
    return 24; // days
  }

  if (viewMode.value === "months") {
    // Always show all 12 months at full width
    return containerWidth.value / 12;
  } else if (viewMode.value === "weeks") {
    // Fixed width to show 10 weeks before scrolling
    return containerWidth.value / 10;
  } else {
    // Fixed width to show approximately 30 days (1 month) before scrolling
    return containerWidth.value / 30;
  }
});

const computedObjectives = computed(() => {
  return filteredItems.value.map((item) => {
    return computeDateBasedPosition(item);
  });
});

function computeDateBasedPosition(item: Item): ComputedItem {
  // Create reference to start of the selected year (January 1st)
  const yearStart = new Date(selectedYear.value, 0, 1);
  const yearEnd = new Date(selectedYear.value, 11, 31, 23, 59, 59);

  // Clamp dates to year boundaries
  const effectiveStartDate =
    item.startDate < yearStart ? yearStart : new Date(item.startDate);
  const effectiveEndDate =
    item.endDate > yearEnd ? yearEnd : new Date(item.endDate);

  // Calculate absolute days from year start for positioning
  const daysFromYearStartToItemStart = Math.max(
    0,
    Math.floor(
      (effectiveStartDate.getTime() - yearStart.getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  const daysFromYearStartToItemEnd = Math.floor(
    (effectiveEndDate.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000),
  );

  // Calculate absolute item duration in days
  const durationInDays = Math.max(
    1,
    daysFromYearStartToItemEnd - daysFromYearStartToItemStart + 1,
  );

  let startUnit, width;

  if (viewMode.value === "months") {
    // Position at the appropriate month
    startUnit = Math.floor((daysFromYearStartToItemStart * 12) / 365);

    // Width based on day count relative to entire year (365 days / 12 months)
    // This ensures a month-long item keeps roughly the same proportion in all views
    const monthWidth = timeUnitWidth.value;
    width = (durationInDays / 30.5) * monthWidth; // 30.5 is avg days per month
  } else if (viewMode.value === "weeks") {
    // Position at the appropriate week
    startUnit = Math.floor(daysFromYearStartToItemStart / 7);

    // Width based on actual days, converted to weeks
    const weekWidth = timeUnitWidth.value;
    width = (durationInDays / 7) * weekWidth;
  } else {
    // days
    // Direct day position
    startUnit = daysFromYearStartToItemStart;

    // Width based on actual days
    width = durationInDays * timeUnitWidth.value;
  }

  // Calculate left position
  const left = startUnit * timeUnitWidth.value;

  return {
    ...item,
    start: startUnit,
    width,
    durationMonths: durationInDays, // Store the actual day count for reference
    left: `${left}px`,
    style: {
      left: `${left}px`,
      width: `${width}px`,
    },
  };
}

const timeLabels = computed(() => {
  const labels = [];

  if (viewMode.value === "months") {
    // Show all 12 months of the year
    for (let i = 0; i < 12; i++) {
      const date = new Date(selectedYear.value, i, 15);
      labels.push(
        date.toLocaleString("default", { month: "short", year: "2-digit" }),
      );
    }
  } else if (viewMode.value === "weeks") {
    // Start from beginning of year
    const startDate = new Date(selectedYear.value, 0, 1);
    // Set to the first day of the week
    const day = startDate.getDay();
    startDate.setDate(startDate.getDate() - day);

    for (let i = 0; i < totalTimeUnits.value; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i * 7);

      // Format as "Week N (MMM)"
      const weekNum = Math.ceil(
        (date.getDate() +
          new Date(date.getFullYear(), date.getMonth(), 1).getDay()) /
          7,
      );
      labels.push(
        `W${weekNum} (${date.toLocaleString("default", { month: "short" })})`,
      );
    }
  } else {
    // days
    // Start from beginning of year
    const startDate = new Date(selectedYear.value, 0, 1);
    for (let i = 0; i < totalTimeUnits.value; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      labels.push(
        date.toLocaleString("default", { day: "numeric", month: "short" }),
      );
    }
  }

  return labels;
});

// Lifecycle and event handlers
onMounted(() => {
  updateContainerWidth();
  window.addEventListener("resize", updateContainerWidth);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  return () => {
    window.removeEventListener("resize", updateContainerWidth);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
});

function updateContainerWidth() {
  nextTick(() => {
    if (containerRef.value) {
      containerWidth.value = containerRef.value.offsetWidth;
    }
  });
}

function onYearChange() {
  nextTick(updateContainerWidth);
}

function onViewModeChange() {
  nextTick(updateContainerWidth);
}

// Resize functions
function startResize(event: MouseEvent, type: ResizeType, index: number) {
  event.preventDefault();
  event.stopPropagation();

  isDragging.value = true;
  dragType.value = type;
  activeItemIndex.value = index;
  initialMouseX.value = event.clientX;

  const item = computedObjectives.value[index];
  initialItemStart.value = parseFloat(item.style.left) / timeUnitWidth.value;
  initialItemWidth.value = parseFloat(item.style.width);
  initialItemStartPx.value = parseFloat(item.style.left);

  // Add 'user-select: none' to prevent text selection during drag
  document.body.style.userSelect = "none";
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging.value || activeItemIndex.value === null) return;

  const deltaX = event.clientX - initialMouseX.value;

  if (dragType.value === "start") {
    handleStartResize(deltaX);
  } else if (dragType.value === "end") {
    handleEndResize(deltaX);
  } else if (dragType.value === "move") {
    handleMove(deltaX);
  }
}

function handleEndResize(deltaX: number) {
  // Calculate the raw changed width in pixels
  const rawNewWidthPx = Math.max(
    timeUnitWidth.value / 2,
    initialItemWidth.value + deltaX,
  );
  const startPx = initialItemStart.value * timeUnitWidth.value;

  let snappedWidthPx;

  // Apply different snapping logic based on view mode
  if (viewMode.value === "months") {
    // For months, snap to whole months exactly
    const widthInMonths = rawNewWidthPx / timeUnitWidth.value;
    // Round to nearest month
    const roundedMonths = Math.ceil(widthInMonths);
    snappedWidthPx = roundedMonths * timeUnitWidth.value;
  } else if (viewMode.value === "weeks") {
    // For weeks, snap to whole weeks exactly
    const widthInWeeks = rawNewWidthPx / timeUnitWidth.value;
    // Round to nearest week
    const roundedWeeks = Math.ceil(widthInWeeks);
    snappedWidthPx = roundedWeeks * timeUnitWidth.value;
  } else {
    // For days, use the delta-based approach that works well
    const initialWidthInUnits = initialItemWidth.value / timeUnitWidth.value;
    const intendedWidthInUnits = rawNewWidthPx / timeUnitWidth.value;
    const deltaUnits = intendedWidthInUnits - initialWidthInUnits;
    const roundedDeltaUnits = Math.round(deltaUnits);
    const snappedWidthInUnits = initialWidthInUnits + roundedDeltaUnits;
    snappedWidthPx = snappedWidthInUnits * timeUnitWidth.value;
  }

  // Ensure minimum width
  snappedWidthPx = Math.max(timeUnitWidth.value, snappedWidthPx);

  updateItemStyle(startPx, snappedWidthPx);
}

function handleStartResize(deltaX: number) {
  // Calculate the raw changed start position in pixels
  const rawNewStartPx = Math.max(0, initialItemStartPx.value + deltaX);

  let snappedStartPx;

  // Apply different snapping logic based on view mode
  if (viewMode.value === "months") {
    // For months, snap to the start of months exactly
    const startInMonths = rawNewStartPx / timeUnitWidth.value;
    // Floor to snap to the beginning of the month
    const flooredMonths = Math.floor(startInMonths);
    snappedStartPx = flooredMonths * timeUnitWidth.value;
  } else if (viewMode.value === "weeks") {
    // For weeks, snap to the start of weeks exactly
    const startInWeeks = rawNewStartPx / timeUnitWidth.value;
    // Floor to snap to the beginning of the week
    const flooredWeeks = Math.floor(startInWeeks);
    snappedStartPx = flooredWeeks * timeUnitWidth.value;
  } else {
    // For days, use the delta-based approach
    const initialStartInUnits = initialItemStartPx.value / timeUnitWidth.value;
    const intendedStartInUnits = rawNewStartPx / timeUnitWidth.value;
    const deltaUnits = intendedStartInUnits - initialStartInUnits;
    const roundedDeltaUnits = Math.round(deltaUnits);
    const snappedStartInUnits = initialStartInUnits + roundedDeltaUnits;
    snappedStartPx = snappedStartInUnits * timeUnitWidth.value;
  }

  // Adjust width proportionally
  const snappedWidthPx = Math.max(
    timeUnitWidth.value,
    initialItemWidth.value - (snappedStartPx - initialItemStartPx.value),
  );

  updateItemStyle(snappedStartPx, snappedWidthPx);
}

function handleMove(deltaX: number) {
  // Calculate raw new position
  const rawNewStartPx = Math.max(0, initialItemStartPx.value + deltaX);

  let snappedStartPx;

  // Apply different snapping logic based on view mode
  if (viewMode.value === "months") {
    // For months, snap to the start of months exactly
    const startInMonths = rawNewStartPx / timeUnitWidth.value;
    // Round to nearest month (could be floor if you want to strictly snap to start)
    const roundedMonths = Math.round(startInMonths);
    snappedStartPx = roundedMonths * timeUnitWidth.value;
  } else if (viewMode.value === "weeks") {
    // For weeks, snap to the start of weeks exactly
    const startInWeeks = rawNewStartPx / timeUnitWidth.value;
    // Round to nearest week (could be floor if you want to strictly snap to start)
    const roundedWeeks = Math.round(startInWeeks);
    snappedStartPx = roundedWeeks * timeUnitWidth.value;
  } else {
    // For days, use the delta-based approach
    const initialStartInUnits = initialItemStartPx.value / timeUnitWidth.value;
    const intendedStartInUnits = rawNewStartPx / timeUnitWidth.value;
    const deltaUnits = intendedStartInUnits - initialStartInUnits;
    const roundedDeltaUnits = Math.round(deltaUnits);
    const snappedStartInUnits = initialStartInUnits + roundedDeltaUnits;
    snappedStartPx = snappedStartInUnits * timeUnitWidth.value;
  }

  updateItemStyle(snappedStartPx, initialItemWidth.value);
}

function updateItemStyle(leftPx: number, widthPx: number) {
  if (!containerRef.value || activeItemIndex.value === null) return;

  const itemElement = containerRef.value.querySelectorAll(".gantt-item")[
    activeItemIndex.value
  ] as HTMLElement;
  if (itemElement) {
    itemElement.style.left = `${leftPx}px`;
    itemElement.style.width = `${widthPx}px`;
  }
}

function updateDateBasedItem(
  item: Item,
  newStartPosition: number,
  newDurationMonths: number,
) {
  const baseDate = new Date(earliestDate.value);
  const timeUnit = viewMode.value;

  // Always use whole number positions for start and duration
  const startPositionInUnits = Math.round(newStartPosition);
  const durationInUnits = Math.max(1, Math.round(newDurationMonths));

  if (dragType.value === "start") {
    // Update start date
    const newStartDate = new Date(baseDate);
    if (timeUnit === "months") {
      newStartDate.setMonth(baseDate.getMonth() + startPositionInUnits);
      // Set to first day of month for consistency
      newStartDate.setDate(1);
    } else if (timeUnit === "weeks") {
      newStartDate.setDate(baseDate.getDate() + startPositionInUnits * 7);
      // Set to first day of week
      const dayOfWeek = newStartDate.getDay();
      newStartDate.setDate(newStartDate.getDate() - dayOfWeek);
    } else {
      // days
      newStartDate.setDate(baseDate.getDate() + startPositionInUnits);
    }
    item.startDate = newStartDate;

    // Ensure end date is consistent with new duration
    const newEndDate = new Date(newStartDate);
    if (timeUnit === "months") {
      newEndDate.setMonth(newStartDate.getMonth() + durationInUnits);
      // Set to end of month (last day of previous month)
      newEndDate.setDate(0);
    } else if (timeUnit === "weeks") {
      // Add weeks and then go to last day of the week (6 days from start of week)
      newEndDate.setDate(newStartDate.getDate() + durationInUnits * 7 - 1);
      // Ensure it's the last day of the week
      const daysToAdd = 6 - newEndDate.getDay();
      newEndDate.setDate(newEndDate.getDate() + daysToAdd);
    } else {
      // days
      newEndDate.setDate(newStartDate.getDate() + durationInUnits - 1);
    }
    item.endDate = newEndDate;
  } else if (dragType.value === "end") {
    // Update end date only
    const newEndDate = new Date(baseDate);
    if (timeUnit === "months") {
      newEndDate.setMonth(
        baseDate.getMonth() + startPositionInUnits + durationInUnits,
      );
      // Set to end of month (last day of month)
      newEndDate.setDate(0);
    } else if (timeUnit === "weeks") {
      // Set to the last day of the last week
      newEndDate.setDate(
        baseDate.getDate() + (startPositionInUnits + durationInUnits) * 7 - 1,
      );
      // Ensure it's the last day of the week
      const daysToAdd = 6 - newEndDate.getDay();
      newEndDate.setDate(newEndDate.getDate() + daysToAdd);
    } else {
      // days
      newEndDate.setDate(
        baseDate.getDate() + startPositionInUnits + durationInUnits - 1,
      );
    }
    item.endDate = newEndDate;
  } else if (dragType.value === "move") {
    // Update start date
    const newStartDate = new Date(baseDate);
    if (timeUnit === "months") {
      newStartDate.setMonth(baseDate.getMonth() + startPositionInUnits);
      // Set to first day of month
      newStartDate.setDate(1);
    } else if (timeUnit === "weeks") {
      newStartDate.setDate(baseDate.getDate() + startPositionInUnits * 7);
      // Set to first day of week
      const dayOfWeek = newStartDate.getDay();
      newStartDate.setDate(newStartDate.getDate() - dayOfWeek);
    } else {
      // days
      newStartDate.setDate(baseDate.getDate() + startPositionInUnits);
    }
    item.startDate = newStartDate;

    // Calculate new end date based on duration
    const newEndDate = new Date(newStartDate);
    if (timeUnit === "months") {
      newEndDate.setMonth(newStartDate.getMonth() + durationInUnits);
      // Set to end of month (last day of month)
      newEndDate.setDate(0);
    } else if (timeUnit === "weeks") {
      // Set to the last day of the last week
      newEndDate.setDate(newStartDate.getDate() + durationInUnits * 7 - 1);
      // Ensure it's the last day of the week
      const daysToAdd = 6 - newEndDate.getDay();
      newEndDate.setDate(newEndDate.getDate() + daysToAdd);
    } else {
      // days
      newEndDate.setDate(newStartDate.getDate() + durationInUnits - 1);
    }
    item.endDate = newEndDate;
  }
}

function onMouseUp() {
  if (!isDragging.value || activeItemIndex.value === null) return;

  // Get the original item from filtered items
  const filteredItem = filteredItems.value[activeItemIndex.value];
  const originalItemIndex = props.items.findIndex((item) => {
    return (
      filteredItem.title === item.title &&
      ("id" in filteredItem && "id" in item
        ? filteredItem.id === item.id
        : true)
    );
  });

  if (originalItemIndex === -1) {
    resetDragState();
    return;
  }

  const originalItem = props.items[originalItemIndex];
  const resizedItem = { ...originalItem };

  // Get the current position and width from DOM for accuracy
  const itemElement = containerRef.value?.querySelectorAll(".gantt-item")[
    activeItemIndex.value
  ] as HTMLElement | undefined;

  if (!itemElement) {
    resetDragState();
    return;
  }

  // Calculate positions in terms of time units and snap to nearest unit
  const currentLeftPx = parseFloat(itemElement.style.left);
  const currentWidthPx = parseFloat(itemElement.style.width);

  // Apply the exact same snapping logic based on view mode
  let newStartPosition, newDurationMonths;

  if (viewMode.value === "months" || viewMode.value === "weeks") {
    // For months and weeks, snap directly to grid positions
    newStartPosition = Math.round(currentLeftPx / timeUnitWidth.value);
    newDurationMonths = Math.round(currentWidthPx / timeUnitWidth.value);
  } else {
    // For days, use existing calculation
    newStartPosition = Math.round(currentLeftPx / timeUnitWidth.value);
    newDurationMonths = Math.round(currentWidthPx / timeUnitWidth.value);
  }

  // Ensure we have valid numbers
  if (isNaN(newStartPosition) || isNaN(newDurationMonths)) {
    resetDragState();
    return;
  }

  // Update the item element to reflect the snapped position
  updateItemStyle(
    newStartPosition * timeUnitWidth.value,
    newDurationMonths * timeUnitWidth.value,
  );

  updateDateBasedItem(resizedItem, newStartPosition, newDurationMonths);

  // Emit the updated item
  emit("update:item", resizedItem);

  // Reset drag state
  resetDragState();

  // Force recalculation of computed properties
  nextTick(updateContainerWidth);
}

function resetDragState() {
  isDragging.value = false;
  dragType.value = null;
  activeItemIndex.value = null;
  document.body.style.userSelect = "";
}
</script>

<template>
  <div>
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
          @change="onYearChange"
          class="rounded-md border border-gray-300 bg-white py-1 px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>

      <!-- View mode selector -->
      <div class="flex items-center">
        <label
          for="view-mode-select"
          class="mr-2 text-sm font-medium text-gray-700"
          >View:</label
        >
        <select
          id="view-mode-select"
          v-model="viewMode"
          @change="onViewModeChange"
          class="rounded-md border border-gray-300 bg-white py-1 px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="months">Months</option>
          <option value="weeks">Weeks</option>
          <option value="days">Days</option>
        </select>
      </div>
    </div>

    <div ref="containerRef" class="w-full overflow-x-auto overflow-y-hidden">
      <!-- Timeline header -->
      <div
        class="flex h-10 border-b border-gray-200 bg-white"
        :style="{
          width:
            viewMode === 'months'
              ? '100%'
              : `${timeUnitWidth * totalTimeUnits}px`,
        }"
      >
        <div
          v-for="(label, index) in timeLabels"
          :key="index"
          class="flex h-full items-center justify-center border-r border-gray-200 text-sm font-medium text-gray-600 min-w-max"
          :style="{ width: `${timeUnitWidth}px` }"
        >
          {{ label }}
        </div>
      </div>

      <!-- Objectives -->
      <div
        class="relative mt-4"
        :style="{
          minHeight: `${computedObjectives.length * 48 + 16}px`,
          width:
            viewMode === 'months'
              ? '100%'
              : `${timeUnitWidth * totalTimeUnits}px`,
        }"
      >
        <div
          v-for="(objective, index) in computedObjectives"
          :key="objective.title"
          class="relative mb-4 h-12"
        >
          <div
            class="absolute flex h-full items-center rounded-lg border border-sky-200 bg-sky-50 px-3 transition-all hover:bg-sky-100 gantt-item cursor-move"
            :style="objective.style"
            @mousedown.stop="startResize($event, 'move', index)"
          >
            <!-- Left resize handle -->
            <div
              class="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize group"
              @mousedown.stop="startResize($event, 'start', index)"
            >
              <div
                class="absolute left-0 top-0 bottom-0 w-1 h-full bg-sky-500 opacity-0 transition-opacity group-hover:opacity-100"
              ></div>
            </div>

            <span class="truncate text-sm font-medium text-primary">
              {{ objective.title }}
            </span>

            <!-- Right resize handle -->
            <div
              class="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize group"
              @mousedown.stop="startResize($event, 'end', index)"
            >
              <div
                class="absolute right-0 top-0 bottom-0 w-1 h-full bg-sky-500 opacity-0 transition-opacity group-hover:opacity-100"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
