// Components
import Gantt from './components/Gantt.vue'

// Types
import type {
  Item as GanttItem,
  ComputedItem,
  ViewMode,
  ResizeType,
  TimeLabel,
  TooltipState,
} from './types/types'

// Export only Gantt component
export { Gantt }

// Export types
export type {
  GanttItem,
  ComputedItem,
  ViewMode,
  ResizeType,
  TimeLabel,
  TooltipState,
}

// Default export
export default Gantt
