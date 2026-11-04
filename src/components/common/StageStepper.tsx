import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import CheckIcon from '@mui/icons-material/Check';
import { Link as RouterLink } from 'react-router-dom';
import { touch } from '../../theme/tokens';

export type Stage = 'intake' | 'setup' | 'review';
const STAGES: { id: Stage; label: string }[] = [
  { id: 'intake', label: 'Intake' },
  { id: 'setup', label: 'Request Setup' },
  { id: 'review', label: 'Review & Submit' },
];

interface StageStepperProps {
  active: Stage;
  /** Where each stage can be opened from here. A stage without a link isn't available yet. */
  links?: Partial<Record<Stage, string>>;
}

/**
 * The request authoring navigation: Intake → Request Setup → Review & Submit. It shows where the
 * user is and, where allowed, lets them move between stages. It is the way back to Intake from Request Setup.
 */
export function StageStepper({ active, links = {} }: StageStepperProps) {
  const activeIndex = STAGES.findIndex((stage) => stage.id === active);
  return (
    <Box component="nav" aria-label="Request authoring" sx={{ mb: 3, maxWidth: 640 }}>
      <Box component="ol" sx={{ display: 'flex', alignItems: 'center', listStyle: 'none', m: 0, p: 0 }}>
        {STAGES.map((stage, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          const href = current ? undefined : links[stage.id];
          const content = (
            <>
              <Box
                aria-hidden
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'common.white',
                  bgcolor: done || current ? 'primary.main' : 'text.disabled',
                }}
              >
                {done ? <CheckIcon sx={{ fontSize: 16 }} /> : index + 1}
              </Box>
              <Box component="span" sx={{ fontWeight: current ? 700 : 400, color: current || href ? 'text.primary' : 'text.secondary' }}>
                {stage.label}
                {done && <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> (completed)</Box>}
              </Box>
            </>
          );
          return (
            <Box
              component="li"
              key={stage.id}
              aria-current={current ? 'step' : undefined}
              sx={{ display: 'flex', alignItems: 'center', flex: index < STAGES.length - 1 ? 1 : 'none', minWidth: 0 }}
            >
              {href ? (
                <Link component={RouterLink} to={href} underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, position: 'relative', color: 'text.primary', [touch.query]: { minHeight: touch.minTarget } }}>
                  {content}
                </Link>
              ) : (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, position: 'relative' }}>{content}</Box>
              )}
              {index < STAGES.length - 1 && <Box aria-hidden sx={{ flex: 1, height: '1px', bgcolor: 'divider', mx: { xs: 1, sm: 2 }, minWidth: 12 }} />}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
