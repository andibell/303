import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  note?: ReactNode;
}

export function EmptyState({ icon, title, description, action, note }: EmptyStateProps) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        px: 3,
        py: 6,
        bgcolor: 'background.paper',
        border: 1,
        borderStyle: 'dashed',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      {icon && (
        <Box aria-hidden sx={{ color: 'text.secondary', mb: 1, '& svg': { fontSize: 40 } }}>
          {icon}
        </Box>
      )}
      <Typography variant="h3" component="h2">
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 520, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
      {note && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          {note}
        </Typography>
      )}
    </Box>
  );
}
