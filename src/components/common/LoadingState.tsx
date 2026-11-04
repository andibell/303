import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <Stack direction="row" spacing={1.5} role="status" sx={{ alignItems: 'center', justifyContent: 'center', py: 6 }}>
      <CircularProgress size={24} aria-hidden />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  );
}
