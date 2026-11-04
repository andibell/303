import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import GlobalStyles from '@mui/material/GlobalStyles';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/common/ErrorState';
import { PageHeading } from '../../components/common/PageHeading';
import { SaveIndicator } from '../../components/common/SaveIndicator';
import { StageStepper } from '../../components/common/StageStepper';
import { StatusChip } from '../../components/common/StatusChip';
import { isFunctionalPath } from '../../domain/businessNeeds';
import { itemBusinessName } from '../../domain/items/itemNames';
import { previewRemoval, type RemovalInfo } from '../../domain/requests';
import type { BomRequest, ItemType, RequestItem } from '../../domain/types';
import { isReadyForReview } from '../../domain/validation/engine';
import { useAppStore } from '../../store/appStore';
import { contextForRole } from '../../store/context';
import { businessNeedText, COMPLETENESS_CHIPS, hasCompletedIntake, requestStatusChip, scenarioText, stageLinks } from '../work/summaries';
import { ItemNavigator } from './ItemNavigator';
import { ItemWorkspace, WORKSPACE_HEADING_ID } from './ItemWorkspace';
import { RemoveItemDialog } from './RemoveItemDialog';
import { RequestNameTitle } from './RequestNameTitle';
import { issueCountText, itemCardId, itemProgressText, orderedItems, requestIssueCounts, untouched } from './setupSummaries';

export function RequestSetupPage() {
  const { id, itemId } = useParams();
  const request = useAppStore((state) => (id ? state.requests[id] : undefined));

  if (!request) {
    return (
      <>
        <PageHeading title="Request Setup" />
        <ErrorState title="We couldn’t find that request" description="It may have been deleted, or the address is wrong." />
        <Box sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/work/drafts">
            Back to BOM Work
          </Link>
        </Box>
      </>
    );
  }
  // Submitted work is read on its record; Action Required editing arrives with that stage.
  if (request.submittedAt) return <Navigate to={`/requests/${request.id}`} replace />;
  // Request Setup follows Intake. A future-phase path, or a draft that hasn't finished Intake, goes back there.
  if (!isFunctionalPath(request.businessNeed, request.materialScenario) || (request.items.length === 0 && !hasCompletedIntake(request))) {
    return <Navigate to={`/requests/${request.id}/intake`} replace />;
  }
  // An address naming an item that isn't in the request shows the first item. This is not a redirect: right after a
  // removal the store updates before the router's (transition) navigation lands, and a redirect would remount the page.
  const items = orderedItems(request);
  return <SetupWorkspace key={request.id} request={request} selected={items.find((item) => item.id === itemId) ?? items[0] ?? null} />;
}

interface Removing {
  open: boolean;
  item: RequestItem;
  preview: RemovalInfo;
}

