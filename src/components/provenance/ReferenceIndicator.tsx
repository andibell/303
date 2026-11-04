import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import { REFERENCE_DATA_PHRASE } from './provenance';

/**
 * Marks a field whose values come from the representative reference data. Visually it is only a small icon (the
 * phrase appears once, at form level, and on hover); assistive tech reads the full phrase with the field.
 */
export function ReferenceIndicator() {
  return (
    <Tooltip title={REFERENCE_DATA_PHRASE}>
      <Box component="span" data-source="reference" sx={{ display: 'inline-flex', verticalAlign: 'text-bottom', mr: 0.5, color: 'text.secondary' }}>
        <StorageOutlinedIcon aria-hidden sx={{ fontSize: 14 }} />
        <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          {REFERENCE_DATA_PHRASE}.{' '}
        </Box>
      </Box>
    </Tooltip>
  );
}
