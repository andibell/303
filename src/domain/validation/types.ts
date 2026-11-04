import type { BomRequest, IssueCategory, IssueSeverity, ItemType, SourceRef } from '../types';
import type { ReferenceData } from '../referenceTypes';

/*
 * Validation rules are data plus a pure function. They know nothing about React. `authoring` rules
 * run while the user works, and `submission` runs the full set of checks.
 */

export type ValidationPhase = 'authoring' | 'submission';

/** A rule's raw result; the engine turns it into a ValidationIssue. */
export interface RuleFinding {
  itemId?: string;
  rowId?: string;
  section?: string;
  fieldId?: string;
  message: string;
}

export interface RuleContext {
  request: BomRequest;
  reference: ReferenceData;
}

export interface ValidationRule {
  id: string;
  description: string;
  severity: IssueSeverity;
  category: IssueCategory;
  /** `authoring` rules also run at submission; `submission` rules run only there. */
  phase: ValidationPhase;
  appliesTo: ItemType | 'request';
  /** Where the rule comes from. Every rule must cite one. */
  source: SourceRef;
  evaluate: (context: RuleContext) => RuleFinding[];
}
