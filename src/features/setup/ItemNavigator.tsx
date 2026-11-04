import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { StatusChip } from '../../components/common/StatusChip';
import { itemBusinessName, itemTechnicalLabel } from '../../domain/items/itemNames';
import { addItemBlocker } from '../../domain/requests';
import { RECOMMENDED_ITEM_TYPES } from '../../domain/template';
import type { BomRequest, ItemType, RequestItem } from '../../domain/types';
import { touch } from '../../theme/tokens';
import { COMPLETENESS_CHIPS } from '../work/summaries';
import { itemCardId, itemProgressText, ITEM_ORDER, orderedItems } from './setupSummaries';

/** Kept for assistive tech, hidden on screen. */
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

interface ItemNavigatorProps {
  request: BomRequest;
  selectedId: string | null;
  onSelect: (item: RequestItem) => void;
  onRemove: (item: RequestItem) => void;
  onAdd: (type: ItemType) => void;
  /** Inside the narrow-screen disclosure the summary button already shows the heading and progress. */
  compact?: boolean;
}

/**
 * The Request Items in this BOM Request as compact cards, openable in any order. Each card names the work, its
 * technical type and its status, and carries its own Remove. Selecting and removing are separate controls.
 */
export function ItemNavigator({ request, selectedId, onSelect, onRemove, onAdd, compact = false }: ItemNavigatorProps) {
  const items = orderedItems(request);
  const included = new Set(items.map((item) => item.type));
  const missing = ITEM_ORDER.filter((type) => !included.has(type));
  const progress = itemProgressText(request);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // When an add moves focus to the new item, the menu must not pull it back to its trigger.
  const [skipRestore, setSkipRestore] = useState(false);

  const add = (type: ItemType) => {
    setSkipRestore(true);
    setAnchor(null);
    onAdd(type);
  };

  return (
    <Box component="nav" aria-labelledby="setup-items-heading" sx={{ position: 'relative' }}>
      <Typography id="setup-items-heading" variant="h3" component="h2" sx={compact ? visuallyHidden : undefined}>
        Request Items
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={compact ? visuallyHidden : { mt: 0.25, mb: 1 }} data-testid="item-progress">
        {items.length > 0 ? progress.ready : 'No Request Items included'}
        {progress.attention && ` · ${progress.attention}`}
      </Typography>

      {items.length > 0 && (
        <List disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
          {items.map((item, index) => {
            const selected = item.id === selectedId;
            const business = itemBusinessName(item.type);
            const technical = itemTechnicalLabel(item.type);
            return (
              <ListItem key={item.id} disablePadding divider={index < items.length - 1} sx={{ position: 'relative' }}>
                <ListItemButton
                  id={itemCardId(item.id)}
                  selected={selected}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelect(item)}
                  sx={{
                    display: 'block',
                    // Remove sits at the card's bottom right, on the technical label's line.
                    pt: 1,
                    pb: 0.75,
                    pr: 1.5,
                    // A neutral selected background plus an inset brand bar and bolder label, so it reads without color.
                    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'action.selected' },
                    boxShadow: selected ? (theme) => `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography sx={{ fontWeight: selected ? 700 : 600, minWidth: 0 }}>{business}</Typography>
                    <Box sx={{ flexShrink: 0 }}>
                      <StatusChip {...COMPLETENESS_CHIPS[item.completeness]} />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ pr: 9, minHeight: 24, display: 'flex', alignItems: 'center' }}>
                    {technical}
                  </Typography>
                </ListItemButton>
                <Button
                  size="small"
                  color="secondary"
                  onClick={() => onRemove(item)}
                  aria-label={`Remove ${technical}`}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    bottom: 6,
                    minHeight: 24,
                    minWidth: 0,
                    px: 1,
                    py: 0,
                    fontWeight: 400,
                    // The label stays compact so the card isn't taller; an invisible hit area brings the touch target to 44px.
                    [touch.query]: { minHeight: 24, '&::after': { content: '""', position: 'absolute', top: -10, bottom: -10, left: -6, right: -6 } },
                  }}
                >
                  Remove
                </Button>
              </ListItem>
            );
          })}
        </List>
      )}

      <Button
        id="add-item-button"
        size="small"
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-controls={anchor ? 'add-item-menu' : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        sx={{ mt: 1, px: 0.5, fontWeight: 600 }}
      >
        Add New <span aria-hidden>&nbsp;+</span>
        <Box component="span" sx={visuallyHidden}>
          {' '}
          Request Item
        </Box>
      </Button>
      <Menu
        id="add-item-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        disableRestoreFocus={skipRestore}
        slotProps={{
          list: { 'aria-labelledby': 'add-item-button' },
          paper: { sx: { maxWidth: 320 } },
          transition: { onExited: () => setSkipRestore(false) },
        }}
      >
        {missing.length === 0 && (
          <MenuItem disabled>
            <ListItemText
              primary="All supported Request Items are included"
              secondary="There are no other Request Item types to add to this request."
              slotProps={{ primary: { sx: { whiteSpace: 'normal' } }, secondary: { sx: { whiteSpace: 'normal' } } }}
            />
          </MenuItem>
        )}
        {missing.map((type) => {
          const blocker = addItemBlocker(request, type);
          const note = blocker ?? (RECOMMENDED_ITEM_TYPES.includes(type) ? 'Recommended for this request' : null);
          return (
            <MenuItem key={type} disabled={Boolean(blocker)} onClick={() => add(type)}>
              <ListItemText
                primary={itemBusinessName(type)}
                secondary={[itemTechnicalLabel(type), note].filter(Boolean).join(' · ')}
                slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
