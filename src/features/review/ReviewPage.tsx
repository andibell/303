import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import GlobalStyles from '@mui/material/GlobalStyles';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { PageHeading } from '../../components/common/PageHeading';
import { StageStepper } from '../../components/common/StageStepper';
import { StatusChip } from '../../components/common/StatusChip';
import { SourceNote } from '../../components/provenance/SourceNote';
import { REFERENCE_DATA_PHRASE } from '../../components/provenance/provenance';
import { isFunctionalPath } from '../../domain/businessNeeds';
import { textOf } from '../../domain/items/accessors';
import { previewSubmission } from '../../domain/requests';
import type { BomRequest } from '../../domain/types';
import { useAppStore } from '../../store/appStore';
import { contextForRole } from '../../store/context';
import { orderedItems, plural } from '../setup/setupSummaries';
import { businessNeedText, hasCompletedIntake, itemNamesSummary, requestStatusChip, scenarioText, stageLinks } from '../work/summaries';
import { ReviewItemSection } from './ReviewItemSection';
import { blockingIssueGroups } from './reviewSummaries';

export const VALIDATION_HEADING_ID = 'review-validation-heading';

export function ReviewPage() {
  const { id } = useParams();
  const request = useAppStore((state) => (id ? state.requests[id] : undefined));
  // Set in the same update as the submission, so this page doesn't redirect to the record while BOM Work opens.
  const [submittedHere, setSubmittedHere] = useState(false);

  if (!request) {
    return (
      <>
        <PageHeading title="Review & Submit" />
        <ErrorState title="We couldn’t find that request" description="It may have been deleted, or the address is wrong." />
        <Box sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/work/drafts">
            Back to BOM Work
          </Link>
        </Box>
      </>
    );
  }
  if (request.submittedAt) {
    return submittedHere ? <LoadingState label="Submitting…" /> : <Navigate to={`/requests/${request.id}`} replace />;
  }
  if (!isFunctionalPath(request.businessNeed, request.materialScenario) || (request.items.length === 0 && !hasCompletedIntake(request))) {
    return <Navigate to={`/requests/${request.id}/intake`} replace />;
  }
  return <ReviewContent key={request.id} request={request} onSubmitted={() => setSubmittedHere(true)} />;
}

