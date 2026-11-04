import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SourceNote } from './SourceNote';

interface ExecutionOutcomeProps {
  id: string;
  label: string;
  /** The recorded outcome, once execution has produced it. Never invented before then. */
  value?: string;
}

/**
 * A value that downstream execution process produces, shown read-only for context. Before execution it reads
 * "Assigned during execution process": neutral, never a missing or invalid field.
 */
export function ExecutionOutcome({ id, label, value }: ExecutionOutcomeProps) {
  return (
    <Box role="group" aria-labelledby={`${id}-label`} data-testid={id} data-source="execution">
      <Typography id={`${id}-label`} variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.75, color: value ? 'text.primary' : 'text.secondary', minHeight: 24, display: 'flex', alignItems: 'center' }}>
        {value ?? 'Assigned during execution process'}
      </Typography>
      <Typography variant="caption" component="div" sx={{ mt: 0.25 }}>
        <SourceNote kind="execution">
          {value ? 'Recorded by the Execution Specialist after execution process.' : 'Recorded by the Execution Specialist once the material is created in System.'}
        </SourceNote>
      </Typography>
    </Box>
  );
}
