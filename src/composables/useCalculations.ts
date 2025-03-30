import { computed } from 'vue'
import type { Ref } from 'vue'
import type { ComputedItem, Item, TimeLabel, ViewMode } from '../types/types'

export function useCalculations(
  containerWidth: Ref<number>,
  selectedYear: Ref<number>,
  viewMode: Ref<ViewMode>,
  items: Ref<Item[]>,
) {
  // Cache for day position calculations
  const dayPositionCache = new Map<number, number>()

  // Calculate days in the selected year
  const daysInYear = computed(() => {
    const startOfYear = new Date(selectedYear.value, 0, 1)
    const endOfYear = new Date(selectedYear.value, 11, 31, 23, 59, 59)
    return (
      Math.ceil(
        (endOfYear.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1
    )
  })

  // Day width based on view mode - the core calculation unit
  const dayWidth = computed(() => {
    switch (viewMode.value) {
      case 'months':
        return containerWidth.value / (12 * 30)
      case 'weeks':
        return containerWidth.value / (10 * 7)
      default:
        return containerWidth.value / 30
    }
  })

  // Total time units to display based on view mode
  const totalTimeUnits = computed(() => {
    if (viewMode.value === 'months') return 12
    if (viewMode.value === 'weeks') return Math.ceil(daysInYear.value / 7)
    return daysInYear.value
  })

  // Calculate the width of the timeline
  const timelineWidth = computed(() => {
    if (viewMode.value === 'months') return containerWidth.value

    const calculatedWidth = dayWidth.value * daysInYear.value
    return Math.max(containerWidth.value, calculatedWidth)
  })

  // Filter items for the selected year
  const filteredItems = computed(() => {
    return items.value.filter((item) => {
      const startYear = item.startDate.getFullYear()
      const endYear = item.endDate.getFullYear()
      return startYear <= selectedYear.value && endYear >= selectedYear.value
    })
  })

  // Get unique available years from all items
  const availableYears = computed(() => {
    const years = new Set<number>()
    years.add(new Date().getFullYear())

    items.value.forEach((item) => {
      if (item.startDate) years.add(item.startDate.getFullYear())
      if (item.endDate) years.add(item.endDate.getFullYear())
    })

    return Array.from(years).sort()
  })

  // Get the start of a specific year
  function getYearStart(year: number): Date {
    const date = new Date(year, 0, 1)
    date.setHours(0, 0, 0, 0)
    return date
  }

  // Create a date at a specific day offset from year start
  function createDateAtDay(
    yearStart: Date,
    dayOffset: number,
    isEndDate = false,
  ): Date {
    const date = new Date(yearStart)
    date.setDate(yearStart.getDate() + dayOffset)

    if (isEndDate) {
      date.setHours(23, 59, 59, 999) // End of day for end dates
    } else {
      date.setHours(0, 0, 0, 0) // Start of day for start dates
    }

    return date
  }

  // Format date to a readable string
  function formatDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  // Get precise position for a day in month view
  function getExactPositionForDay(dayOfYear: number): number {
    if (viewMode.value !== 'months') {
      return dayOfYear * dayWidth.value
    }

    // Check cache first
    const cacheKey = dayOfYear
    if (dayPositionCache.has(cacheKey)) {
      return dayPositionCache.get(cacheKey)!
    }

    const yearStart = new Date(selectedYear.value, 0, 1)
    const date = new Date(yearStart)
    date.setDate(yearStart.getDate() + dayOfYear)

    // Calculate position based on month and day
    const month = date.getMonth()
    const day = date.getDate() - 1 // 0-based day within month

    // Calculate the width of each month (proportional to days in month)
    let position = 0
    for (let i = 0; i < month; i++) {
      const lastDay = new Date(selectedYear.value, i + 1, 0).getDate()
      position += (lastDay / daysInYear.value) * containerWidth.value
    }

    // Add position within current month
    const lastDayInMonth = new Date(selectedYear.value, month + 1, 0).getDate()
    position +=
      (day / lastDayInMonth) *
      ((lastDayInMonth / daysInYear.value) * containerWidth.value)

    // Cache the result
    dayPositionCache.set(cacheKey, position)
    return position
  }

  // Calculate position and width for an item based on its dates
  function computeDateBasedPosition(item: Item): ComputedItem {
    const yearStart = new Date(selectedYear.value, 0, 1)
    const yearEnd = new Date(selectedYear.value, 11, 31, 23, 59, 59)

    // Clamp dates to year boundaries
    const effectiveStartDate =
      item.startDate < yearStart ? yearStart : new Date(item.startDate)
    effectiveStartDate.setHours(0, 0, 0, 0)

    const effectiveEndDate =
      item.endDate > yearEnd ? yearEnd : new Date(item.endDate)
    effectiveEndDate.setHours(23, 59, 59, 999)

    // Calculate absolute days from year start for positioning
    const daysFromYearStartToItemStart = Math.max(
      0,
      Math.floor(
        (effectiveStartDate.getTime() - yearStart.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    )
    const daysFromYearStartToItemEnd = Math.floor(
      (effectiveEndDate.getTime() - yearStart.getTime()) /
        (24 * 60 * 60 * 1000),
    )

    // Calculate absolute item duration in days
    const durationInDays = Math.max(
      1,
      daysFromYearStartToItemEnd - daysFromYearStartToItemStart + 1,
    )

    let left, width

    if (viewMode.value === 'months') {
      left = getExactPositionForDay(daysFromYearStartToItemStart)
      const endPosition = getExactPositionForDay(daysFromYearStartToItemEnd)
      width = Math.max(4, endPosition - left)
    } else {
      left = daysFromYearStartToItemStart * dayWidth.value
      width = durationInDays * dayWidth.value
    }

    return {
      ...item,
      start: daysFromYearStartToItemStart,
      width,
      durationDays: durationInDays,
      left: `${left}px`,
      style: {
        transform: `translateX(${left}px)`,
        width: `${width}px`,
      },
    }
  }

  // Generate time labels based on view mode
  const timeLabels = computed((): TimeLabel[] => {
    const labels: TimeLabel[] = []
    const yearStart = new Date(selectedYear.value, 0, 1)

    if (viewMode.value === 'months') {
      generateMonthLabels(labels)
    } else if (viewMode.value === 'weeks') {
      generateWeekLabels(labels, yearStart)
    } else {
      generateDayLabels(labels, yearStart)
    }

    return labels
  })

  // Generate month labels
  function generateMonthLabels(labels: TimeLabel[]): void {
    const totalDaysInYear = daysInYear.value

    for (let i = 0; i < 12; i++) {
      const date = new Date(selectedYear.value, i, 1)
      const lastDay = new Date(selectedYear.value, i + 1, 0).getDate()
      const monthWidth = Math.round(
        (lastDay / totalDaysInYear) * containerWidth.value,
      )

      labels.push({
        text: date.toLocaleString('default', {
          month: 'short',
          year: '2-digit',
        }),
        width: monthWidth,
      })
    }

    // Ensure the total width matches container exactly
    const totalWidth = labels.reduce((sum, label) => sum + label.width, 0)
    if (totalWidth !== containerWidth.value) {
      labels[11].width += containerWidth.value - totalWidth
    }
  }

  // Generate week labels
  function generateWeekLabels(labels: TimeLabel[], yearStart: Date): void {
    const startDate = new Date(yearStart)
    // Set to the first day of the week
    const day = startDate.getDay()
    startDate.setDate(startDate.getDate() - day)

    for (let i = 0; i < totalTimeUnits.value; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i * 7)

      // Format as "Week N (MMM)"
      const weekNum = Math.ceil(
        (date.getDate() +
          new Date(date.getFullYear(), date.getMonth(), 1).getDay()) /
          7,
      )
      labels.push({
        text: `W${weekNum} (${date.toLocaleString('default', {
          month: 'short',
        })})`,
        width: 7 * dayWidth.value,
      })
    }
  }

  // Generate day labels
  function generateDayLabels(labels: TimeLabel[], yearStart: Date): void {
    for (let i = 0; i < daysInYear.value; i++) {
      const date = new Date(yearStart)
      date.setDate(yearStart.getDate() + i)
      labels.push({
        text: date.toLocaleString('default', {
          day: 'numeric',
          month: 'short',
        }),
        width: dayWidth.value,
      })
    }
  }

  // Clear position cache
  function clearCache(): void {
    dayPositionCache.clear()
  }

  // Convert pixels to days based on view mode
  function pixelsToDays(pixels: number): number {
    return Math.round(pixels / dayWidth.value)
  }

  // Convert days to pixels based on view mode
  function daysToPixels(days: number): number {
    return days * dayWidth.value
  }

  return {
    daysInYear,
    dayWidth,
    totalTimeUnits,
    timelineWidth,
    filteredItems,
    availableYears,
    getExactPositionForDay,
    computeDateBasedPosition,
    timeLabels,
    getYearStart,
    createDateAtDay,
    formatDate,
    clearCache,
    pixelsToDays,
    daysToPixels,
  }
}
