type Control = { ownerId: string; controller: AbortController; cancelled: boolean };
const controls = new Map<string, Control>();

export function startRunControl(runId: string, ownerId: string) {
  const control = { ownerId, controller: new AbortController(), cancelled: false };
  controls.set(runId, control);
  return control.controller.signal;
}

export function getRunSignal(runId: string) {
  return controls.get(runId)?.controller.signal;
}

export function cancelRun(runId: string, ownerId: string) {
  const control = controls.get(runId);
  if (!control || control.ownerId !== ownerId) return false;
  control.cancelled = true;
  control.controller.abort(new Error('Cancelled by user'));
  return true;
}

export function isRunCancelled(runId: string) {
  return controls.get(runId)?.cancelled ?? false;
}

export function finishRunControl(runId: string) {
  controls.delete(runId);
}
