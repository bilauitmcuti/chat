/** Pure helper for reasoning panel auto-collapse scheduling. */
export function shouldScheduleAutoCollapse(input: {
  collapsible: boolean;
  collapseWhen: boolean;
  prevCollapseWhen: boolean;
  isOpen: boolean;
  hasCollapsedAfterAnswer: boolean;
  userOpenedManually: boolean;
}): boolean {
  const risingEdge = input.collapseWhen && !input.prevCollapseWhen;
  if (!input.collapsible) return false;
  if (!risingEdge) return false;
  if (!input.isOpen) return false;
  if (input.hasCollapsedAfterAnswer) return false;
  if (input.userOpenedManually) return false;
  return true;
}
