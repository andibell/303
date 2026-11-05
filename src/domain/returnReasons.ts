import type { ReturnReasonId } from './types';

/**
 * Provisional working taxonomy of return reasons. Example categories only; the final list
 * needs confirmation. UI reads this list rather than hard-coding the categories.
 */
export interface ReturnReasonOption {
  id: ReturnReasonId;
  label: string;
  hint: string;
}

export const RETURN_REASONS: readonly ReturnReasonOption[] = [
  { id: 'missingInformation', label: 'Missing information', hint: 'Something needed to execute is blank or not provided.' },
  { id: 'invalidReference', label: 'Invalid material or reference value', hint: 'A material, plant or code could not be found or used.' },
  { id: 'plantOrExtension', label: 'Plant or extension issue', hint: 'A plant or an extension can’t be set up as requested.' },
  { id: 'conflictingData', label: 'Conflicting data', hint: 'Two pieces of information in the request disagree.' },
  { id: 'unsupportedCombination', label: 'Unsupported request combination', hint: 'The combination of items or values isn’t supported.' },
  { id: 'approvalNeeded', label: 'Business approval needed', hint: 'An approval is required before execution can continue.' },
  { id: 'systemConstraint', label: 'Execution constraint', hint: 'The execution team can’t accept the entry.' },
  { id: 'other', label: 'Other', hint: 'None of the categories fit; explain below.' },
];

export const returnReasonLabel = (id: ReturnReasonId) => RETURN_REASONS.find((r) => r.id === id)?.label ?? id;
export const isReturnReasonId = (value: unknown): value is ReturnReasonId =>
  RETURN_REASONS.some((reason) => reason.id === value);
