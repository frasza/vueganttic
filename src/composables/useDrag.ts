import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Item, ResizeType, TooltipState } from '../types/types'

export function useDrag(
  selectedYear: Ref<number>,
  getYearStart: (year: number) => Date,
  createDateAtDay: (
    yearStart: Date,
    dayOffset: number,
    isEndDate?: boolean,
  ) => Date,
  pixelsToDays: (pixels: number) => number,
) {
  const isDragging = ref(false)
  const dragType = ref<ResizeType>(null)
  const activeItemIndex = ref<number | null>(null)
  const initialMouseX = ref(0)
  const initialItemWidth = ref(0)
  const initialItemStartPx = ref(0)
  const initialStartDay = ref(0)
  const initialEndDay = ref(0)

  const rafId = ref<number | null>(null)
  const lastProcessedX = ref(0)
  const throttleDistance = 1 // Reduced to make movements more immediate
  const isFirstDragMovement = ref(true)

  const activeItemStyle = ref({
    transform: 'translate(0px)',
    width: '0px',
  })
  const activeGanttItemRef = ref<HTMLElement | null>(null)

  const currentStartDay = ref(0)
  const currentDurationDays = ref(0)

  const tooltipState = ref<TooltipState>({
    show: false,
    content: '',
    style: {
      left: '0px',
      top: '0px',
    },
  })

  function startResize(
    event: MouseEvent,
    type: ResizeType,
    index: number,
    item: any,
  ) {
    event.preventDefault()
    event.stopPropagation()

    isDragging.value = true
    dragType.value = type
    activeItemIndex.value = index
    initialMouseX.value = event.clientX
    isFirstDragMovement.value = true
    lastProcessedX.value = event.clientX

    // Get reference to the DOM element
    const target = event.currentTarget as HTMLElement
    if (target && target.parentElement) {
      activeGanttItemRef.value = target.parentElement
      activeGanttItemRef.value.classList.add('active-drag')
    }

    // Store initial values exactly as they are
    initialItemWidth.value = item.width
    initialItemStartPx.value = parseFloat(item.left.replace('px', ''))
    initialStartDay.value = item.start
    initialEndDay.value = item.start + item.durationDays - 1

    // Set initial tracking values
    currentStartDay.value = item.start
    currentDurationDays.value = item.durationDays

    // Copy the style values exactly
    activeItemStyle.value = {
      transform: item.style.transform,
      width: item.style.width,
    }

    // Initialize tooltip
    tooltipState.value.show = true
    const yearStart = getYearStart(selectedYear.value)

    if (type === 'start') {
      const startDate = createDateAtDay(yearStart, item.start)
      tooltipState.value.content = `Start: ${startDate.toLocaleDateString(
        undefined,
        {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
      )}`
    } else if (type === 'end') {
      const endDate = createDateAtDay(yearStart, initialEndDay.value, true)
      tooltipState.value.content = `End: ${endDate.toLocaleDateString(
        undefined,
        {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
      )}`
    } else {
      const startDate = createDateAtDay(yearStart, item.start)
      const endDate = createDateAtDay(yearStart, initialEndDay.value, true)
      tooltipState.value.content = `${startDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} - ${endDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    }

    updateTooltipPosition(event)
    document.body.style.userSelect = 'none'
  }

  function handleEndResizePixels(deltaX: number) {
    if (activeItemIndex.value === null) return

    // Calculate new width in pixels
    const newWidth = Math.max(4, initialItemWidth.value + deltaX)

    // Calculate the change in days
    const oldEndPx = initialItemStartPx.value + initialItemWidth.value
    const newEndPx = initialItemStartPx.value + newWidth

    // Update the DOM element style
    updateItemStylePixels(initialItemStartPx.value, newWidth)

    // Update tooltip
    if (tooltipState.value.show) {
      const yearStart = getYearStart(selectedYear.value)
      // Calculate the day offset from year start
      const dayOffset = initialEndDay.value + pixelsToDays(newEndPx - oldEndPx)
      const endDate = createDateAtDay(yearStart, dayOffset, true)

      tooltipState.value.content = `End: ${endDate.toLocaleDateString(
        undefined,
        {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
      )}`
    }
  }

  function handleStartResizePixels(deltaX: number) {
    if (activeItemIndex.value === null) return

    // Make sure we don't resize past the end
    const maxDeltaX = initialItemWidth.value - 4 // Minimum width of 4px
    const limitedDeltaX = Math.min(deltaX, maxDeltaX)

    // Calculate new left and width
    const newLeft = initialItemStartPx.value + limitedDeltaX
    const newWidth = initialItemWidth.value - limitedDeltaX

    // Update DOM element style
    updateItemStylePixels(newLeft, newWidth)

    // Update tooltip
    if (tooltipState.value.show) {
      const yearStart = getYearStart(selectedYear.value)
      // Calculate the day offset from year start
      const dayOffset = initialStartDay.value + pixelsToDays(limitedDeltaX)
      const startDate = createDateAtDay(yearStart, dayOffset)

      tooltipState.value.content = `Start: ${startDate.toLocaleDateString(
        undefined,
        {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
      )}`
    }
  }

  function handleMovePixels(deltaX: number) {
    if (activeItemIndex.value === null) return

    // Calculate new left, ensuring it doesn't go negative
    const newLeft = Math.max(0, initialItemStartPx.value + deltaX)

    // Update DOM element style
    updateItemStylePixels(newLeft, initialItemWidth.value)

    // Update tooltip
    if (tooltipState.value.show) {
      const yearStart = getYearStart(selectedYear.value)

      // Calculate day change
      const dayDelta = pixelsToDays(deltaX)
      const startDayOffset = initialStartDay.value + dayDelta
      const endDayOffset = initialEndDay.value + dayDelta

      const startDate = createDateAtDay(yearStart, startDayOffset)
      const endDate = createDateAtDay(yearStart, endDayOffset, true)

      tooltipState.value.content = `${startDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} - ${endDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    }
  }

  function updateItemStylePixels(leftPx: number, widthPx: number) {
    if (activeItemIndex.value === null) return

    // Directly apply transform without animation frames for more immediate feedback
    const transform = `translateX(${leftPx}px)`
    const width = `${widthPx}px`

    activeItemStyle.value = {
      transform,
      width,
    }
  }

  function onMouseMove(event: MouseEvent) {
    if (!isDragging.value || activeItemIndex.value === null) return

    // Cancel any existing animation frame
    if (rafId.value !== null) {
      cancelAnimationFrame(rafId.value)
    }

    // Skip if the mouse hasn't moved enough since last processed position
    if (Math.abs(event.clientX - lastProcessedX.value) < throttleDistance) {
      return
    }

    // Process immediately for better responsiveness
    const deltaX = event.clientX - initialMouseX.value
    lastProcessedX.value = event.clientX

    // Skip tiny movements to prevent jumps
    if (Math.abs(deltaX) < 2 && isFirstDragMovement.value) {
      return
    }

    isFirstDragMovement.value = false

    // During drag, just use pixels directly - much faster
    // We'll convert to days only at the end
    if (dragType.value === 'start') {
      handleStartResizePixels(deltaX)
    } else if (dragType.value === 'end') {
      handleEndResizePixels(deltaX)
    } else if (dragType.value === 'move') {
      handleMovePixels(deltaX)
    }

    updateTooltipPosition(event)
  }

  function onMouseUp(
    event: MouseEvent,
    filteredItems: any[],
    originalItems: Item[],
    emit: any,
  ) {
    if (!isDragging.value || activeItemIndex.value === null) return

    // Hide tooltip
    tooltipState.value.show = false

    // Get the original item from filtered items
    const filteredItem = filteredItems[activeItemIndex.value]
    const originalItemIndex = originalItems.findIndex(
      (item) =>
        filteredItem.title === item.title &&
        ('id' in filteredItem && 'id' in item
          ? filteredItem.id === item.id
          : true),
    )

    if (originalItemIndex === -1) {
      resetDragState()
      return
    }

    const originalItem = originalItems[originalItemIndex]

    // Check if there was any actual dragging/resizing
    const initialMousePosition = initialMouseX.value
    const hadActualDrag =
      !isFirstDragMovement.value &&
      Math.abs(event.clientX - initialMousePosition) > 3

    // If it was just a click without drag, don't update dates
    if (!hadActualDrag) {
      // This was actually a click, emit select event
      emit('select', originalItem)
      resetDragState()
      return
    }

    // Calculate the final date changes based on the type of drag
    const yearStart = getYearStart(selectedYear.value)
    const deltaX = event.clientX - initialMouseX.value

    // Create a new item with updated dates
    const updatedItem = { ...originalItem }

    if (dragType.value === 'start') {
      // Get the change in days for the start date
      const limitedDeltaX = Math.min(deltaX, initialItemWidth.value - 4)
      const dayDelta = pixelsToDays(limitedDeltaX)

      // Calculate new start date
      const newStartDate = createDateAtDay(
        yearStart,
        initialStartDay.value + dayDelta,
      )
      updatedItem.startDate = newStartDate
      // End date stays the same
    } else if (dragType.value === 'end') {
      // Calculate new end date based on width change
      const newWidth = initialItemWidth.value + deltaX
      const oldEndPx = initialItemStartPx.value + initialItemWidth.value
      const newEndPx = initialItemStartPx.value + Math.max(4, newWidth)
      const dayDelta = pixelsToDays(newEndPx - oldEndPx)

      const newEndDate = createDateAtDay(
        yearStart,
        initialEndDay.value + dayDelta,
        true,
      )
      updatedItem.endDate = newEndDate
      // Start date stays the same
    } else {
      // move
      // Get the change in days for both dates
      const dayDelta = pixelsToDays(deltaX)

      // Update both dates by the same number of days
      updatedItem.startDate = createDateAtDay(
        yearStart,
        initialStartDay.value + dayDelta,
      )
      updatedItem.endDate = createDateAtDay(
        yearStart,
        initialEndDay.value + dayDelta,
        true,
      )
    }

    // Emit the updated item
    emit('update:item', updatedItem)

    // Emit the appropriate event based on the drag type
    if (dragType.value === 'move') {
      emit('move', updatedItem)
    } else if (dragType.value === 'start' || dragType.value === 'end') {
      emit('resize', updatedItem)
    }

    // Reset drag state
    resetDragState()
  }

  function resetDragState() {
    isDragging.value = false
    dragType.value = null
    activeItemIndex.value = null
    document.body.style.userSelect = ''
    tooltipState.value.show = false
    isFirstDragMovement.value = true

    // Remove active-drag class
    if (activeGanttItemRef.value) {
      activeGanttItemRef.value.classList.remove('active-drag')
      activeGanttItemRef.value = null
    }

    // Cancel any pending animation frames
    if (rafId.value !== null) {
      cancelAnimationFrame(rafId.value)
      rafId.value = null
    }
  }

  function updateTooltipPosition(event: MouseEvent) {
    // Only update if tooltip is visible
    if (!tooltipState.value.show) return

    const newLeft = `${event.clientX + 10}px`
    const newTop = `${event.clientY - 30}px`

    // Only update if position has changed
    if (
      tooltipState.value.style.left !== newLeft ||
      tooltipState.value.style.top !== newTop
    ) {
      tooltipState.value.style = {
        left: newLeft,
        top: newTop,
      }
    }
  }

  return {
    isDragging,
    dragType,
    activeItemIndex,
    activeItemStyle,
    tooltipState,
    startResize,
    onMouseMove,
    onMouseUp,
    resetDragState,
  }
}
