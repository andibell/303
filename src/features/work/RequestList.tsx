import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { StatusChip } from '../../components/common/StatusChip';
import type { LifecycleId } from '../../domain/access';
import { STATUS_LABELS, getRequestStatus } from '../../domain/status';
import type { BomRequest } from '../../domain/types';
import { formatDate, formatDateTime } from './format';
import {
  businessNeedText,
  draftContinuePath,
  draftState,
  itemNamesSummary,
  itemSummary,
  lastActivity,
  requestStatusChip,
  executionIdentifierDetail,
  executionIdentifierSummary,
  scenarioText,
} from './summaries';

type SortKey = 'id' | 'name' | 'status' | 'date';
interface Sort {
  key: SortKey;
  direction: 'asc' | 'desc';
}

interface Column {
  id: string;
  header: string;
  sortKey?: SortKey;
  align?: 'right';
  cell: (request: BomRequest) => ReactNode;
}

const dateOf = (request: BomRequest, lifecycle: LifecycleId): string =>
  lifecycle === 'completed' ? (request.completedAt ?? request.updatedAt) : request.updatedAt;

const sortValue = (request: BomRequest, key: SortKey, lifecycle: LifecycleId): string => {
  if (key === 'id') return request.id;
  if (key === 'name') return request.name.toLowerCase();
  if (key === 'status') return STATUS_LABELS[getRequestStatus(request)];
  return dateOf(request, lifecycle);
};

const openPath = (request: BomRequest, lifecycle: LifecycleId): string =>
  lifecycle === 'drafts' ? draftContinuePath(request) : `/requests/${request.id}`;

const nameLink = (request: BomRequest, lifecycle: LifecycleId) => (
  <Link component={RouterLink} to={openPath(request, lifecycle)} underline="hover" sx={{ fontWeight: 600, color: 'text.primary' }}>
    {request.name}
  </Link>
);

const itemsCell = (request: BomRequest) => (
  <>
    <Typography variant="body2" component="span" sx={{ display: 'block' }}>{itemSummary(request)}</Typography>
    {itemNamesSummary(request) && (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 260 }}>
        {itemNamesSummary(request)}
      </Typography>
    )}
  </>
);

function columnsFor(lifecycle: LifecycleId): Column[] {
  // The Request Name leads each row. The Request ID is secondary identification.
  const id: Column = {
    id: 'id',
    header: 'Request ID',
    sortKey: 'id',
    cell: (r) => (
      <Typography variant="body2" component="span" color="text.secondary">
        {r.id}
      </Typography>
    ),
  };
  const name = (): Column => ({ id: 'name', header: 'Request name', sortKey: 'name', cell: (r) => nameLink(r, lifecycle) });
  const need: Column = { id: 'need', header: 'Business need', cell: businessNeedText };
  const action = (label: string): Column => ({
    id: 'action',
    header: 'Action',
    cell: (r) => (
      <Button
        component={RouterLink}
        to={openPath(r, lifecycle)}
        size="small"
        variant={lifecycle === 'drafts' ? 'outlined' : 'text'}
        color="secondary"
        aria-label={`${label} ${r.name}`}
      >
        {label}
      </Button>
    ),
  });

  if (lifecycle === 'drafts') {
    return [
      name(),
      id,
      need,
      { id: 'scenario', header: 'Material scenario', cell: scenarioText },
      { id: 'items', header: 'Request Items', cell: itemsCell },
      { id: 'state', header: 'State', cell: (r) => <StatusChip {...draftState(r)} /> },
      { id: 'date', header: 'Last modified', sortKey: 'date', cell: (r) => formatDateTime(r.updatedAt) },
      action('Continue'),
    ];
  }
  if (lifecycle === 'requests') {
    return [
      name(),
      id,
      need,
      { id: 'requestor', header: 'Requestor', cell: (r) => r.requestor.name },
      { id: 'status', header: 'Status', sortKey: 'status', cell: (r) => <StatusChip {...requestStatusChip(r)} /> },
      { id: 'items', header: 'Progress', cell: itemSummary },
      { id: 'submitted', header: 'Submitted', cell: (r) => formatDate(r.submittedAt) },
      {
        id: 'activity',
        header: 'Last activity',
        sortKey: 'date',
        cell: (r) => {
          const activity = lastActivity(r);
          return (
            <>
              <Typography variant="body2" component="span" sx={{ display: 'block' }}>{activity.text}</Typography>
              <Typography variant="caption" color="text.secondary">{formatDateTime(activity.at)}</Typography>
            </>
          );
        },
      },
      action('Open'),
    ];
  }
  return [
    name(),
    id,
    need,
    { id: 'requestor', header: 'Requestor', cell: (r) => r.requestor.name },
    { id: 'completed', header: 'Completed', sortKey: 'date', cell: (r) => formatDate(r.completedAt) },
    { id: 'items', header: 'Request Items', cell: itemsCell },
    {
      id: 'system',
      header: 'Execution Identifiers',
      cell: (r) => (
        <Box component="span" title={executionIdentifierDetail(r)}>
          {executionIdentifierSummary(r)}
        </Box>
      ),
    },
    action('Open'),
  ];
}

