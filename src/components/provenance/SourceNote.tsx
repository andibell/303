import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import type { SourceKind } from './provenance';

const ICONS: Record<SourceKind, ReactNode> = {
  reference: <StorageOutlinedIcon />,
  generated: <AutoModeOutlinedIcon />,
  upload: <AttachFileOutlinedIcon />,
  execution: <PendingActionsOutlinedIcon />,
};

/**
 * One line saying where a value or a group of values came from: a small icon plus subdued text. It renders as
 * inline elements, so it can sit inside helper text and is read with the field it describes.
 */
export function SourceNote({ kind, children, testId }: { kind: SourceKind; children: ReactNode; testId?: string }) {
  return (
    <Box
      component="span"
      data-source={kind}
      data-testid={testId}
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, color: 'text.secondary', '& svg': { fontSize: 14, mt: '2px', flexShrink: 0 } }}
    >
      <Box component="span" aria-hidden sx={{ display: 'inline-flex' }}>
        {ICONS[kind]}
      </Box>
      <span>{children}</span>
    </Box>
  );
}