function SetupWorkspace({ request, selected }: { request: BomRequest; selected: RequestItem | null }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const { addItem, removeItem, saveDraft } = useAppStore.getState();
  const role = useAppStore((state) => state.role);
  const id = request.id;

  const [navOpen, setNavOpen] = useState(false);
  const [removing, setRemoving] = useState<Removing | null>(null);
  const [toast, setToast] = useState({ open: false, message: '' });
  const notify = (message: string) => setToast({ open: true, message });
  const closeToast = () => setToast((current) => ({ ...current, open: false }));
  const [problem, setProblem] = useState<string | null>(null);
  // Where focus goes (an element id) after the change it follows has rendered.
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null);
  const moveFocus = (id: string) => setFocus({ id, at: Date.now() });

  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);

  const show = (item: RequestItem | undefined) =>
    navigate(item ? `/requests/${id}/setup/${item.id}` : `/requests/${id}/setup`, { replace: true });

  const select = (item: RequestItem) => {
    show(item);
    if (narrow) {
      // The list collapses, so focus moves to the item that was opened rather than disystempearing with it.
      setNavOpen(false);
      moveFocus(WORKSPACE_HEADING_ID);
    }
  };

  const add = (type: ItemType) => {
    setProblem(null);
    const result = addItem(id, type);
    if (!result.ok) return setProblem(result.error);
    show(result.request.items.find((item) => item.type === type));
    setNavOpen(false);
    notify(`${itemBusinessName(type)} added to this request.`);
    moveFocus(WORKSPACE_HEADING_ID);
  };

  const startRemoval = (item: RequestItem) => {
    const preview = previewRemoval(request, item.id, contextForRole(role));
    if (preview) setRemoving({ open: true, item, preview });
  };

  const confirmRemoval = () => {
    if (!removing) return;
    const { item } = removing;
    setRemoving({ ...removing, open: false });
    const before = orderedItems(request);
    const result = removeItem(id, item.id);
    if (!result.ok) return setProblem(result.error);
    notify(`${itemBusinessName(item.type)} removed from this request.`);
    if (item.id !== selected?.id) {
      // Another item was removed: the open item stays open, and focus returns to its card.
      return moveFocus(selected ? itemCardId(selected.id) : 'add-item-button');
    }
    // The open item was removed: open the one that took its place in the list, or the one before it.
    const index = before.findIndex((entry) => entry.id === item.id);
    const remaining = before.filter((entry) => entry.id !== item.id);
    const next = remaining[index] ?? remaining[index - 1];
    show(next);
    moveFocus(next ? WORKSPACE_HEADING_ID : 'add-item-button');
  };

  const save = () => {
    const result = saveDraft(id);
    if (result.ok) notify('Draft saved. You’ll find it in BOM Work under Drafts.');
    else setProblem(result.error);
  };

  const status = requestStatusChip(request);
  const progress = itemProgressText(request);
  const ready = isReadyForReview(request);
  // Validation is progressive: untouched work isn't counted. Review & Submit surfaces everything.
  const counts = issueCountText(requestIssueCounts(request));
  const guidance = ready
    ? 'Every Request Item is ready. Review the request, then submit it from Review & Submit.'
    : request.items.length === 0
      ? 'Use Add New + to add a Request Item, then review the request.'
      : untouched(request)
        ? 'Complete the Request Items in any order, then review the request before submitting.'
        : `${counts ? `${counts}. ` : ''}Items still need attention before this request can be submitted.`;

  const navigator = (
    <ItemNavigator request={request} selectedId={selected?.id ?? null} onSelect={select} onRemove={startRemoval} onAdd={add} compact={narrow} />
  );
  const navExpanded = navOpen || !selected;

  return (
    <>
      {/* Keeps a focused field clear of the sticky action bar when the browser scrolls it into view. */}
      <GlobalStyles styles={{ html: { scrollPaddingBottom: 160 } }} />
      <StageStepper active="setup" links={stageLinks(request)} />
      <PageHeading
        title={request.name}
        titleContent={<RequestNameTitle request={request} onSaved={() => notify('Request name updated.')} />}
        subtitle={
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Request {request.id}</span>
              <StatusChip {...status} />
            </Stack>
            <Typography variant="body2" component="div" color="text.secondary" data-testid="request-path">
              {businessNeedText(request)} · {scenarioText(request)}
            </Typography>
          </Stack>
        }
        actions={
          <Link component={RouterLink} to="/work/drafts">
            Back to BOM Work
          </Link>
        }
      />

      {problem && (
        <Alert severity="error" onClose={() => setProblem(null)} sx={{ mb: 2 }}>
          {problem}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '320px minmax(0, 1fr)' },
          gap: { xs: 2, md: 3 },
          alignItems: 'start',
        }}
      >
        {narrow ? (
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
            <Button
              fullWidth
              color="inherit"
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navExpanded}
              aria-controls="setup-item-nav"
              endIcon={navExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ justifyContent: 'space-between', textAlign: 'left', px: 2, py: 1, fontWeight: 400 }}
            >
              <Box component="span" sx={{ display: 'block' }}>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Request Items · {progress.ready}
                </Typography>
                <Typography component="span" sx={{ display: 'block', fontWeight: 700 }}>
                  {selected ? `${itemBusinessName(selected.type)} · ${COMPLETENESS_CHIPS[selected.completeness].label}` : 'Choose a Request Item'}
                </Typography>
              </Box>
            </Button>
            <Collapse in={navExpanded}>
              <Box id="setup-item-nav" sx={{ px: 2, pb: 2, pt: 1 }}>
                {navigator}
              </Box>
            </Collapse>
          </Box>
        ) : (
          <Box sx={{ position: 'sticky', top: 16 }}>{navigator}</Box>
        )}

        {selected ? (
          <ItemWorkspace request={request} item={selected} />
        ) : (
          <Box
            component="section"
            aria-label="No Request Item open"
            sx={{ border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1, px: 3, py: 4 }}
          >
            <Typography variant="h3" component="h2">
              No Request Items are included
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Use <strong>Add New +</strong> below the Request Items to add one and continue setting up this request.
            </Typography>
          </Box>
        )}
      </Box>

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
        <Box sx={{ minWidth: 0 }} data-testid="review-readiness">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {request.items.length > 0 ? progress.ready : 'No Request Items included'}
            {progress.attention && ` · ${progress.attention}`}
          </Typography>
          {/* On a phone the action bar stays short: the guidance is in the item list and on Review & Submit. */}
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {guidance} Nothing is submitted until you submit from Review & Submit.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <SaveIndicator status="saved" savedAt={new Date(request.updatedAt)} />
          </Box>
          <Button variant="outlined" color="secondary" startIcon={<SaveOutlinedIcon />} onClick={save}>
            Save Draft
          </Button>
          <Button variant="contained" component={RouterLink} to={`/requests/${id}/review`} aria-label="Continue to Review & Submit">
            {narrow ? 'Review & Submit' : 'Continue to Review & Submit'}
          </Button>
        </Stack>
      </Box>

      {removing && (
        <RemoveItemDialog
          open={removing.open}
          item={removing.item}
          preview={removing.preview}
          onCancel={() => setRemoving({ ...removing, open: false })}
          onConfirm={confirmRemoval}
          onExited={() => setRemoving(null)}
        />
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ bottom: { xs: 136, sm: 96 } }}
      >
        <Alert severity="success" onClose={closeToast} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}