function ReviewContent({ request, onSubmitted }: { request: BomRequest; onSubmitted: () => void }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const role = useAppStore((state) => state.role);
  const submitRequest = useAppStore((state) => state.submitRequest);
  const id = request.id;
  const setupPath = `/requests/${id}/setup`;

  // The same review submission runs, without recording anything. Review never applies rules of its own.
  const preview = useMemo(() => previewSubmission(request, contextForRole(role)), [request, role]);
  const blockingGroups = blockingIssueGroups(request, preview.issues);
  const blockingCount = preview.issues.filter((issue) => issue.blocking).length;
  const warningCount = preview.issues.length - blockingCount;
  const ready = preview.submittable;
  const items = orderedItems(request);
  const justification = textOf(request.context.businessJustification);
  const referenceDocument = request.uploads.find((upload) => upload.kind === 'referenceDocument');

  // Narrow screens open only the items that need attention; the user's own choice wins once made.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (itemId: string) =>
    expanded[itemId] ?? (!narrow || preview.issues.some((issue) => issue.itemId === itemId && issue.blocking));

  const [problem, setProblem] = useState<string | null>(null);
  const [focusAt, setFocusAt] = useState(0);
  useEffect(() => {
    if (focusAt) document.getElementById(VALIDATION_HEADING_ID)?.focus();
  }, [focusAt]);

  // A ref, not state, so a second tap in the same frame is ignored before React re-renders.
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const submit = () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setProblem(null);
    // Yields one tick so the in-progress state renders before the local submission runs.
    timer.current = window.setTimeout(() => {
      const result = submitRequest(id);
      if (result.ok) {
        onSubmitted();
        navigate(`/requests/${id}/submitted`, { replace: true });
        return;
      }
      submitting.current = false;
      setBusy(false);
      setProblem(result.error);
      setFocusAt(Date.now());
    }, 0);
  };

  return (
    <>
      <GlobalStyles styles={{ html: { scrollPaddingBottom: 160 } }} />
      <StageStepper active="review" links={stageLinks(request)} />
      <PageHeading
        title={request.name}
        subtitle={
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Review & Submit</span>
            <span aria-hidden>·</span>
            <span>Request {id}</span>
            <StatusChip {...requestStatusChip(request)} />
          </Stack>
        }
        actions={
          <Link component={RouterLink} to="/work/drafts">
            Back to BOM Work
          </Link>
        }
      />

      <Stack spacing={3} sx={{ maxWidth: 1040 }}>
        <Box
          component="section"
          aria-labelledby="review-summary-heading"
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', px: { xs: 2, md: 3 }, py: 2 }}
        >
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
            <Typography id="review-summary-heading" variant="h3" component="h2">
              Request summary
            </Typography>
            <Link component={RouterLink} to={`/requests/${id}/intake`}>
              Edit in Intake
            </Link>
          </Stack>
          <Box
            component="dl"
            sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 3, rowGap: 1.5 }}
          >
            <SummaryEntry label="Business need">{businessNeedText(request)}</SummaryEntry>
            <SummaryEntry label="Material scenario">{scenarioText(request)}</SummaryEntry>
            <SummaryEntry label="Request Items">
              {plural(request.items.length, 'Request Item')}
              {itemNamesSummary(request) && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {itemNamesSummary(request)}
                </Typography>
              )}
            </SummaryEntry>
            {referenceDocument && (
              <SummaryEntry label="Reference document">
                {referenceDocument.fileName}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Simulated upload · only the file name is kept
                </Typography>
              </SummaryEntry>
            )}
            <SummaryEntry label="Business justification" full>
              <Box component="span" sx={{ whiteSpace: 'pre-wrap' }}>
                {justification || 'Not entered yet.'}
              </Box>
            </SummaryEntry>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="review-items-heading">
          <Stack direction="row" spacing={2} useFlexGap sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography id="review-items-heading" variant="h3" component="h2">
              Request Items
            </Typography>
            <Button component={RouterLink} to={setupPath} startIcon={<EditOutlinedIcon />} sx={{ minHeight: 44 }}>
              Edit Request Details
            </Button>
          </Stack>
          <Typography variant="body2" component="div" color="text.secondary" sx={{ mb: 2, display: 'grid', gap: 0.5 }}>
            <span>This review is read-only. Changes are made in Request Setup.</span>
            <SourceNote kind="reference">
              Lists marked with this icon use {REFERENCE_DATA_PHRASE.charAt(0).toLowerCase() + REFERENCE_DATA_PHRASE.slice(1)}.
            </SourceNote>
          </Typography>
          {items.length === 0 ? (
            <Typography color="text.secondary">No Request Items are included in this request.</Typography>
          ) : (
            <Stack spacing={2}>
              {items.map((item) => (
                <ReviewItemSection
                  key={item.id}
                  request={request}
                  item={item}
                  issues={preview.issues}
                  open={isOpen(item.id)}
                  onToggle={() => setExpanded((current) => ({ ...current, [item.id]: !isOpen(item.id) }))}
                />
              ))}
            </Stack>
          )}
        </Box>

        {problem && (
          <Alert severity="error" onClose={() => setProblem(null)}>
            {problem}
          </Alert>
        )}

        <Box
          component="section"
          aria-labelledby={VALIDATION_HEADING_ID}
          data-testid="validation-summary"
          sx={{ border: 1, borderColor: ready ? 'success.main' : 'error.main', borderRadius: 1, bgcolor: 'background.paper', px: { xs: 2, md: 3 }, py: 2 }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {ready ? <CheckCircleOutlinedIcon color="success" aria-hidden /> : <ErrorOutlinedIcon color="error" aria-hidden />}
            <Typography id={VALIDATION_HEADING_ID} tabIndex={-1} variant="h3" component="h2" sx={{ '&:focus': { outline: 'none' } }}>
              {ready ? 'Ready to submit' : 'Unable to submit'}
            </Typography>
          </Stack>
          {ready ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Nothing blocks submission.
              {warningCount > 0 && ` ${plural(warningCount, 'warning')} won’t block it; you can review them in Request Setup.`}
            </Typography>
          ) : items.length === 0 ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Add at least one Request Item before submitting.{' '}
              <Link component={RouterLink} to={setupPath}>
                Go to Request Setup
              </Link>
            </Typography>
          ) : (
            <>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Resolve {blockingCount === 1 ? 'this issue' : `these ${blockingCount} issues`} before submitting.
              </Typography>
              <Box component="ul" sx={{ m: 0, mt: 1.5, p: 0, listStyle: 'none', display: 'grid', gap: 1.5 }}>
                {blockingGroups.map((group) => (
                  <Box component="li" key={group.key}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {group.title}
                    </Typography>
                    <Box component="ul" sx={{ m: 0, mt: 0.25, pl: 2.5 }}>
                      {group.messages.map((message) => (
                        <Typography component="li" variant="body2" key={message}>
                          {message}
                        </Typography>
                      ))}
                    </Box>
                    <Link component={RouterLink} to={group.to} variant="body2" sx={{ display: 'inline-block', mt: 0.5 }}>
                      {group.linkLabel}
                    </Link>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>
      </Stack>

      <Box
        role="region"
        aria-label="Request actions"
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 'appBar',
          mt: 3,
          py: { xs: 1, sm: 1.5 },
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ minWidth: 0 }} data-testid="submit-readiness">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {ready ? 'Ready to submit' : `Unable to submit${blockingCount > 0 ? ` · ${blockingCount} to resolve` : ''}`}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            Submitting moves this request from Drafts to Requests in BOM Work. It can’t be edited afterwards.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outlined" color="secondary" component={RouterLink} to={setupPath}>
            Back to Request Setup
          </Button>
          <Button variant="contained" onClick={submit} disabled={busy} aria-busy={busy}>
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
        </Stack>
      </Box>
    </>
  );
}

function SummaryEntry({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0, gridColumn: full ? '1 / -1' : 'auto' }}>
      <Typography component="dt" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}
