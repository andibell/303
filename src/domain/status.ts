import type { LifecycleId } from './access';
import type { ActionRequiredReturn, BomRequest, RequestItem, RequestStatus } from './types';

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  validating: 'Validating',
  readyForExecution: 'Ready for Execution',
  inProgress: 'In Progress',
  actionRequired: 'Action Required',
  completed: 'Completed',
};

export const openReturns = (request: BomRequest): ActionRequiredReturn[] =>
  request.returns.filter((entry) => entry.resolution.state === 'open');

export const requiredItems = (request: BomRequest): RequestItem[] => request.items.filter((item) => item.required);

export const allRequiredItemsComplete = (request: BomRequest): boolean => {
  const required = requiredItems(request);
  return required.length > 0 && required.every((item) => item.execution === 'completed');
};

/** Derived, never stored: the parent’s status follows from its items. */
export function getRequestStatus(request: BomRequest): RequestStatus {
  if (!request.submittedAt) return request.isValidating ? 'validating' : 'draft';
  if (allRequiredItemsComplete(request)) return 'completed';
  if (request.items.some((item) => item.execution === 'returned')) return 'actionRequired';
  if (request.items.some((item) => item.execution === 'inProgress' || item.execution === 'completed')) return 'inProgress';
  return 'readyForExecution';
}

/**
 * BOM Work grouping. Unsubmitted work (including a submission still being validated) is a Draft. Submitted
 * but unfinished work is a Request. A request is Completed only when all required items are complete.
 */
export function getLifecycle(request: BomRequest): LifecycleId {
  const status = getRequestStatus(request);
  if (status === 'draft' || status === 'validating') return 'drafts';
  return status === 'completed' ? 'completed' : 'requests';
}

export function groupByLifecycle(requests: readonly BomRequest[]): Record<LifecycleId, BomRequest[]> {
  const groups: Record<LifecycleId, BomRequest[]> = { drafts: [], requests: [], completed: [] };
  for (const request of requests) groups[getLifecycle(request)].push(request);
  for (const list of Object.values(groups)) list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return groups;
}

export const itemProgress = (request: BomRequest) => ({
  completed: requiredItems(request).filter((item) => item.execution === 'completed').length,
  total: requiredItems(request).length,
});
