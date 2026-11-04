import { useRef, type ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { Upload } from '../../domain/types';

const size = (bytes?: number): string =>
  bytes === undefined ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

interface ReferenceUploadProps {
  upload: Upload | undefined;
  onChoose: (file: File) => void;
  onRemove: () => void;
}

/**
 * Prototype upload for the Reference Data supporting file. The file is only recorded (name and size) on the draft.
 * Nothing is read, parsed or extracted, and the screen says so.
 */
export function ReferenceUpload({ upload, onChoose, onRemove }: ReferenceUploadProps) {
  const input = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onChoose(file);
    event.target.value = ''; // lets the same file be chosen again after removal
  };

  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
      <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>
        Reference Data file (optional)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Attach the Reference Data list for this launch as a supporting document.
      </Typography>
      <input ref={input} type="file" hidden aria-label="Reference Data file" onChange={handleChange} />
      {upload ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { sm: 'center' }, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}
        >
          <AttachFileIcon aria-hidden color="action" />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{upload.fileName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {[size(upload.sizeBytes), 'Attached as a supporting document'].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <Chip size="small" variant="outlined" label="Simulated upload" />
          <Button size="small" variant="outlined" color="secondary" onClick={() => input.current?.click()}>
            Replace
          </Button>
          <Button size="small" color="secondary" onClick={onRemove} aria-label={`Remove ${upload.fileName}`}>
            Remove
          </Button>
        </Stack>
      ) : (
        <Button variant="outlined" color="secondary" startIcon={<UploadFileIcon />} onClick={() => input.current?.click()}>
          Choose Reference Data file
        </Button>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Prototype behavior: the file’s name and size are saved on this draft. Nothing is read or extracted from it, so no
        fields are filled in from the file and you still enter everything yourself.
      </Typography>
    </Box>
  );
}
