import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { hasUserContent } from '../../domain/items/accessors';
import { itemBusinessName, itemTechnicalLabel } from '../../domain/items/itemNames';
import type { RemovalInfo } from '../../domain/requests';
import type { RequestItem } from '../../domain/types';

interface RemoveItemDialogProps {
  open: boolean;
  /** Kept while the dialog closes, so its text doesn’t change during the exit transition. */
  item: RequestItem | null;
  /** The domain’s preview of what removing `item` changes. */
  preview: RemovalInfo | null;
  onCancel: () => void;
  onConfirm: () => void;
  onExited: () => void;
}

const joinTypes = (types: RequestItem['type'][]) => types.map(itemBusinessName).join(' and ');

/** Confirms a removal and explains its consequences, using only what the domain reports. */
export function RemoveItemDialog({ open, item, preview, onCancel, onConfirm, onExited }: RemoveItemDialogProps) {
  const label = item ? itemBusinessName(item.type) : '';
  const technical = item ? itemTechnicalLabel(item.type) : '';

  return (
    <Dialog
      open={open && Boolean(item && preview)}
      onClose={onCancel}
      slotProps={{ transition: { onExited } }}
      aria-labelledby="remove-item-title" aria-describedby="remove-item-body" maxWidth="xs" fullWidth>
      <DialogTitle id="remove-item-title">Remove {label}?</DialogTitle>
      <DialogContent id="remove-item-body">
        {item && preview && (
          <>
            <Typography>
              {label} ({technical}) will be removed from this draft
              {hasUserContent(item) ? ', along with the information entered in it.' : '. Nothing has been entered in it yet.'}
            </Typography>
            {preview.wasRecommended && (
              <Typography sx={{ mt: 1.5 }}>
                It’s part of the recommended starting template for this request, and it won’t be added back automatically.
              </Typography>
            )}
            {preview.dependentItems.length > 0 && (
              <Typography sx={{ mt: 1.5 }}>
                {joinTypes(preview.dependentItems)} {preview.dependentItems.length === 1 ? 'uses' : 'use'} values carried over from{' '}
                {label}. Those values will be cleared.
              </Typography>
            )}
            <Typography sx={{ mt: 1.5 }}>
              Removing it may change whether this request is complete. You can add it again later from Add New +.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="secondary" onClick={onCancel} autoFocus>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={onConfirm}>
          Remove {label}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
