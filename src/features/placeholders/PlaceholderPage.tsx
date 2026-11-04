import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeading } from '../../components/common/PageHeading';
import { ROLES } from '../../domain/access';
import { useAppStore } from '../../store/appStore';
import { OUT_OF_REVIEW_SCOPE } from './reviewScope';

interface PlaceholderPageProps {
  title: string;
  /** What the screen is for in the full product. */
  description: string;
  /** Offer a link back to the request's Request Setup (for screens reached from it). */
  backToSetup?: boolean;
  /** An address that matches no screen, rather than a screen outside the review scope. */
  notFound?: boolean;
}

const PARAM_LABELS: Record<string, string> = { id: 'Request', itemId: 'Request Item' };

/**
 * Stand-in for screens the POC represents but doesn't detail in the review build. It says so in restrained terms and
 * echoes the route params so routing can be verified.
 */
export function PlaceholderPage({ title, description, backToSetup = false, notFound = false }: PlaceholderPageProps) {
  const params = useParams();
  const role = useAppStore((state) => state.role);
  const entries = Object.entries(params).filter(([key, value]) => key in PARAM_LABELS && value);
  const requestId = params.id;

  return (
    <>
      <PageHeading title={title} />
      <EmptyState
        title={notFound ? 'Page not found' : 'Outside the current review scope'}
        description={notFound ? description : `${OUT_OF_REVIEW_SCOPE} ${description}`}
        action={
          <Stack direction="row" spacing={3} sx={{ justifyContent: 'center' }}>
            {backToSetup && requestId && (
              <Link component={RouterLink} to={`/requests/${requestId}/setup`}>
                Back to Request Setup
              </Link>
            )}
            <Link component={RouterLink} to={ROLES[role].landingPath}>
              Back to BOM Work
            </Link>
          </Stack>
        }
      />
      {entries.length > 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          {entries.map(([key, value]) => (
            <Typography key={key} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {PARAM_LABELS[key]}: {value}
            </Typography>
          ))}
        </Box>
      )}
    </>
  );
}
