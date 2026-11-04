import { useEffect, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { PageHeading } from '../../components/common/PageHeading';
import { StatusChip } from '../../components/common/StatusChip';
import { withSubmitted } from '../../components/shell/routeNotice';
import { ROLES } from '../../domain/access';
import { STATUS_LABELS, getRequestStatus } from '../../domain/status';
import { useAppStore } from '../../store/appStore';
import { plural } from '../setup/setupSummaries';
import { formatDateTime } from '../work/format';
import { businessNeedText, scenarioText } from '../work/summaries';

export const CONFIRMATION_HEADING_ID = 'confirmation-heading';

const ACTION_SX = { minHeight: 44, width: { xs: '100%', sm: 'auto' } } as const;

/** Shown once a request has been submitted. It only reads the stored record, so a refresh shows the same thing. */
export function ConfirmationPage() {
  const { id } = useParams();
  const request = useAppStore((state) => (id ? state.requests[id] : undefined));
  const landingPath = useAppStore((state) => ROLES[state.role].landingPath);

  if (!request || !request.submittedAt) {
    return (
      <>
        <PageHeading title="Submission confirmation" />
        <Alert severity={request ? 'info' : 'error'}>
          <AlertTitle>{request ? 'This request hasn’t been submitted yet' : 'We couldn’t find that request'}</AlertTitle>
          {request
            ? 'There is no confirmation to show until it has been submitted from Review & Submit.'
            : 'It may have been deleted, the demo data may have been reset, or the address is wrong.'}
        </Alert>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2, alignItems: { sm: 'center' } }}>
          {request && (
            <Button variant="contained" component={RouterLink} to={`/requests/${request.id}/review`} sx={ACTION_SX}>
              Go to Review & Submit
            </Button>
          )}
          <Button variant={request ? 'outlined' : 'contained'} color={request ? 'secondary' : 'primary'} component={RouterLink} to={landingPath} sx={ACTION_SX}>
            Back to BOM Work
          </Button>
        </Stack>
      </>
    );
  }

  return <Confirmation key={request.id} id={request.id} />;
}

function Confirmation({ id }: { id: string }) {
  const request = useAppStore((state) => state.requests[id]);
  const landingPath = useAppStore((state) => ROLES[state.role].landingPath);

  useEffect(() => {
    document.getElementById(CONFIRMATION_HEADING_ID)?.focus();
  }, []);

  return (
    <Box sx={{ maxWidth: 560 }}>
      <PageHeading
        title="Request submitted"
        titleContent={
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <CheckCircleOutlinedIcon color="success" aria-hidden sx={{ fontSize: 32 }} />
            <Typography id={CONFIRMATION_HEADING_ID} tabIndex={-1} variant="h1" component="h1" sx={{ '&:focus': { outline: 'none' } }}>
              Request submitted
            </Typography>
          </Stack>
        }
      />

      <Typography role="status" sx={{ mb: 3 }}>
        Your request has been submitted and is now available in BOM Work.
      </Typography>

      <Box sx={{ mb: 3, pl: 1.5, borderLeft: 4, borderColor: 'success.main' }}>
        <Typography variant="caption" color="text.secondary" component="p">
          Request ID
        </Typography>
        <Typography
          data-testid="confirmation-request-id"
          sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.02em', overflowWrap: 'anywhere' }}
        >
          {request.id}
        </Typography>
      </Box>

      <Box component="dl" sx={{ m: 0, mb: 3, display: 'grid', gap: 1.5 }} data-testid="confirmation-summary">
        <Entry label="Request name">{request.name}</Entry>
        <Entry label="Status">
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusChip label="Submitted" tone="success" />
            <span>{STATUS_LABELS[getRequestStatus(request)]}</span>
          </Stack>
        </Entry>
        <Entry label="Submitted on">{formatDateTime(request.submittedAt)}</Entry>
        <Entry label="Business need">{businessNeedText(request)}</Entry>
        <Entry label="Material scenario">{scenarioText(request)}</Entry>
        <Entry label="Request Items">{plural(request.items.length, 'Request Item')}</Entry>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap' }}>
        <Button variant="contained" component={RouterLink} to="/work/requests" state={withSubmitted(request.id).state} sx={ACTION_SX}>
          View in BOM Work
        </Button>
        <Button variant="outlined" color="secondary" component={RouterLink} to="/requests/new" sx={ACTION_SX}>
          Start another request
        </Button>
        <Link component={RouterLink} to={landingPath} sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, alignSelf: { xs: 'center', sm: 'auto' } }}>
          Return to BOM Work
        </Link>
      </Stack>
    </Box>
  );
}

function Entry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography component="dt" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}
