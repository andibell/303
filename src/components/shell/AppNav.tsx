import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { ROLES } from '../../domain/access';
import { useAppStore } from '../../store/appStore';
import { sizing } from '../../theme/tokens';

type Area = 'work' | 'reports';

/** BOM Work covers its lifecycle views and every request screen. Add an area here as the product grows. */
const AREAS: { id: Area; label: string; to: (landing: string) => string; matches: RegExp; planned?: boolean }[] = [
  { id: 'work', label: 'BOM Work', to: (landing) => landing, matches: /^\/(work|requests)(\/|$)/ },
  { id: 'reports', label: 'Reports', to: () => '/reports', matches: /^\/reports(\/|$)/, planned: true },
];

/**
 * Application navigation: the major areas of BOM Pilot, with the one global creation action on the right.
 * It sits below the black global header and above each area's own navigation (BOM Work's lifecycle tabs,
 * a request's authoring steps), so it is quieter than the header and heavier than those.
 */
export function AppNav() {
  const role = useAppStore((state) => state.role);
  const { pathname } = useLocation();
  const config = ROLES[role];

  return (
    <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Box
        sx={{
          maxWidth: sizing.contentMaxWidth,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          // If the navigation and New Request don't fit on one line, the button wraps rather than overlapping.
          flexWrap: 'wrap',
          gap: { xs: 0.5, sm: 2 },
          minHeight: 48,
        }}
      >
        <Box component="nav" aria-label="Application" sx={{ display: 'flex', gap: { xs: 0.75, sm: 3 }, alignSelf: 'stretch', minWidth: 0 }}>
          {AREAS.map((area) => {
            const current = area.matches.test(pathname);
            return (
              <Link
                key={area.id}
                component={RouterLink}
                to={area.to(config.landingPath)}
                aria-current={current ? 'page' : undefined}
                underline="none"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: { xs: 0.5, sm: 0.75 },
                  px: 0.25,
                  whiteSpace: 'nowrap',
                  fontSize: '0.9375rem',
                  fontWeight: current ? 700 : 600,
                  color: current ? 'text.primary' : 'text.secondary',
                  // The current area is marked by an underline as well as weight, so it reads without color.
                  boxShadow: (theme) => (current ? `inset 0 -3px 0 ${theme.palette.primary.main}` : 'none'),
                  '&:hover': { color: 'text.primary' },
                }}
              >
                {area.label}
                {area.planned && (
                  <Typography component="span" variant="caption" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, px: { xs: 0.375, sm: 0.5 }, fontSize: { xs: '0.6875rem', sm: '0.75rem' }, color: 'text.secondary', fontWeight: 400 }}>
                    Planned
                  </Typography>
                )}
              </Link>
            );
          })}
        </Box>
        {config.canCreateRequest && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={RouterLink}
            to="/requests/new"
            sx={{ my: 0.75, flexShrink: 0, px: { xs: 1.25, sm: 2 }, '& .MuiButton-startIcon': { mr: { xs: 0.5, sm: 1 } } }}
          >
            New Request
          </Button>
        )}
      </Box>
    </Box>
  );
}
