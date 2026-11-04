import { useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/common/ErrorState';
import { PageHeading } from '../../components/common/PageHeading';
import { SaveIndicator } from '../../components/common/SaveIndicator';
import { StageStepper } from '../../components/common/StageStepper';
import { StatusChip } from '../../components/common/StatusChip';
import {
  BUSINESS_NEEDS,
  businessNeedLabel,
  isFunctionalPath,
  materialScenarioLabel,
  MATERIAL_SCENARIOS,
} from '../../domain/businessNeeds';
import { textOf } from '../../domain/items/accessors';
import { DEFAULT_REQUEST_NAME, fv } from '../../domain/requests';
import type { BomRequest, BusinessNeedId, MaterialScenarioId } from '../../domain/types';
import { useAppStore } from '../../store/appStore';
import { standaloneLinkSx } from '../../theme/tokens';
import { hasCompletedIntake, isFuturePhase, stageLinks } from '../work/summaries';
import { ChoicePicker } from './ChoicePicker';
import { ReferenceUpload } from './ReferenceUpload';
import { TemplatePreview } from './TemplatePreview';

const IDS = { name: 'intake-name', need: 'intake-need', scenario: 'intake-scenario', justification: 'intake-justification' };

/** Message from the domain’s own validation for an Intake field, with a fallback for the same rule. */
const domainMessage = (request: BomRequest, fieldId: string, fallback: string): string =>
  request.validation.issues.find((issue) => issue.section === 'Intake' && issue.fieldId === fieldId)?.message ?? fallback;

export function IntakePage() {
  const { id } = useParams();
  const request = useAppStore((state) => (id ? state.requests[id] : undefined));

  if (!request) {
    return (
      <>
        <PageHeading title="Intake" />
        <ErrorState title="We couldn’t find that request" description="It may have been deleted, or the address is wrong." />
        <Box sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/work/drafts" sx={standaloneLinkSx}>
            Back to BOM Work
          </Link>
        </Box>
      </>
    );
  }
  if (request.submittedAt) return <Navigate to={`/requests/${request.id}`} replace />;
  return <IntakeForm key={request.id} request={request} />;
}

function IntakeForm({ request }: { request: BomRequest }) {
  const navigate = useNavigate();
  const { updateRequestDetails, saveDraft, completeIntake, generateInitialItems, addUpload, removeUpload } = useAppStore.getState();
  const id = request.id;

  // Text is edited locally and committed to the draft when the field loses focus, on choices, and on save.
  const [name, setName] = useState(request.name === DEFAULT_REQUEST_NAME ? '' : request.name);
  const [justification, setJustification] = useState(textOf(request.context.businessJustification));
  const [touched, setTouched] = useState({ name: false, justification: false });
  const [attempted, setAttempted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  // The path is fixed once Request Items exist, and stays fixed after Intake hands over, even if every item is removed.
  const handedOver = hasCompletedIntake(request);
  const locked = request.items.length > 0 || handedOver;
  const future = isFuturePhase(request);
  const functional = isFunctionalPath(request.businessNeed, request.materialScenario);
  const referenceDocument = request.uploads.find((upload) => upload.kind === 'referenceDocument');

  const commitName = () => {
    const next = name.trim() || DEFAULT_REQUEST_NAME;
    if (next !== request.name) updateRequestDetails(id, { name: next });
  };
  const commitJustification = () => {
    if (justification !== textOf(request.context.businessJustification)) {
      updateRequestDetails(id, { context: { businessJustification: fv(justification) } });
    }
  };
  const flush = () => {
    commitName();
    commitJustification();
  };

  const chooseNeed = (need: BusinessNeedId) => {
    if (need === request.businessNeed) return;
    updateRequestDetails(id, { businessNeed: need, ...(need !== 'newProduct' ? { materialScenario: null } : {}) });
  };
  const chooseScenario = (scenario: MaterialScenarioId) => updateRequestDetails(id, { materialScenario: scenario });

  const handleFile = (file: File) => {
    if (referenceDocument) removeUpload(id, referenceDocument.id);
    addUpload(id, { fileName: file.name, kind: 'referenceDocument', sizeBytes: file.size });
  };

  const save = () => {
    flush();
    const result = saveDraft(id);
    if (result.ok) setSavedToast(true);
    else setProblem(result.error);
  };

  const needError =
    attempted && !request.businessNeed ? domainMessage(request, 'businessNeed', 'Select a business need.') : null;
  const scenarioError =
    attempted && request.businessNeed === 'newProduct' && !request.materialScenario
      ? domainMessage(request, 'materialScenario', 'Select a material scenario.')
      : null;
  const nameError = (touched.name || attempted) && name.trim() === '' ? 'Enter a name for this request.' : null;
  const justificationError =
    (touched.justification || attempted) && justification.trim() === ''
      ? domainMessage(request, 'businessJustification', 'Business justification is required.')
      : null;

  const next = () => {
    flush();
    setAttempted(true);
    setProblem(null);
    const missing = [
      !name.trim() && IDS.name,
      !request.businessNeed && IDS.need,
      request.businessNeed === 'newProduct' && !request.materialScenario && IDS.scenario,
      functional && !justification.trim() && IDS.justification,
    ].filter(Boolean) as string[];
    if (missing.length > 0 || !functional) {
      if (missing[0]) document.getElementById(missing[0])?.focus();
      return;
    }
    // The template is generated once. Removed items are added back from Request Setup, never regenerated here.
    if (!handedOver) {
      const intake = completeIntake(id);
      if (!intake.ok) return setProblem(intake.error);
      const items = generateInitialItems(id);
      if (!items.ok) return setProblem(items.error);
    }
    navigate(`/requests/${id}/setup`);
  };

  return (
    <>
      <StageStepper active="intake" links={stageLinks(request)} />
      <PageHeading
        title={request.name === DEFAULT_REQUEST_NAME ? 'New BOM Request' : request.name}
        subtitle={
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Intake</span>
            <span aria-hidden>·</span>
            <span>Request {request.id}</span>
            <StatusChip label="Draft" />
          </Stack>
        }
        actions={
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <SaveIndicator status="saved" savedAt={new Date(request.updatedAt)} />
            <Button variant="outlined" color="secondary" startIcon={<SaveOutlinedIcon />} onClick={save}>
              Save Draft
            </Button>
          </Stack>
        }
      />

      <Stack spacing={3} sx={{ maxWidth: 920 }}>
        <Typography variant="body2" color="text.secondary">
          Fields marked with * are required. Your changes are saved to this draft as you go; use Save Draft to record a save point.
        </Typography>
        {problem && <Alert severity="error" onClose={() => setProblem(null)}>{problem}</Alert>}

        <Box component="section" aria-labelledby="details-heading">
          <Typography id="details-heading" variant="h3" component="h2" sx={{ mb: 1 }}>
            Request details
          </Typography>
          <TextField
            id={IDS.name}
            label="Request name"
            required
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              setTouched((current) => ({ ...current, name: true }));
              commitName();
            }}
            error={Boolean(nameError)}
            helperText={nameError ?? 'Give this request a short name that will help you recognize it later.'}
            sx={{ maxWidth: 560 }}
          />
        </Box>

        <Divider />

        <ChoicePicker
          legend="What is the business need for this request?"
          helper="Your answer shapes the questions, uploads and recommended Request Items."
          options={BUSINESS_NEEDS}
          value={request.businessNeed}
          onChange={chooseNeed}
          error={needError}
          disabled={locked}
          firstInputId={IDS.need}
        />
        {locked && (
          <Alert severity="info">
            Request Items have been generated for this request, so its business need and material scenario are fixed. Start a new
            request to take a different path. Request Items are added and removed in Request Setup.
          </Alert>
        )}

        {request.businessNeed === 'newProduct' && (
          <ChoicePicker
            legend="Will this request need any new materials?"
            helper="This decides which Request Items we recommend."
            options={MATERIAL_SCENARIOS}
            value={request.materialScenario}
            onChange={chooseScenario}
            error={scenarioError}
            disabled={locked}
            firstInputId={IDS.scenario}
          />
        )}

        {future && request.businessNeed && (
          <Alert severity="info" role="status">
            <AlertTitle>Planned for a future phase</AlertTitle>
            {request.businessNeed !== 'newProduct' ? (
              <>
                <strong>{businessNeedLabel(request.businessNeed)}</strong> is part of the intended product model: in the full product,
                this choice would tailor the questions, uploads, recommended Request Items and validation. It isn’t part of the
                functional path in this proof of concept, so no Request Items are generated.
              </>
            ) : (
              <>
                <strong>{request.materialScenario ? materialScenarioLabel(request.materialScenario) : ''}</strong> is represented in
                the future product model but isn’t part of the functional path in this proof of concept, so no Request Items are
                generated.
              </>
            )}{' '}
            Your choice is saved on this draft. You can change it above, or save the draft and come back later.
          </Alert>
        )}

        {functional && (
          <>
            <Divider />
            <Box component="section" aria-labelledby="context-heading">
              <Typography id="context-heading" variant="h3" component="h2" sx={{ mb: 1 }}>
                Request context
              </Typography>
              <Stack spacing={2.5}>
                <TextField
                  id={IDS.justification}
                  label="Business justification"
                  required
                  multiline
                  minRows={3}
                  fullWidth
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  onBlur={() => {
                    setTouched((current) => ({ ...current, justification: true }));
                    commitJustification();
                  }}
                  error={Boolean(justificationError)}
                  helperText={justificationError ?? 'Summarize the details of the request. This applies to every Request Item in it.'}
                />
                <ReferenceUpload
                  upload={referenceDocument}
                  onChoose={handleFile}
                  onRemove={() => referenceDocument && removeUpload(id, referenceDocument.id)}
                />
              </Stack>
            </Box>
            <Divider />
            <TemplatePreview />
          </>
        )}

        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', pt: 1 }}>
          {!future && (
            <Button variant="contained" onClick={next}>
              {locked ? 'Go to Request Setup' : 'Continue to Request Setup'}
            </Button>
          )}
          <Button variant="outlined" color="secondary" startIcon={<SaveOutlinedIcon />} onClick={save}>
            Save Draft
          </Button>
          <Link component={RouterLink} to="/work/drafts" sx={standaloneLinkSx}>
            Back to BOM Work
          </Link>
        </Stack>
      </Stack>

      <Snackbar open={savedToast} autoHideDuration={4000} onClose={() => setSavedToast(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Alert severity="success" onClose={() => setSavedToast(false)} variant="filled">
          Draft saved. You’ll find it in BOM Work under Drafts.
        </Alert>
      </Snackbar>
    </>
  );
}
