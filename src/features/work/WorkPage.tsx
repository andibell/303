import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import type { ReactNode } from 'react';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeading } from '../../components/common/PageHeading';
import { isLifecycleId, LIFECYCLE_LABELS, ROLES, type LifecycleId, type RoleId } from '../../domain/access';
import { personaActor } from '../../data/personas';
import type { BomRequest } from '../../domain/types';
import { useAppStore } from '../../store/appStore';
import { selectRequestsByLifecycle } from '../../store/selectors';
import { RequestList } from './RequestList';

const ICONS: Record<LifecycleId, ReactNode> = {
  drafts: <EditNoteIcon />,
  requests: <PlaylistAddCheckIcon />,
  completed: <CheckCircleOutlinedIcon />,
};

const EMPTY_COPY: Record<RoleId, Partial<Record<LifecycleId, { title: string; description: string }>>> = {
  requestor: {
    drafts: {
      title: 'No drafts yet',
      description: 'BOM Requests you start with New Request and save appear here, so you can leave and pick up where you left off.',
    },
    requests: {
      title: 'No submitted requests',
      description: 'Requests you submit appear here with their status until execution is complete.',
    },
    completed: {
      title: 'No completed requests',
      description: 'Requests whose items have all been executed appear here with their System identifiers and history.',
    },
  },
  executionSpecialist: {
    requests: {
      title: 'The execution queue is empty',
      description: 'Submitted requests that are ready for execution appear here.',
    },
    completed: {
      title: 'No completed work',
      description: 'Requests completed in System appear here with their System identifiers and history.',
    },
  },
};

const SUBTITLES: Record<RoleId, string> = {
  requestor: 'Create, track and complete BOM Requests.',
  executionSpecialist: 'Work submitted BOM Requests through execution.',
};

/** BOM Work: one lifecycle (Drafts, Requests, Completed) shown through the same list pattern. */
export function WorkPage() {
  const { lifecycle } = useParams();
  const role = useAppStore((state) => state.role);
  const setLastLifecycle = useAppStore((state) => state.setLastLifecycle);
  const validLifecycle = isLifecycleId(lifecycle) ? lifecycle : null;
  const records = useAppStore(useShallow((state) => selectRequestsByLifecycle(state, validLifecycle ?? 'requests')));
  const config = ROLES[role];

  useEffect(() => {
    if (validLifecycle) setLastLifecycle(validLifecycle);
  }, [validLifecycle, setLastLifecycle]);

  // A Requestor's Drafts are their own. Submitted and completed work is shared across the team.
  const visible = useMemo(() => {
    const own = personaActor(role).id;
    return validLifecycle === 'drafts' ? records.filter((request) => request.requestor.id === own) : records;
  }, [records, validLifecycle, role]);

  if (!validLifecycle) return <Navigate to={config.landingPath} replace />;

  const empty = EMPTY_COPY[role][validLifecycle];
  return (
    <>
      <PageHeading title="BOM Work" subtitle={SUBTITLES[role]} />
      <Tabs value={validLifecycle} aria-label="BOM Work lifecycle">
        {config.lifecycles.map((id) => (
          <Tab
            key={id}
            value={id}
            label={LIFECYCLE_LABELS[id]}
            id={`work-tab-${id}`}
            aria-controls="work-panel"
            component={RouterLink}
            to={`/work/${id}`}
          />
        ))}
      </Tabs>
      <Box role="tabpanel" id="work-panel" aria-labelledby={`work-tab-${validLifecycle}`} sx={{ pt: 2 }}>
        {/* Keyed by lifecycle so a search in one view doesn't carry into another. */}
        <LifecycleView
          key={validLifecycle}
          lifecycle={validLifecycle}
          visible={visible}
          empty={empty}
        />
      </Box>
    </>
  );
}

interface LifecycleViewProps {
  lifecycle: LifecycleId;
  visible: BomRequest[];
  empty?: { title: string; description: string };
}

function LifecycleView({ lifecycle, visible, empty }: LifecycleViewProps) {
  const [search, setSearch] = useState('');
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? visible.filter((r) => r.id.toLowerCase().includes(query) || r.name.toLowerCase().includes(query)) : visible;
  }, [visible, search]);

  if (visible.length === 0) {
    return empty ? <EmptyState icon={ICONS[lifecycle]} title={empty.title} description={empty.description} /> : null;
  }
  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <TextField
          type="search"
          label="Search by Request ID or name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ width: { xs: '100%', sm: 360 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" aria-hidden />
                </InputAdornment>
              ),
            },
          }}
        />
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {matches.length} of {visible.length} {visible.length === 1 ? 'request' : 'requests'}
        </Typography>
      </Stack>
      {matches.length === 0 ? (
        <EmptyState
          title={`No ${LIFECYCLE_LABELS[lifecycle].toLowerCase()} match “${search.trim()}”`}
          description="Check the Request ID or name, or clear the search."
          action={
            <Button variant="outlined" color="secondary" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <RequestList requests={matches} lifecycle={lifecycle} />
      )}
    </>
  );
}
