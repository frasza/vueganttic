export interface Item {
  title: string
  id?: string
  startDate: Date
  endDate: Date
}

export interface ComputedItem extends Item {
  start: number
  width: number
  durationDays: number
  left: string
  style: {
    transform: string
    width: string
  }
}

export type ViewMode = 'months' | 'weeks' | 'days'
export type ResizeType = 'start' | 'end' | 'move' | null

export interface TimeLabel {
  text: string
  width: number
}

export interface TooltipState {
  show: boolean
  content: string
  style: {
    left: string
    top: string
  }
}
