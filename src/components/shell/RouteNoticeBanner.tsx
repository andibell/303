import { useState } from 'react';
import Alert from '@mui/material/Alert';
import { useLocation } from 'react-router-dom';
import { readNotice } from './routeNotice';

/** Explains a redirect (for example, a route the current role can’t open). Dismissible. */
export function RouteNoticeBanner() {
  const location = useLocation();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const notice = readNotice(location.state);

  if (!notice || dismissedKey === location.key) return null;
  return (
    <Alert severity={notice.severity} onClose={() => setDismissedKey(location.key)} sx={{ mb: 2 }}>
      {notice.message}
    </Alert>
  );
}
