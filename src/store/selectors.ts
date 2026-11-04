import type { LifecycleId } from '../domain/access';
import { getRequestStatus, groupByLifecycle } from '../domain/status';
import type { BomRequest, RequestStatus } from '../domain/types';
import type { AppState } from './appStore';

/*
 * Plain selector functions over the store state. Selectors that build new arrays must be wrapped in
 * `useShallow` (zustand/react/shallow) when used with the hook, to avoid re-render loops.
 */

export const selectRequest = (state: Pick<AppState, 'requests'>, id: string | undefined): BomRequest | undefined =>
  id ? state.requests[id] : undefined;

export const selectRequestsByLifecycle = (state: Pick<AppState, 'requests'>, lifecycle: LifecycleId): BomRequest[] =>
  groupByLifecycle(Object.values(state.requests))[lifecycle];

/** Requests visible to a Requestor’s own work: the signed-in person’s records. */
export const selectRequestsFor = (state: Pick<AppState, 'requests'>, actorId: string): BomRequest[] =>
  Object.values(state.requests).filter((request) => request.requestor.id === actorId);

export const selectStatusCounts = (state: Pick<AppState, 'requests'>): Record<RequestStatus, number> => {
  const counts: Record<RequestStatus, number> = {
    draft: 0,
    validating: 0,
    readyForExecution: 0,
    inProgress: 0,
    actionRequired: 0,
    completed: 0,
  };
  for (const request of Object.values(state.requests)) counts[getRequestStatus(request)] += 1;
  return counts;
};
