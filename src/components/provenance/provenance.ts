import type { FieldValue } from '../../domain/types';

/*
 * The provenance vocabulary for authoring screens. Request data (typed or chosen by the Requestor) is the default
 * and is never marked. Reference, generated and uploaded values get one restrained, consistent treatment.
 * Execution outcomes (values execution process produces, recorded by the Execution Specialist) are shown read-only.
 * Execution destination (information for execution) is kept in the field specs (`route`, `executionField`) for
 * Review & Submit and the execution package; it is deliberately not shown while authoring.
 */

/** 'execution' marks an outcome of downstream execution process, such as an assigned Execution Identifier. */
export type SourceKind = 'reference' | 'generated' | 'upload' | 'execution';

export const REFERENCE_DATA_PHRASE = 'Fictional demo reference data · static sample · not connected to a live system';

/** Business wording for each derivation source the domain records. Unknown sources get the generic sentence. */
const GENERATED_EXPLANATIONS: Record<string, string> = {
  'Product Bill of Materials item present': 'Generated because Build Product BOM is included in this request.',
  'Finished Product Create': 'From Create Finished Product.',
  'fert-description-concept': 'Generated from the structured product information below.',
};
export const GENERATED_FALLBACK = 'Generated from request information.';

/** How to describe where a value came from, or null for the Requestor's own entry (which is never marked). */
export function sourceNoteFor(value: FieldValue | undefined): { kind: SourceKind; text: string } | null {
  if (!value || value.provenance === 'user') return null;
  switch (value.provenance) {
    case 'derived':
      return { kind: 'generated', text: (value.sourceRef && GENERATED_EXPLANATIONS[value.sourceRef]) ?? GENERATED_FALLBACK };
    case 'upload':
      return { kind: 'upload', text: `From ${value.sourceRef ?? 'an uploaded file'}.` };
    case 'reference':
      return { kind: 'reference', text: REFERENCE_DATA_PHRASE };
  }
}
