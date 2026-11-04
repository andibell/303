import { useEffect, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface PageHeadingProps {
  title: string;
  /** Replaces the plain title element (for a title that can be edited in place). `title` still names the tab. */
  titleContent?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** Page title with optional supporting text and primary actions. Also sets the tab title. */
export function PageHeading({ title, titleContent, subtitle, actions }: PageHeadingProps) {
  useEffect(() => {
    document.title = `${title} · BOM Pilot`;
  }, [title]);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' }, mb: 2 }}
    >
      <Box>
        {titleContent ?? (
          <Typography variant="h1" component="h1">
            {title}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="body1" component="div" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
    </Stack>
  );
}
