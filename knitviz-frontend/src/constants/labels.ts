export const STATUS_LABELS = {
  PREPARING: 'Preparing',
  READY: 'Ready',
  IDLE: 'Idle',
  STOPPING: 'Stopping Simulation...',
  UNAVAILABLE: 'Simulation unavailable',
  START: 'Start Simulation',
  STOP: 'Stop Simulation',
} as const;

export const BUTTON_LABELS = {
  GENERATE_FROM_CODE: 'Generate from Code',
  GENERATE_FROM_GRID: 'Generate from Grid',
  GENERATE_FROM_VISUAL: 'Generate from Visual',
  APPLY_NODE_CHANGES: 'Apply Node Changes',
  SHOW_PREVIEW: 'Show Preview',
  HIDE_PREVIEW: 'Hide Preview',
} as const;
