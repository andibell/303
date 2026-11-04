import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import CircularProgress from '@mui/material/CircularProgress';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveIndicatorProps {
  status: SaveStatus;
  savedAt?: Date | null;
}

/** Foundation for visible save feedback on drafts. Announces changes politely to assistive tech. */
export function SaveIndicator({ status, savedAt }: SaveIndicatorProps) {
  let content = null;
  if (status === 'saving') {
    content = (
      <>
        <CircularProgress size={14} aria-hidden />
        <span>Saving…</span>
      </>
    );
  } else if (status === 'saved') {
    const time = savedAt?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    content = (
      <>
        <CheckIcon fontSize="inherit" aria-hidden />
        <span>{time ? `Saved at ${time}` : 'Saved'}</span>
      </>
    );
  } else if (status === 'error') {
    content = (
      <>
        <ErrorOutlinedIcon fontSize="inherit" color="error" aria-hidden />
        <span>Couldn’t save. Your changes are still on this page.</span>
      </>
    );
  }

  return (
    <Typography
      component="div"
      variant="body2"
      color="text.secondary"
      aria-live="polite"
      sx={{ minHeight: 20 }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        {content}
      </Stack>
    </Typography>
  );
}
