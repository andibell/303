import { useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { StatusChip } from '../../../components/common/StatusChip';
import { isBlank, textOf, withField } from '../../../domain/items/accessors';
import { SOURCE_MATERIAL_IDENTIFIER_FIELD, ITEM_DEFS, type FieldSpec } from '../../../domain/items/fieldSpecs';
import { fv } from '../../../domain/requests';
import type { BomRequest, FertCreateItem, ValidationIssue } from '../../../domain/types';
import { sectionCompleteness } from '../../../domain/validation/engine';
import { useAppStore } from '../../../store/appStore';
import { COMPLETENESS_CHIPS } from '../../work/summaries';
import { standaloneLinkSx } from '../../../theme/tokens';
import { ExecutionOutcome } from '../../../components/provenance/ExecutionOutcome';
import { SourceNote } from '../../../components/provenance/SourceNote';
import { REFERENCE_DATA_PHRASE } from '../../../components/provenance/provenance';
import { DESCRIPTION_TEMPLATES } from '../../../domain/description/templates';
import { FieldControl, type FieldLike } from './FieldControl';
import { GeneratedDescription } from './GeneratedDescription';
import { FINISHED_GOODS_CREATE_FIELDS, FINISHED_GOODS_CREATE_SECTIONS, type FieldPresentation } from './fertCreateLayout';

interface FertCreateEditorProps {
  request: BomRequest;
  item: FertCreateItem;
}

const SPECS: FieldSpec[] = ITEM_DEFS.finishedGoodsCreate.groups.main ?? [];

/**
 * The Create Finished Product editor, built from the Finished Product Create field specs. Every change goes straight
 * to the draft through the store (no second copy), so the domain re-derives issues and completeness and the
 * card, workspace and readiness all update from the same record.
 *
 * Validation is progressive: a field's issue shows once the user has left the field, or straight away for a
 * value that was already saved (for example after a reload). Untouched blank fields never show an error.
 */
export function FertCreateEditor({ request, item }: FertCreateEditorProps) {
  const updateItem = useAppStore((state) => state.updateItem);
  const fields = item.data.fields;
  const [touched, setTouched] = useState<Set<string>>(
    () => new Set(Object.entries(fields).flatMap(([id, value]) => (!isBlank(value) && value?.provenance !== 'derived' ? [id] : []))),
  );
  const started = item.completeness !== 'notStarted';
  const outcomeLabel = ITEM_DEFS.finishedGoodsCreate.executionIdentifierLabel;

  const change = (spec: FieldLike, raw: string) => {
    const current = useAppStore.getState().requests[request.id]?.items.find((entry) => entry.id === item.id);
    if (!current) return;
    const next = withField(current, 'main', spec.id, raw.trim() === '' ? undefined : fv(raw));
    updateItem(request.id, item.id, next.data);
    // A choice is a complete answer, so it counts as touched at once. Typed values wait for the user to leave.
    if (spec.options || (FINISHED_GOODS_CREATE_FIELDS[spec.id]?.control && FINISHED_GOODS_CREATE_FIELDS[spec.id].control !== 'suggest')) touch(spec.id);
  };
  const touch = (fieldId: string) => setTouched((current) => (current.has(fieldId) ? current : new Set(current).add(fieldId)));

  const issueFor = (spec: FieldLike): ValidationIssue | null => {
    if (!touched.has(spec.id)) return null;
    const own = item.issues.filter((issue) => issue.fieldId === spec.id);
    return own.find((issue) => issue.blocking) ?? own[0] ?? null;
  };

  return (
    <Box data-testid="fert-create-editor" sx={{ mt: 3 }}>
      <Typography variant="body2" component="div" color="text.secondary" sx={{ maxWidth: 760, display: 'grid', gap: 0.5 }}>
        <span>Fields marked with * are required. Changes are saved to this draft as you go.</span>
        <SourceNote kind="reference" testId="reference-data-note">
          Lists marked with this icon use {REFERENCE_DATA_PHRASE.charAt(0).toLowerCase() + REFERENCE_DATA_PHRASE.slice(1)}.
        </SourceNote>
      </Typography>

      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, maxWidth: 760 }} data-testid="inherited-justification">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Business justification
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>
          {textOf(request.context.businessJustification) || 'Not entered yet.'}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            Shared by every Request Item in this request <span aria-hidden>·</span>
          </Typography>
          <Link component={RouterLink} to={`/requests/${request.id}/intake`} variant="caption" sx={standaloneLinkSx}>
            Edit in Intake
          </Link>
        </Box>
      </Box>

      {FINISHED_GOODS_CREATE_SECTIONS.map(({ section, title, description, conceptTemplate, executionOutcome }) => {
        const template = conceptTemplate ? DESCRIPTION_TEMPLATES[conceptTemplate] : undefined;
        // A concept section shows the template's structured attributes; they are not spec fields and carry no rules.
        const entries: { field: FieldLike; presentation: FieldPresentation }[] = template
          ? template.segments.map((segment) => ({
              field: {
                id: segment.fieldId,
                label: segment.label,
                requirement: 'optional',
                helper: segment.required ? undefined : 'Optional.',
                options: segment.options,
              },
              presentation: { width: 'half', control: 'select' },
            }))
          : SPECS.filter((spec) => spec.section === section && (spec.shownWhen?.test(fields) ?? true)).map((spec) => ({
              field: spec,
              presentation: FINISHED_GOODS_CREATE_FIELDS[spec.id] ?? { width: 'full' },
            }));
        const headingId = `fert-create-${section.replace(/\W+/g, '-').toLowerCase()}`;
        const status = template ? null : sectionCompleteness(item, section);
        return (
          <Box key={section} component="section" aria-labelledby={headingId} sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography id={headingId} variant="h3" component="h3">
                {title}
              </Typography>
              {/* Section states appear once the item has been worked on, like everything else about validation. */}
              {started && status && <StatusChip {...COMPLETENESS_CHIPS[status]} />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {description}
              {template && ' All except Variant are needed to generate it.'}
            </Typography>
            <Box
              sx={{
                mt: 2,
                maxWidth: 820,
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                columnGap: 2.5,
                rowGap: 2.5,
              }}
            >
              {entries.map(({ field, presentation }) => {
                const spec = SPECS.find((entry) => entry.id === field.id);
                const descriptionTemplate = DESCRIPTION_TEMPLATES.finishedGoods;
                // The execution outcome sits beside the Source identifier before and after the execution process.
                const outcome = executionOutcome && outcomeLabel && field.id === SOURCE_MATERIAL_IDENTIFIER_FIELD && (
                  <Box key="execution-outcome" sx={{ minWidth: 0 }}>
                    <ExecutionOutcome id="execution-outcome" label={outcomeLabel} value={item.executionIdentifier} />
                  </Box>
                );
                return [
                  <Box key={field.id} sx={{ gridColumn: presentation.width === 'full' ? '1 / -1' : 'auto', minWidth: 0 }}>
                    {presentation.control === 'generated' && spec && descriptionTemplate ? (
                      <GeneratedDescription
                        spec={spec}
                        template={descriptionTemplate}
                        fields={fields}
                        issues={item.issues.filter((issue) => issue.fieldId === spec.id)}
                      />
                    ) : (
                      <FieldControl
                        spec={field}
                        presentation={presentation}
                        value={fields[field.id]}
                        issue={issueFor(field)}
                        onChange={(raw) => change(field, raw)}
                        onBlur={() => touch(field.id)}
                      />
                    )}
                  </Box>,
                  outcome,
                ];
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
