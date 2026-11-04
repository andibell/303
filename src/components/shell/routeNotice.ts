import type { AlertColor } from '@mui/material/Alert';

/** A message carried in router location state, so it belongs to one navigation and isn’t stored. */
export interface RouteNotice {
  severity: AlertColor;
  message: string;
}

export const withNotice = (notice: RouteNotice) => ({ state: { notice } });

/** Names the request just submitted, so BOM Work can confirm it once, for this navigation only. */
export const withSubmitted = (requestId: string) => ({ state: { submitted: requestId } });

export function readSubmitted(state: unknown): string | null {
  const submitted = (state as { submitted?: unknown } | null)?.submitted;
  return typeof submitted === 'string' ? submitted : null;
}

export function readNotice(state: unknown): RouteNotice | null {
  const notice = (state as { notice?: RouteNotice } | null)?.notice;
  return notice && typeof notice.message === 'string' ? notice : null;
}
