import type { ReactNode } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { REFERENCE_DATA } from '../../../data/reference';
import { ReferenceIndicator } from '../../../components/provenance/ReferenceIndicator';
import { SourceNote } from '../../../components/provenance/SourceNote';
import { sourceNoteFor } from '../../../components/provenance/provenance';
import type { FieldSpec } from '../../../domain/items/fieldSpecs';
import type { Choice } from '../../../domain/referenceTypes';
import type { FieldValue, ValidationIssue } from '../../../domain/types';
import type { FieldPresentation } from './fertCreateLayout';

/**
 * What the control needs to know about a field. A FieldSpec satisfies it; so does a concept field from a
 * description template, which supplies its own options instead of a reference list.
 */
export type FieldLike = Pick<FieldSpec, 'id' | 'label' | 'requirement' | 'helper' | 'maxLength' | 'choices' | 'choiceNotes' | 'origin'> & {
  options?: readonly Choice[];
};

interface FieldControlProps {
  spec: FieldLike;
  presentation: FieldPresentation;
  value: FieldValue | undefined;
  /** The domain's issue for this field, already filtered for whether it should show yet. */
  issue: ValidationIssue | null;
  onChange: (raw: string) => void;
  onBlur: () => void;
}

const rawOf = (value: FieldValue | undefined): string => (value ? (Array.isArray(value.value) ? value.value.join(', ') : value.value) : '');

/**
 * One field from its spec and presentation. MUI wires the label, required state, helper/error text and
 * aria-invalid/aria-describedby. Errors and warnings are the domain's own messages.
 */
export function FieldControl({ spec, presentation, value, issue, onChange, onBlur }: FieldControlProps) {
  const id = `field-${spec.id}`;
  const raw = rawOf(value);
  const error = issue?.severity === 'error';
  const control = presentation.control ?? 'text';
  const source = sourceNoteFor(value);
  const options: readonly Choice[] = spec.options ?? (spec.choices ? REFERENCE_DATA[spec.choices] : []);
  const note = spec.choiceNotes?.[raw];

  const counter =
    presentation.counter === 'characters' && spec.maxLength !== undefined
      ? counterText(raw.trim().length, spec.maxLength)
      : presentation.counter === 'digits'
        ? `${raw.replace(/\D/g, '').length} ${raw.replace(/\D/g, '').length === 1 ? 'digit' : 'digits'}`
        : null;

  const helper: ReactNode = (
    <Box component="span" sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
      <span>
        {spec.origin === 'reference' && <ReferenceIndicator />}
        {issue ? (
          <>
            {issue.severity === 'warning' && (
              <>
                <strong>Warning:</strong>{' '}
              </>
            )}
            {issue.message}
          </>
        ) : (
          spec.helper
        )}
        {source && (
          <SourceNote kind={source.kind} testId={`${id}-provenance`}>
            {source.text}
          </SourceNote>
        )}
      </span>
      {counter && (
        <Box component="span" sx={{ flexShrink: 0, color: raw.trim().length > (spec.maxLength ?? Infinity) ? 'error.main' : 'text.secondary' }}>
          {counter}
        </Box>
      )}
    </Box>
  );

  const noteLine = note && (
    <Typography variant="caption" component="p" sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', mt: 0.75, color: 'text.secondary' }} data-testid={`${id}-note`}>
      <InfoOutlinedIcon sx={{ fontSize: 16, mt: '1px' }} aria-hidden />
      {note.text}
    </Typography>
  );

  if (control === 'radio' && options.length > 0) {
    return (
      <FormControl component="fieldset" error={error} required={spec.requirement === 'required'} sx={{ display: 'block' }}>
        <FormLabel component="legend" id={`${id}-label`} sx={{ color: 'text.primary', '&.Mui-focused': { color: 'text.primary' }, fontWeight: 600, fontSize: '0.875rem' }}>
          {spec.label}
        </FormLabel>
        <RadioGroup
          row
          name={id}
          value={raw}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-describedby={`${id}-helper`}
        >
          {options.map((option) => (
            <FormControlLabel
              key={option.id}
              value={option.id}
              control={<Radio size="small" />}
              label={
                <span>
                  {option.label}
                  {(option.code || option.detail) && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                      {[option.code, option.detail].filter(Boolean).join(' · ')}
                    </Typography>
                  )}
                </span>
              }
              sx={{ mr: 3 }}
            />
          ))}
        </RadioGroup>
        <FormHelperText id={`${id}-helper`} sx={{ mx: 0 }}>
          {helper}
        </FormHelperText>
        {noteLine}
      </FormControl>
    );
  }

  if (control === 'suggest' && presentation.suggestions) {
    const options = REFERENCE_DATA[presentation.suggestions];
    return (
      <Autocomplete
        freeSolo
        id={id}
        options={options.map((option) => option.id)}
        getOptionLabel={(option) => options.find((o) => o.id === option)?.label ?? option}
        inputValue={raw}
        onInputChange={(_, next, reason) => {
          if (reason !== 'reset' || next !== '') onChange(options.find((o) => o.label === next)?.id ?? next);
        }}
        onBlur={onBlur}
        renderInput={(params) => (
          <TextField
            {...params}
            label={spec.label}
            required={spec.requirement === 'required'}
            error={error}
            helperText={helper}
          />
        )}
      />
    );
  }

  return (
    <Box>
      <TextField
        id={id}
        select={control === 'select'}
        label={spec.label}
        required={spec.requirement === 'required'}
        fullWidth
        value={raw}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        error={error}
        helperText={helper}
        slotProps={{
          htmlInput: presentation.inputMode ? { inputMode: presentation.inputMode } : undefined,
          input: presentation.unit ? { endAdornment: <InputAdornment position="end">{presentation.unit}</InputAdornment> } : undefined,
        }}
      >
        {control === 'select' && spec.requirement === 'optional' && (
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
        )}
        {control === 'select' &&
          options.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          ))}
      </TextField>
      {noteLine}
    </Box>
  );
}

function counterText(length: number, max: number): string {
  if (length <= max) return `${length}/${max}`;
  return `${length}/${max} · ${length - max} over`;
}
