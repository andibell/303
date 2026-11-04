import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { StatusChip } from '../../components/common/StatusChip';
import { itemBusinessName, itemDescription, itemTechnicalLabel } from '../../domain/items/itemNames';
import type { BomRequest, RequestItem } from '../../domain/types';
import { FertCreateEditor } from './editors/FertCreateEditor';
import { OUT_OF_REVIEW_SCOPE } from '../placeholders/reviewScope';
import { COMPLETENESS_CHIPS } from '../work/summaries';
import { itemIssueCounts, plural } from './setupSummaries';

export const WORKSPACE_HEADING_ID = 'item-workspace-heading';

/** The shared container for the selected Request Item: identity and status, what the work is, then its content. */
export function ItemWorkspace({ request, item }: { request: BomRequest; item: RequestItem }) {
  const technical = itemTechnicalLabel(item.type);
  const { blocking, warnings } = itemIssueCounts(item);
  const started = item.completeness !== 'notStarted';

  return (
    <Box
      component="section"
      aria-labelledby={WORKSPACE_HEADING_ID}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', minWidth: 0, px: { xs: 2, md: 3 }, py: 2.5 }}
    >
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography id={WORKSPACE_HEADING_ID} tabIndex={-1} variant="h2" sx={{ '&:focus': { outline: 'none' } }}>
            {itemBusinessName(item.type)}
          </Typography>
          <Typography color="text.secondary" data-testid="item-technical-label">
            {technical}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <StatusChip {...COMPLETENESS_CHIPS[item.completeness]} />
        </Box>
      </Box>

      <Typography sx={{ mt: 2, maxWidth: 720 }} data-testid="item-description">
        {itemDescription(item.type)}
      </Typography>

      {/* Issues appear once the item has been worked on. Until then it is simply not started. */}
      {started && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.5, sm: 2.5 }}
          sx={{ mt: 2 }}
          role="group"
          aria-label={`${technical} validation`}
          data-testid="item-issues"
        >
          {blocking === 0 && warnings === 0 ? (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <CheckCircleOutlinedIcon fontSize="small" color="success" aria-hidden />
              <Typography variant="body2">No issues found</Typography>
            </Stack>
          ) : (
            <>
              {blocking > 0 && (
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <ErrorOutlinedIcon fontSize="small" color="error" aria-hidden />
                  <Typography variant="body2">{plural(blocking, 'issue')} to resolve before submission</Typography>
                </Stack>
              )}
              {warnings > 0 && (
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <WarningAmberIcon fontSize="small" color="warning" aria-hidden />
                  <Typography variant="body2">{plural(warnings, 'warning')} (won’t block submission)</Typography>
                </Stack>
              )}
            </>
          )}
        </Stack>
      )}

      {item.type === 'finishedGoodsCreate' ? (
        // Keyed by item so a removed and re-added Finished Product Create starts with fresh touched state.
        <FertCreateEditor key={item.id} request={request} item={item} />
      ) : (
        <Box sx={{ mt: 3, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1, px: 2, py: 2.5 }}>
          <Typography color="text.secondary">{OUT_OF_REVIEW_SCOPE}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Create Finished Product shows the depth intended for a Request Item.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
