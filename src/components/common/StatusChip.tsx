import type { ReactElement } from 'react';
import Chip from '@mui/material/Chip';
import { alpha, darken } from '@mui/material/styles';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

const ICONS: Record<StatusTone, ReactElement> = {
  neutral: <RadioButtonUncheckedIcon />,
  info: <InfoOutlinedIcon />,
  success: <CheckCircleOutlinedIcon />,
  warning: <WarningAmberIcon />,
  error: <ErrorOutlinedIcon />,
};

/**
 * Foundation for status display. Every tone carries an icon plus text, so meaning never depends on
 * color alone. Later stages map request/item statuses onto these tones.
 */
export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <Chip
      size="small"
      icon={ICONS[tone]}
      label={label}
      variant="outlined"
      sx={(theme) => {
        if (tone === 'neutral') {
          return { color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper' };
        }
        const { main } = theme.palette[tone];
        return {
          color: darken(main, 0.45),
          borderColor: alpha(main, 0.55),
          bgcolor: alpha(main, 0.1),
          '& .MuiChip-icon': { color: 'inherit' },
        };
      }}
    />
  );
}
