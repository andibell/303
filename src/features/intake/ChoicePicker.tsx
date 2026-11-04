import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import type { ChangeEvent } from 'react';

export interface ChoiceOption<T extends string> {
  id: T;
  label: string;
}

interface ChoicePickerProps<T extends string> {
  legend: string;
  helper?: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | null;
  disabled?: boolean;
  /** DOM id of the first radio, so a failed Continue can move focus here. */
  firstInputId: string;
  columns?: 1 | 2;
}

/**
 * A compact radio list for a single choice. Every option stays selectable: options planned for a future
 * phase are explained after selection, never disabled.
 */
export function ChoicePicker<T extends string>({
  legend,
  helper,
  options,
  value,
  onChange,
  error,
  disabled,
  firstInputId,
  columns = 2,
}: ChoicePickerProps<T>) {
  return (
    <FormControl component="fieldset" required error={Boolean(error)} disabled={disabled} sx={{ width: '100%' }}>
      <FormLabel component="legend" sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5, '&.Mui-focused': { color: 'text.primary' } }}>
        {legend}
      </FormLabel>
      {helper && <FormHelperText sx={{ mt: 0, mb: 1 }}>{helper}</FormHelperText>}
      <RadioGroup
        value={value ?? ''}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value as T)}
        sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: columns === 2 ? '1fr 1fr' : '1fr' } }}
      >
        {options.map((option, index) => {
          const selected = option.id === value;
          return (
            <Box
              key={option.id}
              sx={{
                border: 1,
                borderColor: selected ? 'secondary.main' : 'divider',
                borderRadius: 1,
                bgcolor: selected ? 'action.selected' : 'background.paper',
                boxShadow: selected ? (theme) => `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
              }}
            >
              <FormControlLabel
                value={option.id}
                label={option.label}
                control={<Radio size="small" slotProps={{ input: index === 0 ? { id: firstInputId } : undefined }} />}
                sx={{ m: 0, px: 1, py: 0.5, width: '100%', '& .MuiFormControlLabel-label': { fontWeight: selected ? 600 : 400 } }}
              />
            </Box>
          );
        })}
      </RadioGroup>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
