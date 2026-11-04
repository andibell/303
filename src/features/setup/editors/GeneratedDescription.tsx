import Box from '@mui/material/Box';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { GeneratedValue } from '../../../components/provenance/GeneratedValue';
import { SourceNote } from '../../../components/provenance/SourceNote';
import { sourceNoteFor } from '../../../components/provenance/provenance';
import { composeDescription } from '../../../domain/description/compose';
import type { DescriptionTemplate } from '../../../domain/description/templates';
import { isBlank, textOf } from '../../../domain/items/accessors';
import type { FieldSpec } from '../../../domain/items/fieldSpecs';
import type { FieldMap, ValidationIssue } from '../../../domain/types';

interface GeneratedDescriptionProps {
  spec: FieldSpec;
  template: DescriptionTemplate;
  fields: FieldMap;
  /** The domain's issues for the description field (only an over-length issue is shown). */
  issues: ValidationIssue[];
}

/**
 * The Material Description as a read-only generated value. The domain generates and stores it
 * (applyDerivations → composeDescription); this only displays the stored value, the domain's preview while it
 * is incomplete, and the domain's issue when the result breaks the authoritative 40-character limit.
 */
export function GeneratedDescription({ spec, template, fields, issues }: GeneratedDescriptionProps) {
  const id = `field-${spec.id}`;
  const result = composeDescription(template, fields);
  const stored = fields[spec.id];
  const value = !isBlank(stored) ? textOf(stored) : null;
  const max = spec.maxLength ?? template.maxLength;
  const overBy = value ? Math.max(0, value.length - max) : 0;
  const tooLong = issues.find((issue) => issue.ruleId.endsWith('.maxLength'));
  const source = sourceNoteFor(stored);
  const started = result.parts.some((part) => part.token !== null);

  return (
    <GeneratedValue
      id={id}
      label={spec.label}
      required={spec.requirement === 'required'}
      value={value}
      invalid={overBy > 0}
      pending={
        <>
          Complete the product information below to generate the description.
          {started && (
            <Box component="span" sx={{ display: 'block', mt: 0.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }} data-testid={`${id}-preview`}>
              {result.preview}
            </Box>
          )}
        </>
      }
      meta={value ? `${value.length} / ${max} characters${overBy > 0 ? ` · ${overBy} over` : ''}` : undefined}
    >
      {overBy > 0 && (
        <Box component="span" sx={{ color: 'error.main' }} data-testid={`${id}-error`}>
          {tooLong?.message ?? `${spec.label} can be at most ${max} characters.`} Choose a shorter combination below. Nothing is shortened
          automatically, because no abbreviation rules have been validated for the description format.
        </Box>
      )}
      {source && (
        <SourceNote kind={source.kind} testId={`${id}-provenance`}>
          {source.text}
        </SourceNote>
      )}
      {template.status === 'hypothesis' && (
        <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, color: 'text.secondary' }} data-testid={`${id}-concept`}>
          <InfoOutlinedIcon aria-hidden sx={{ fontSize: 14, mt: '2px' }} />
          Description builder concept · format requires business validation
        </Box>
      )}
    </GeneratedValue>
  );
}
