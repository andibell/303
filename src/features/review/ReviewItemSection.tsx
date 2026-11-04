import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink } from 'react-router-dom';
import { StatusChip } from '../../components/common/StatusChip';
import { ReferenceIndicator } from '../../components/provenance/ReferenceIndicator';
import { SourceNote } from '../../components/provenance/SourceNote';
import { sourceNoteFor } from '../../components/provenance/provenance';
import { itemBusinessName, itemTechnicalLabel } from '../../domain/items/itemNames';
import type { BomRequest, RequestItem, ValidationIssue } from '../../domain/types';
import { plural } from '../setup/setupSummaries';
import { reviewGroups } from './reviewSummaries';

interface ReviewItemSectionProps {
  request: BomRequest;
  item: RequestItem;
  /** The submission review's issues for the whole request. */
  issues: ValidationIssue[];
  open: boolean;
  onToggle: () => void;
}

/** One Request Item, read-only: identity, readiness, then its values. Changes are made in Request Setup. */
export function ReviewItemSection({ request, item, issues, open, onToggle }: ReviewItemSectionProps) {
  const name = itemBusinessName(item.type);
  const headingId = `review-item-${item.id}`;
  const detailsId = `${headingId}-details`;
  const own = issues.filter((issue) => issue.itemId === item.id);
  const blocking = own.filter((issue) => issue.blocking).length;
  const warnings = own.length - blocking;
  const groups = reviewGroups(item);

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', px: { xs: 2, md: 3 }, py: 2 }}
    >
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography id={headingId} variant="h3" component="h3">
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {itemTechnicalLabel(item.type)}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <StatusChip {...(blocking > 0 ? { label: `${plural(blocking, 'issue')} to resolve`, tone: 'error' as const } : { label: 'Ready', tone: 'success' as const })} />
        </Box>
      </Box>
      {warnings > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {plural(warnings, 'warning')} (won’t block submission)
        </Typography>
      )}

      <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap', mx: -1 }}>
        <Button
          color="inherit"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`${open ? 'Hide' : 'Show'} details for ${name}`}
          endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ minHeight: 44, fontWeight: 600 }}
        >
          {open ? 'Hide details' : 'Show details'}
        </Button>
        <Button
          component={RouterLink}
          to={`/requests/${request.id}/setup/${item.id}`}
          aria-label={`Edit ${name}`}
          startIcon={<EditOutlinedIcon />}
          sx={{ minHeight: 44 }}
        >
          Edit
        </Button>
      </Stack>

      <Collapse in={open}>
        <Box id={detailsId} sx={{ pt: 1 }}>
          {groups.length === 0 ? (
            <Typography color="text.secondary">Nothing has been entered for this Request Item yet.</Typography>
          ) : (
            <Stack spacing={2.5}>
              {groups.map((group) => (
                <Box key={group.key}>
                  <Typography component="h4" variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                    {group.title}
                  </Typography>
                  <Box
                    component="dl"
                    sx={{
                      m: 0,
                      display: 'grid',
                      gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                      columnGap: 3,
                      rowGap: 1.5,
                    }}
                  >
                    {group.fields.map((field) => {
                      const note = sourceNoteFor(field.value);
                      return (
                        <Box key={field.id} sx={{ minWidth: 0 }}>
                          <Typography component="dt" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {field.fromReference && <ReferenceIndicator />}
                            {field.label}
                          </Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                            {field.text}
                            {note && (
                              <Typography component="span" variant="caption" sx={{ display: 'block' }}>
                                <SourceNote kind={note.kind}>{note.text}</SourceNote>
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
