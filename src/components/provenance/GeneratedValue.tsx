import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface GeneratedValueProps {
  id: string;
  label: string;
  required?: boolean;
  /** The generated value, or null while it can't be generated yet. */
  value: string | null;
  /** Shown instead of a value while it can't be generated: neutral guidance, never an error. */
  pending: ReactNode;
  /** Right-aligned facts about the value, for example a character count. */
  meta?: ReactNode;
  /** Notes beneath the value: where it comes from, and any issue. */
  children?: ReactNode;
  invalid?: boolean;
}

/**
 * A read-only, system-generated value. It is a labelled output, not an input, so there is nothing to type into;
 * the filled background (no input border) marks it as generated. An invalid value gets the error border only once
 * it exists: a value that is still pending is presented neutrally.
 */
export function GeneratedValue({ id, label, required, value, pending, meta, children, invalid = false }: GeneratedValueProps) {
  return (
    <Box role="group" aria-labelledby={`${id}-label`} data-testid={id}>
      <Typography id={`${id}-label`} variant="body2" sx={{ fontWeight: 600 }}>
        {label}
        {required && (
          <Box component="span" aria-hidden sx={{ color: 'error.main' }}>
            {' '}*
          </Box>
        )}
      </Typography>
      <Box
        component="output"
        id={`${id}-value`}
        aria-labelledby={`${id}-label`}
        sx={{
          display: 'block',
          mt: 0.75,
          px: 1.75,
          py: 1.25,
          minHeight: 44,
          borderRadius: 1,
          bgcolor: 'action.hover',
          border: 1,
          borderColor: invalid ? 'error.main' : 'transparent',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '0.9375rem',
          letterSpacing: '0.02em',
          overflowWrap: 'anywhere',
          color: value ? 'text.primary' : 'text.secondary',
        }}
      >
        {value ?? <Box component="span" sx={{ fontFamily: (theme) => theme.typography.fontFamily, letterSpacing: 'normal' }}>{pending}</Box>}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start', mt: 0.5 }}>
        <Typography variant="caption" component="div" sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>
          {children}
        </Typography>
        {meta && (
          <Typography variant="caption" component="div" color={invalid ? 'error' : 'text.secondary'} sx={{ flexShrink: 0 }}>
            {meta}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
