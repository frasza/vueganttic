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
  durationDays: number;
  left: string;
  style: {
    left: string;
    width: string;
  };
}

type ResizeType = "start" | "end" | "move" | null;

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
const viewMode = ref<"months" | "weeks" | "days">("months");

// Tooltip state
const showTooltip = ref(false);
const tooltipContent = ref("");
const tooltipStyle = ref({
  left: "0px",
  top: "0px",
});

// Day width based on zoom level - the core calculation unit
const dayWidth = computed(() => {
  if (viewMode.value === "months") {
    return containerWidth.value / (12 * 30);
  } else if (viewMode.value === "weeks") {
    return containerWidth.value / (10 * 7);
  } else {
    return containerWidth.value / 30;
  }
});

// Drag state
const isDragging = ref(false);
const dragType = ref<ResizeType>(null);
const activeItemIndex = ref<number | null>(null);
const initialMouseX = ref(0);
const initialItemWidth = ref(0);
const initialItemStartPx = ref(0);

// Active item style
const activeItemStyle = ref({
  left: "0px",
  width: "0px",
});

// Track the actual day positions for exact snapping
const currentStartDay = ref(0);
const currentDurationDays = ref(0);

// Date calculations
const availableYears = computed(() => {
  const years = new Set<number>();
  years.add(new Date().getFullYear());

  props.items.forEach((item) => {
    if (item.startDate) years.add(item.startDate.getFullYear());
    if (item.endDate) years.add(item.endDate.getFullYear());
  });

  return Array.from(years).sort();
});

const filteredItems = computed(() => {
  return props.items.filter((item) => {
    const startYear = item.startDate.getFullYear();
    const endYear = item.endDate.getFullYear();
    return startYear <= selectedYear.value && endYear >= selectedYear.value;
  });
});

