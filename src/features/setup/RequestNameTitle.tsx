import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useAppStore } from '../../store/appStore';
import type { BomRequest } from '../../domain/types';

interface RequestNameTitleProps {
  request: BomRequest;
  /** Called after the name was saved, for a brief confirmation. */
  onSaved: () => void;
}

/**
 * The page title: the user's Request Name, editable in place while the request is a Draft. Saving goes through
 * the store's request-update operation; nothing but the name (and the modified time) changes.
 */
export function RequestNameTitle({ request, onSaved }: RequestNameTitleProps) {
  const updateRequestDetails = useAppStore((state) => state.updateRequestDetails);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(request.name);
  const [error, setError] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);

  // Focus follows the mode: into the field when editing starts, back to the edit control when it ends.
  useEffect(() => {
    if (editing) input.current?.focus();
    else if (wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const canEdit = !request.submittedAt;

  const start = () => {
    setValue(request.name);
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    setError(null);
    setEditing(false);
  };
  const save = () => {
    const name = value.trim();
    if (!name) return setError('Enter a name for this request.');
    if (name === request.name) return setEditing(false);
    const result = updateRequestDetails(request.id, { name });
    if (!result.ok) return setError(result.error);
    setEditing(false);
    onSaved();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      cancel();
    }
  };

  if (editing) {
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField
          id="request-name-input"
          label="Request name"
          required
          size="small"
          value={value}
          inputRef={input}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          error={Boolean(error)}
          helperText={error ?? 'Give this request a short name that will help you recognize it later.'}
          sx={{ width: { xs: '100%', sm: 440 } }}
        />
        <Button variant="contained" onClick={save} sx={{ mt: '1px' }}>
          Save
        </Button>
        <Button color="secondary" onClick={cancel} sx={{ mt: '1px' }}>
          Cancel
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
      <Typography variant="h1" component="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {request.name}
      </Typography>
      {canEdit && (
        <IconButton ref={editButton} onClick={start} aria-label="Edit request name" size="small" sx={{ mt: 0.5, color: 'text.secondary' }}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}
