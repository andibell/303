import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { sizing } from '../../theme/tokens';

/** Consistent page gutters and max width for content inside the shell. */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ maxWidth: sizing.contentMaxWidth, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>{children}</Box>
  );
}