// Calculate days in the selected year
const daysInYear = computed(() => {
  const startOfYear = new Date(selectedYear.value, 0, 1);
  const endOfYear = new Date(selectedYear.value, 11, 31, 23, 59, 59);
  return (
    Math.ceil(
      (endOfYear.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1
  );
});

// Total time units to display
const totalTimeUnits = computed(() => {
  if (viewMode.value === "months") return 12;
  if (viewMode.value === "weeks") return Math.ceil(daysInYear.value / 7);
  return daysInYear.value;
});

// Calculate the width of the timeline
const timelineWidth = computed(() => {
  if (viewMode.value === "months") return containerWidth.value;

  const calculatedWidth = dayWidth.value * daysInYear.value;
  return Math.max(containerWidth.value, calculatedWidth);
});

const computedObjectives = computed(() => {
  return filteredItems.value.map(computeDateBasedPosition);
});

function computeDateBasedPosition(item: Item): ComputedItem {
  const yearStart = new Date(selectedYear.value, 0, 1);
  const yearEnd = new Date(selectedYear.value, 11, 31, 23, 59, 59);

  // Clamp dates to year boundaries
  const effectiveStartDate =
    item.startDate < yearStart ? yearStart : new Date(item.startDate);
  effectiveStartDate.setHours(0, 0, 0, 0);

  const effectiveEndDate =
    item.endDate > yearEnd ? yearEnd : new Date(item.endDate);
  effectiveEndDate.setHours(23, 59, 59, 999);

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

  let left, width;

  if (viewMode.value === "months") {
    left = getExactPositionForDay(daysFromYearStartToItemStart);

    // Use the exact end day position without the extra dayWidth adjustment
    const endPosition = getExactPositionForDay(daysFromYearStartToItemEnd);
    width = Math.max(4, endPosition - left);
  } else {
    left = daysFromYearStartToItemStart * dayWidth.value;
    width = durationInDays * dayWidth.value;
  }

  return {
    ...item,
    start: daysFromYearStartToItemStart,
    width,
    durationDays: durationInDays,
    left: `${left}px`,
    style: {
      left: `${left}px`,
      width: `${width}px`,
    },
  };
}

// Helper function to get precise position for a day in month view
function getExactPositionForDay(dayOfYear: number): number {
  if (viewMode.value !== "months") {
    return dayOfYear * dayWidth.value;
  }

  const yearStart = new Date(selectedYear.value, 0, 1);
  const date = new Date(yearStart);
  date.setDate(yearStart.getDate() + dayOfYear);

  // Calculate position based on month and day
  const month = date.getMonth();
  const day = date.getDate() - 1; // 0-based day within month

  // Calculate the width of each month (proportional to days in month)
  let position = 0;
  for (let i = 0; i < month; i++) {
    const lastDay = new Date(selectedYear.value, i + 1, 0).getDate();
    position += (lastDay / daysInYear.value) * containerWidth.value;
  }

  // Add position within current month
  const lastDayInMonth = new Date(selectedYear.value, month + 1, 0).getDate();
  position +=
    (day / lastDayInMonth) *
    ((lastDayInMonth / daysInYear.value) * containerWidth.value);

  return position;
}

// Time labels computed property
const timeLabels = computed(() => {
  const labels = [];
  const yearStart = new Date(selectedYear.value, 0, 1);

  if (viewMode.value === "months") {
    // Calculate month widths based on actual days in each month
    let totalDaysInYear = daysInYear.value;

    for (let i = 0; i < 12; i++) {
      const date = new Date(selectedYear.value, i, 1);
      const lastDay = new Date(selectedYear.value, i + 1, 0).getDate();
      const monthWidth = Math.round(
        (lastDay / totalDaysInYear) * containerWidth.value,
      );

      labels.push({
        text: date.toLocaleString("default", {
          month: "short",
          year: "2-digit",
        }),
        width: monthWidth,
      });
    }

    // Ensure the total width matches container exactly
    let totalWidth = labels.reduce((sum, label) => sum + label.width, 0);
    if (totalWidth !== containerWidth.value) {
      labels[11].width += containerWidth.value - totalWidth;
    }
  } else if (viewMode.value === "weeks") {
    const startDate = new Date(yearStart);
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
      labels.push({
        text: `W${weekNum} (${date.toLocaleString("default", {
          month: "short",
        })})`,
        width: 7 * dayWidth.value,
      });
    }
  } else {
    // Daily labels
    for (let i = 0; i < daysInYear.value; i++) {
      const date = new Date(yearStart);
      date.setDate(yearStart.getDate() + i);
      labels.push({
        text: date.toLocaleString("default", {
          day: "numeric",
          month: "short",
        }),
        width: dayWidth.value,
      });
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
  const leftPx = parseFloat(item.style.left);
  const widthPx = parseFloat(item.style.width);

  initialItemWidth.value = widthPx;
  initialItemStartPx.value = leftPx;

  // Set initial values for tracking
  currentStartDay.value = Math.floor(leftPx / dayWidth.value);
  currentDurationDays.value = Math.ceil(widthPx / dayWidth.value);

  // Set initial active item style
  activeItemStyle.value = {
    left: `${leftPx}px`,
    width: `${widthPx}px`,
  };

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

  updateTooltipPosition(event);
}

function handleEndResize(deltaX: number) {
  if (activeItemIndex.value === null) return;
  const item = computedObjectives.value[activeItemIndex.value];

  // Calculate the raw changed width in pixels
  const rawNewWidthPx = Math.max(
    dayWidth.value,
    initialItemWidth.value + deltaX,
  );

  // Get the start position in days
  const startDayPosition = item.start;

  // Calculate width in days - ceil for consistent full-day snapping
  const widthInDays = rawNewWidthPx / dayWidth.value;
  const roundedDays = Math.ceil(widthInDays);

  // Calculate the new end day
  const endDayPosition = startDayPosition + roundedDays - 1;

  // Store exact day positions
  currentStartDay.value = startDayPosition;
  currentDurationDays.value = roundedDays;

  if (viewMode.value === "months") {
    const startPx = getExactPositionForDay(startDayPosition);
    const endPx = getExactPositionForDay(endDayPosition);
    // Remove the additional dayWidth adjustment to match computeDateBasedPosition
    const newWidth = Math.max(4, endPx - startPx);
    updateItemStyle(startPx, newWidth);
  } else {
    const startPx = startDayPosition * dayWidth.value;
    const widthPx = roundedDays * dayWidth.value;
    updateItemStyle(startPx, widthPx);
  }

  // Create end date with same method as updateDateBasedItem
  const yearStart = getYearStart(selectedYear.value);
  const exactEndDate = createDateAtDay(yearStart, endDayPosition, true);

  tooltipContent.value = `End: ${exactEndDate.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  })}`;
  showTooltip.value = true;
}

function handleStartResize(deltaX: number) {
  if (activeItemIndex.value === null) return;
  const item = computedObjectives.value[activeItemIndex.value];

  // Calculate the raw changed start position in pixels
  const rawNewStartPx = Math.max(0, initialItemStartPx.value + deltaX);

  // Calculate position in days
  let newStartDay;
  if (viewMode.value === "months") {
    newStartDay = findClosestDayForPosition(rawNewStartPx);
  } else {
    newStartDay = Math.floor(rawNewStartPx / dayWidth.value);
  }

  // Get the end day (keep the original end date)
  const endDay = item.start + item.durationDays - 1;

  // Calculate new duration
  const newDuration = Math.max(1, endDay - newStartDay + 1);

  // Store exact day positions
  currentStartDay.value = newStartDay;
  currentDurationDays.value = newDuration;

  if (viewMode.value === "months") {
    const startPx = getExactPositionForDay(newStartDay);
    const endPx = getExactPositionForDay(endDay);
    // Remove the additional dayWidth adjustment
    const newWidth = Math.max(4, endPx - startPx);
    updateItemStyle(startPx, newWidth);
  } else {
    const startPx = newStartDay * dayWidth.value;
    const widthPx = newDuration * dayWidth.value;
    updateItemStyle(startPx, widthPx);
  }

  // Calculate exact dates
  const yearStart = getYearStart(selectedYear.value);
  const exactStartDate = createDateAtDay(yearStart, newStartDay);

  tooltipContent.value = `Start: ${exactStartDate.toLocaleDateString(
    undefined,
    {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  )}`;
  showTooltip.value = true;
}

function handleMove(deltaX: number) {
  if (activeItemIndex.value === null) return;
  const item = computedObjectives.value[activeItemIndex.value];

  // Calculate raw new position
  const rawNewStartPx = Math.max(0, initialItemStartPx.value + deltaX);

  // Find the closest day for the new position
  let newStartDay;
  if (viewMode.value === "months") {
    newStartDay = findClosestDayForPosition(rawNewStartPx);
  } else {
    newStartDay = Math.floor(rawNewStartPx / dayWidth.value);
  }

  // Calculate new end day (keeping the same duration)
  const newEndDay = newStartDay + item.durationDays - 1;

  // Store exact day positions
  currentStartDay.value = newStartDay;
  currentDurationDays.value = item.durationDays;

  if (viewMode.value === "months") {
    const startPx = getExactPositionForDay(newStartDay);
    const endPx = getExactPositionForDay(newEndDay);
    // Remove the additional dayWidth adjustment
    const width = Math.max(4, endPx - startPx);
    updateItemStyle(startPx, width);
  } else {
    const startPx = newStartDay * dayWidth.value;
    const widthPx = item.durationDays * dayWidth.value;
    updateItemStyle(startPx, widthPx);
  }

  // Calculate exact dates
  const yearStart = getYearStart(selectedYear.value);
  const startDate = createDateAtDay(yearStart, newStartDay);
  const endDate = createDateAtDay(yearStart, newEndDay, true);

  tooltipContent.value = `${startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
  showTooltip.value = true;
}

// Helper function to find the closest day for a given pixel position
function findClosestDayForPosition(positionPx: number): number {
  if (viewMode.value !== "months") {
    return Math.floor(positionPx / dayWidth.value);
  }

  // Optimization: narrow down the search by month first
  let monthStart = 0;
  for (let month = 0; month < 12; month++) {
    // Calculate month width
    const lastDay = new Date(selectedYear.value, month + 1, 0).getDate();
    const monthWidth = (lastDay / daysInYear.value) * containerWidth.value;
    const monthEnd = monthStart + monthWidth;

    // Check if position is in this month
    if (positionPx >= monthStart && positionPx <= monthEnd) {
      // Calculate day within month
      const dayRatio = (positionPx - monthStart) / monthWidth;
      const dayInMonth = Math.floor(dayRatio * lastDay);

      // Get actual day of year
      const date = new Date(selectedYear.value, month, dayInMonth + 1);
      const yearStart = new Date(selectedYear.value, 0, 1);
      return Math.floor(
        (date.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000),
      );
    }

    monthStart = monthEnd;
  }

  return 0; // Fallback to first day of year
}

function updateItemStyle(leftPx: number, widthPx: number) {
  if (activeItemIndex.value === null) return;

  // Update reactive style object
  activeItemStyle.value = {
    left: `${leftPx}px`,
    width: `${widthPx}px`,
  };
}

function updateDateBasedItem(
  item: Item,
  newStartPosition: number,
  newDurationDays: number,
) {
  const yearStart = getYearStart(selectedYear.value);

  // Ensure we use the exact same position calculation as during dragging
  const startPositionInDays = newStartPosition;
  const durationInDays = Math.max(1, newDurationDays);

  // Create precise start and end dates
  item.startDate = createDateAtDay(yearStart, startPositionInDays);
  item.endDate = createDateAtDay(
    yearStart,
    startPositionInDays + durationInDays - 1,
    true,
  );
}

function onMouseUp() {
  if (!isDragging.value || activeItemIndex.value === null) return;

  // Hide tooltip
  showTooltip.value = false;

  // Get the original item from filtered items
  const filteredItem = filteredItems.value[activeItemIndex.value];
  const originalItemIndex = props.items.findIndex(
    (item) =>
      filteredItem.title === item.title &&
      ("id" in filteredItem && "id" in item
        ? filteredItem.id === item.id
        : true),
  );

  if (originalItemIndex === -1) {
    resetDragState();
    return;
  }

  const originalItem = props.items[originalItemIndex];
  const resizedItem = { ...originalItem };

  const newStartPosition = Math.floor(currentStartDay.value);
  const newDurationDays = currentDurationDays.value;

  // Ensure we have valid numbers
  if (isNaN(newStartPosition) || isNaN(newDurationDays)) {
    resetDragState();
    return;
  }

  updateDateBasedItem(resizedItem, newStartPosition, newDurationDays);

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
  showTooltip.value = false;
}

function updateTooltipPosition(event: MouseEvent) {
  tooltipStyle.value = {
    left: `${event.clientX + 10}px`,
    top: `${event.clientY - 30}px`,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Date utility functions
function getYearStart(year: number): Date {
  const date = new Date(year, 0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function createDateAtDay(
  yearStart: Date,
  dayOffset: number,
  isEndDate = false,
): Date {
  const date = new Date(yearStart);
  date.setDate(yearStart.getDate() + dayOffset);

  if (isEndDate) {
    date.setHours(23, 59, 59, 999); // End of day for end dates
  } else {
    date.setHours(0, 0, 0, 0); // Start of day for start dates
  }

  return date;
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
            @click="
              viewMode = 'months';
              onViewModeChange();
            "
          >
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
            @click="
              viewMode = 'weeks';
              onViewModeChange();
            "
          >
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
            @click="
              viewMode = 'days';
              onViewModeChange();
            "
          >
            Daily
          </button>
        </div>
      </div>
    </div>

    <div ref="containerRef" class="w-full overflow-x-auto overflow-y-hidden">
      <!-- Timeline header -->
      <div
        class="flex h-10 border-b border-gray-200 bg-white"
        :style="{
          width: viewMode === 'months' ? '100%' : `${timelineWidth}px`,
        }"
      >
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
          :style="{ width: `${label.width}px` }"
        >
          {{ label.text }}
        </div>
      </div>

      <!-- Objectives -->
      <div
        class="relative mt-4"
        :style="{
          minHeight: `${computedObjectives.length * 48 + 16}px`,
          width: viewMode === 'months' ? '100%' : `${timelineWidth}px`,
        }"
      >
        <div
          v-for="(objective, index) in computedObjectives"
          :key="objective.title"
          class="relative mb-4 h-12"
        >
          <div
            class="absolute flex h-full items-center rounded-lg border border-sky-200 bg-sky-50 px-3 transition-all hover:bg-sky-100 gantt-item cursor-move"
            :style="
              index === activeItemIndex ? activeItemStyle : objective.style
            "
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

            <div class="flex flex-col overflow-hidden">
              <span class="truncate text-sm font-medium text-primary">
                {{ objective.title }}
              </span>
              <span class="truncate text-xs text-gray-500">
                {{ formatDate(objective.startDate) }} -
                {{ formatDate(objective.endDate) }}
              </span>
            </div>

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

    <!-- Date tooltip -->
    <div
      v-if="showTooltip"
      class="fixed z-50 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg pointer-events-none"
      :style="tooltipStyle"
    >
      {{ tooltipContent }}
    </div>
  </div>
</template>
