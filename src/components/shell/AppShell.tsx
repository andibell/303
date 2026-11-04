import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { PageContainer } from '../common/PageContainer';
import { RouteGate } from '../../app/RouteGate';
import { AppHeader } from './AppHeader';
import { AppNav } from './AppNav';
import { RouteNoticeBanner } from './RouteNoticeBanner';

function SkipLink() {
  return (
    <Link
      href="#main-content"
      sx={{
        position: 'absolute',
        left: 8,
        top: -48,
        zIndex: 'tooltip',
        bgcolor: 'background.paper',
        px: 2,
        py: 1,
        '&:focus': { top: 8 },
      }}
    >
      Skip to main content
    </Link>
  );
}

export function AppShell() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SkipLink />
      <AppHeader />
      <AppNav />
      <Box component="main" id="main-content" tabIndex={-1} sx={{ flex: 1, '&:focus': { outline: 'none' } }}>
        <PageContainer>
          <RouteNoticeBanner />
          <RouteGate />
        </PageContainer>
      </Box>
      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          BOM Pilot prototype · synthetic demo data only · no connection to external systems
          {import.meta.env.DEV && (
            <>
              {' · '}
              <Link component={RouterLink} to="/dev/style-preview">
                Style preview (dev only)
              </Link>
            </>
          )}
        </Typography>
      </Box>
    </Box>
  );
}