function NarrowList({ requests, lifecycle }: { requests: BomRequest[]; lifecycle: LifecycleId }) {
  return (
    <List disablePadding sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', borderRadius: 1 }}>
      {requests.map((request, index) => {
        const chip = lifecycle === 'drafts' ? draftState(request) : requestStatusChip(request);
        return (
          <ListItem key={request.id} divider={index < requests.length - 1} sx={{ display: 'block' }}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ minWidth: 0 }}>
                {nameLink(request, lifecycle)}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {request.id} · {businessNeedText(request)}
                </Typography>
              </Box>
              <StatusChip {...chip} />
            </Stack>
            {lifecycle !== 'requests' && itemNamesSummary(request) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {itemNamesSummary(request)}
              </Typography>
            )}
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {itemSummary(request)}
              {lifecycle === 'completed' && request.completedAt ? ` · Completed ${formatDate(request.completedAt)}` : ` · Updated ${formatDateTime(request.updatedAt)}`}
            </Typography>
            {lifecycle !== 'drafts' && (
              <Typography variant="caption" color="text.secondary">
                Requestor: {request.requestor.name}
              </Typography>
            )}
          </ListItem>
        );
      })}
    </List>
  );
}

interface RequestListProps {
  requests: BomRequest[];
  lifecycle: LifecycleId;
}

/** Operational list for one BOM Work lifecycle view: a dense table, or a compact list on narrow screens. */
export function RequestList({ requests, lifecycle }: RequestListProps) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [sort, setSort] = useState<Sort>({ key: 'date', direction: 'desc' });
  const columns = useMemo(() => columnsFor(lifecycle), [lifecycle]);

  const sorted = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...requests].sort((a, b) => direction * sortValue(a, sort.key, lifecycle).localeCompare(sortValue(b, sort.key, lifecycle)));
  }, [requests, sort, lifecycle]);

  const toggle = (key: SortKey) =>
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : key === 'date' ? 'desc' : 'asc' }));

  if (narrow) return <NarrowList requests={sorted} lifecycle={lifecycle} />;

  return (
    <TableContainer sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', borderRadius: 1 }}>
      <Table aria-label={`${lifecycle} requests`}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align}
                sortDirection={column.sortKey && sort.key === column.sortKey ? sort.direction : false}
              >
                {column.sortKey ? (
                  <TableSortLabel
                    active={sort.key === column.sortKey}
                    direction={sort.key === column.sortKey ? sort.direction : 'asc'}
                    onClick={() => toggle(column.sortKey as SortKey)}
                  >
                    {column.header}
                  </TableSortLabel>
                ) : (
                  column.header
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((request) => (
            <TableRow key={request.id} hover>
              {columns.map((column) => (
                <TableCell key={column.id} align={column.align}>
                  {column.cell(request)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
