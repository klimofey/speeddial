export const MAX_SPAN = 4;
export const RESIZE_STEP_PX = 80;

export function clampSpan(value: number, max = MAX_SPAN): number {
  return Math.max(1, Math.min(Math.round(value), max));
}

export function spanFromDelta(current: number, deltaPx: number, max = MAX_SPAN): number {
  return clampSpan(current + Math.round(deltaPx / RESIZE_STEP_PX), max);
}
