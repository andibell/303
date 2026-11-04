import type { ReferenceData } from '../referenceTypes';
import { fieldGroups, hasUserContent, isBlank } from '../items/accessors';
import type { BomRequest, Completeness, RequestItem, ValidationIssue, ValidationState } from '../types';
import { RULES } from './rules';
import type { ValidationPhase, ValidationRule } from './types';

/** Runs the rules and returns every issue, blocking and not. Pure: no clock, no randomness. */
export function validateRequest(
  request: BomRequest,
  reference: ReferenceData,
  phase: ValidationPhase = 'submission',
  rules: readonly ValidationRule[] = RULES,
): ValidationIssue[] {
  const itemsById = new Map(request.items.map((item) => [item.id, item]));
  const issues: ValidationIssue[] = [];

  for (const rule of rules) {
    if (rule.phase === 'submission' && phase === 'authoring') continue;
    for (const finding of rule.evaluate({ request, reference })) {
      issues.push({
        id: [rule.id, finding.itemId ?? '', finding.rowId ?? '', finding.fieldId ?? ''].join('|'),
        ruleId: rule.id,
        severity: rule.severity,
        category: rule.category,
        message: finding.message,
        blocking: rule.severity === 'error',
        itemId: finding.itemId,
        itemType: finding.itemId ? itemsById.get(finding.itemId)?.type : undefined,
        rowId: finding.rowId,
        section: finding.section,
        fieldId: finding.fieldId,
        source: rule.source,
      });
    }
  }
  return issues;
}

/**
 * Authoring status of one item, from its issues:
 *  notStarted  nothing entered by the user
 *  hasIssues   a value breaks a rule (blocked by validation)
 *  inProgress  something is still missing, but nothing is wrong yet
 *  complete    nothing missing and nothing wrong
 */
export function deriveCompleteness(item: RequestItem, issues: ValidationIssue[]): Completeness {
  if (!hasUserContent(item)) return 'notStarted';
  return completenessOf(issues.filter((issue) => issue.itemId === item.id));
}

const completenessOf = (issues: ValidationIssue[]): Completeness => {
  if (issues.some((issue) => issue.blocking && issue.category !== 'missing')) return 'hasIssues';
  if (issues.some((issue) => issue.category === 'missing')) return 'inProgress';
  return 'complete';
};

/**
 * The same states for one section of an item's fields (by `FieldSpec.section`), from the item's current issues.
 * A section with nothing entered by the user is not started, exactly as for a whole item.
 */
export function sectionCompleteness(item: RequestItem, section: string): Completeness {
  const groups = fieldGroups(item);
  const fieldIds = new Set(groups.flatMap((group) => group.specs.filter((spec) => spec.section === section).map((spec) => spec.id)));
  const entered = groups.some((group) =>
    Object.entries(group.fields).some(([id, value]) => fieldIds.has(id) && !isBlank(value) && value?.provenance !== 'derived'),
  );
  if (!entered) return 'notStarted';
  return completenessOf(item.issues.filter((issue) => issue.section === section));
}

export function summarize(issues: ValidationIssue[], phase: ValidationPhase, evaluatedAt: string | null): ValidationState {
  const blockingCount = issues.filter((issue) => issue.blocking).length;
  return {
    evaluatedAt,
    phase,
    issues,
    blockingCount,
    warningCount: issues.length - blockingCount,
    submittable: blockingCount === 0,
  };
}

export const emptyValidation = (): ValidationState => summarize([], 'authoring', null);

/** Recomputes the request's validation state and each item's issues and completeness. */
export function evaluateRequest(
  request: BomRequest,
  reference: ReferenceData,
  now: string,
  phase: ValidationPhase = 'authoring',
): BomRequest {
  const issues = validateRequest(request, reference, phase);
  return {
    ...request,
    items: request.items.map((item) => ({
      ...item,
      issues: issues.filter((issue) => issue.itemId === item.id),
      completeness: deriveCompleteness(item, issues),
    })),
    validation: summarize(issues, phase, now),
  };
}

export const isReadyForReview = (request: BomRequest): boolean =>
  request.items.length > 0 && request.items.every((item) => item.completeness === 'complete') && request.validation.submittable;

