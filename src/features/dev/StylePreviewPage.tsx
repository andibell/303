import { useEffect, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { PageHeading } from '../../components/common/PageHeading';
import { SaveIndicator } from '../../components/common/SaveIndicator';
import { StatusChip } from '../../components/common/StatusChip';
import * as tokens from '../../theme/tokens';

/**
 * Development-only design-system check (not linked from production navigation and excluded from
 * production builds). Everything here must render through the theme.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="h2" component="h2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function FontStatus() {
  const [faces, setFaces] = useState<{ key: string; family: string; weight: string; status: string }[]>([]);

  useEffect(() => {
    const all = Array.from(document.fonts);
    const snapshot = () =>
      all.map((face, index) => ({
        key: `${face.family}-${face.weight}-${index}`,
        family: face.family.replaceAll('"', ''),
        weight: face.weight,
        status: face.status,
      }));
    void Promise.allSettled(all.map((face) => face.load())).then(() => setFaces(snapshot()));
  }, []);

  return (
    <TableContainer>
      <Table aria-label="Declared font faces">
        <TableHead>
          <TableRow>
            <TableCell>Family</TableCell>
            <TableCell>Weight</TableCell>
            <TableCell>Load status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {faces.map((face) => (
            <TableRow key={face.key}>
              <TableCell>{face.family}</TableCell>
              <TableCell>{face.weight}</TableCell>
              <TableCell>
                <StatusChip label={face.status} tone={face.status === 'loaded' ? 'success' : 'error'} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const SWATCH_GROUPS: { name: string; note: string; values: Record<string, string> }[] = [
  { name: 'Neutral (sampled)', note: 'Provisional', values: tokens.neutral },
  { name: 'Blue-grey (sampled)', note: 'Provisional; 300 and 400 sampled identically', values: tokens.blueGrey },
  { name: 'Brand (sampled + derived)', note: 'Brand and primary action only; not the error color', values: tokens.brand },
  { name: 'Info (sampled light, derived main/dark)', note: 'Provisional', values: tokens.info },
  { name: 'Success (sampled light, derived main/dark)', note: 'Provisional', values: tokens.success },
  { name: 'Error (MUI default placeholder)', note: 'Provisional; no approved color supplied', values: tokens.provisionalSemantic.error },
  { name: 'Warning (MUI default placeholder)', note: 'Provisional; no approved color supplied', values: tokens.provisionalSemantic.warning },
];

function Swatches() {
  return (
    <Stack spacing={2}>
      {SWATCH_GROUPS.map((group) => (
        <Box key={group.name}>
          <Typography variant="subtitle2">
            {group.name} <Typography component="span" variant="caption" color="text.secondary">· {group.note}</Typography>
          </Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
            {Object.entries(group.values).map(([name, hex]) => (
              <Box key={name} sx={{ width: 96 }}>
                <Box sx={{ height: 32, bgcolor: hex, border: 1, borderColor: 'divider', borderRadius: 0.5 }} />
                <Typography variant="caption" sx={{ display: 'block' }}>
                  {name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {hex}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

const PLANTS = ['FAC-01 · Manufacturing facility', 'FAC-02 · Manufacturing facility', 'FAC-03 · Contract facility', 'FAC-04 · Distribution facility'];

export default function StylePreviewPage() {
  const [tab, setTab] = useState(0);

  return (
    <>
      <PageHeading
        title="Style preview"
        subtitle="Development-only check of the BOM Pilot theme. Not part of the production build."
      />

      <Section title="Typography and fonts">
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h1">Page title · System font</Typography>
          <Typography variant="h2">Prominent section title · System font</Typography>
          <Typography variant="h3">Section heading · System font</Typography>
          <Typography variant="h4">Subsection heading</Typography>
          <Typography variant="overline">Overline label</Typography>
          <Typography variant="body1">
            Body copy in a system font. Navigation, form controls, tables, labels, metadata, helper text, validation and status
            text all use this family.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Secondary body text and metadata · Last modified 10/10/2026
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Caption and helper text
          </Typography>
        </Stack>
        <FontStatus />
      </Section>

      <Section title="Header treatment">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Box sx={{ bgcolor: 'common.black', color: 'common.white', p: 2, flex: 1 }}>
            <Typography variant="h2">BOM Pilot</Typography>
          </Box>
          <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', p: 2, flex: 1 }}>
            <Typography variant="h2">BOM Pilot</Typography>
          </Box>
        </Stack>
      </Section>

      <Section title="Buttons">
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <Button variant="contained" startIcon={<AddIcon />}>Primary action</Button>
          <Button variant="outlined" color="secondary">Secondary</Button>
          <Button variant="text" color="secondary">Tertiary</Button>
          <Button variant="contained" color="error" startIcon={<DeleteOutlinedIcon />}>Destructive</Button>
          <Button variant="outlined" color="error">Destructive outline</Button>
          <Button variant="contained" disabled>Disabled</Button>
          <Button variant="outlined" color="secondary" size="small">Compact</Button>
        </Stack>
      </Section>

      <Section title="Form controls">
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, alignItems: 'start' }}>
          <TextField label="Material Description" required helperText="Maximum 80 characters, including spaces." />
          <TextField label="Orderable Unit's Product Code" required defaultValue="SKU-A01" error helperText="Use 3 to 24 letters, numbers, or hyphens." />
          <TextField
            label="Weight Unit"
            color="warning"
            focused
            defaultValue="LB"
            helperText={
              <Stack component="span" direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <WarningAmberIcon fontSize="inherit" aria-hidden />
                <span>Warning: confirm this unit before submitting.</span>
              </Stack>
            }
          />
          <TextField select label="Temperature Condition" required defaultValue="">
            <MenuItem value="" disabled>Select</MenuItem>
            <MenuItem value="ambient">Ambient</MenuItem>
            <MenuItem value="chilled">Chilled</MenuItem>
            <MenuItem value="frozen">Frozen</MenuItem>
          </TextField>
          <Autocomplete
            options={PLANTS}
            renderInput={(params) => <TextField {...params} label="Facility to Extend" helperText="Select from fictional demo data." />}
          />
          <TextField label="Source: external record (read-only)" value="SRC-001" slotProps={{ input: { readOnly: true } }} />
          <TextField label="Disabled" disabled defaultValue="Not editable" />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Required fields carry an asterisk. Errors and warnings add an icon or message text, not color alone.
        </Typography>
      </Section>

      <Section title="Tabs">
        <Tabs value={tab} onChange={(_event, value: number) => setTab(value)} aria-label="Sample tabs">
          <Tab label="Drafts" />
          <Tab label="Requests" />
          <Tab label="Completed" />
        </Tabs>
      </Section>

      <Section title="Status chips">
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
          <StatusChip label="Draft" />
          <StatusChip label="Ready for Execution" tone="info" />
          <StatusChip label="In Progress" tone="info" />
          <StatusChip label="Complete" tone="success" />
          <StatusChip label="Needs attention" tone="warning" />
          <StatusChip label="Action Required" tone="error" />
        </Stack>
      </Section>

      <Section title="Alerts">
        <Stack spacing={1}>
          <Alert severity="info">Info: demo reference data (read-only).</Alert>
          <Alert severity="success">Success: all required fields are complete.</Alert>
          <Alert severity="warning">Warning: this value was populated from an upload. Please confirm it.</Alert>
          <Alert severity="error">
            <AlertTitle>Error</AlertTitle>
            Producing Plants includes a plant that isn’t in the reference list.
          </Alert>
        </Stack>
      </Section>

      <Section title="Table">
        <TableContainer sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Table aria-label="Sample table">
            <TableHead>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>Business need</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Last modified</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow hover>
                <TableCell>Sample request A</TableCell>
                <TableCell>New Product / Innovation</TableCell>
                <TableCell>3</TableCell>
                <TableCell><StatusChip label="Ready for Execution" tone="info" /></TableCell>
                <TableCell align="right">10/10/2026</TableCell>
              </TableRow>
              <TableRow hover>
                <TableCell>Sample request B</TableCell>
                <TableCell>New Product / Innovation</TableCell>
                <TableCell>3</TableCell>
                <TableCell><StatusChip label="Action Required" tone="error" /></TableCell>
                <TableCell align="right">10/12/2026</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Section>

      <Section title="Focus indicator">
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          Press Tab to move through these controls and check the 2px focus ring on each.
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button variant="contained">Primary</Button>
          <Button variant="outlined" color="secondary">Secondary</Button>
          <TextField size="small" label="Text input" />
          <Box component="a" href="#focus-link" sx={{ color: 'info.main' }}>Link</Box>
        </Stack>
      </Section>

      <Section title="Shared primitives">
        <Stack spacing={2}>
          <Stack direction="row" spacing={3}>
            <SaveIndicator status="saving" />
            <SaveIndicator status="saved" savedAt={new Date()} />
            <SaveIndicator status="error" />
          </Stack>
          <LoadingState />
          <ErrorState description="The list couldn’t be loaded." onRetry={() => undefined} />
          <EmptyState title="Nothing here yet" description="Empty states explain what will appear and what to do next." />
        </Stack>
      </Section>

      <Section title="Palette tokens">
        <Swatches />
      </Section>
      <Divider />
    </>
  );
}
