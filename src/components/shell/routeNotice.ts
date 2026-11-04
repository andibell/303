import type { AlertColor } from '@mui/material/Alert';

/** A message carried in router location state, so it belongs to one navigation and isn’t stored. */
export interface RouteNotice {
  severity: AlertColor;
  message: string;
}

export const withNotice = (notice: RouteNotice) => ({ state: { notice } });

export function readNotice(state: unknown): RouteNotice | null {
  const notice = (state as { notice?: RouteNotice } | null)?.notice;
  return notice && typeof notice.message === 'string' ? notice : null;
}
