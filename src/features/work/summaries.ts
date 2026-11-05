import { REFERENCE_DATA } from '../../data/reference';
import { businessNeedLabel, isFunctionalPath, materialScenarioLabel } from '../../domain/businessNeeds';
import { describeEvent } from '../../domain/history';
import { itemLabel } from '../../domain/items/fieldSpecs';
import { itemBusinessName } from '../../domain/items/itemNames';
import { getRequestStatus, itemProgress, STATUS_LABELS } from '../../domain/status';
import type { BomRequest, Completeness, RequestStatus } from '../../domain/types';
import { isReadyForReview } from '../../domain/validation/engine';
import type { StatusTone } from '../../components/common/StatusChip';

/*
 * Presentation helpers for the BOM Work lists. They only read what the domain already derives
 * (status, progress, completeness, history); no lifecycle logic is repeated here.
 */

export const STATUS_TONES: Record<RequestStatus, StatusTone> = {
  draft: 'neutral',
  validating: 'info',
  readyForExecution: 'info',
  inProgress: 'info',
  actionRequired: 'warning',
  completed: 'success',
};

export const requestStatusChip = (request: BomRequest): { label: string; tone: StatusTone } => {
  const status = getRequestStatus(request);
  return { label: STATUS_LABELS[status], tone: STATUS_TONES[status] };
};

export const businessNeedText = (request: BomRequest): string =>
  request.businessNeed ? businessNeedLabel(request.businessNeed) : 'Not selected yet';

export const scenarioText = (request: BomRequest): string =>
  request.materialScenario ? materialScenarioLabel(request.materialScenario) : '—';

/**
 * True when the saved path is visible in the product model but planned for a future phase. A New Product
 * request that hasn't answered the material scenario yet is simply still in Intake.
 */
export const isFuturePhase = (request: BomRequest): boolean => {
  const { businessNeed, materialScenario } = request;
  if (!businessNeed) return false;
  if (businessNeed === 'newProduct' && materialScenario === null) return false;
  return !isFunctionalPath(businessNeed, materialScenario);
};

/** Intake has handed this draft over to Request Setup (its starting template has been generated once). */
export const hasCompletedIntake = (request: BomRequest): boolean =>
  request.history.some((event) => event.type === 'intakeCompleted');

/** Where "Continue" on a draft leads: Intake until it has handed over, then Request Setup. */
export const draftContinuePath = (request: BomRequest): string =>
  request.items.length > 0 || hasCompletedIntake(request) ? `/requests/${request.id}/setup` : `/requests/${request.id}/intake`;

/** "2 of 3 items complete" for a draft (authoring completeness) or a submitted request (execution). */
export function itemSummary(request: BomRequest): string {
  const total = request.items.length;
  if (total === 0) return 'No items yet';
  if (request.submittedAt) {
    const { completed, total: required } = itemProgress(request);
    return `${completed} of ${required} items complete`;
  }
  const complete = request.items.filter((item) => item.completeness === 'complete').length;
  return `${complete} of ${total} items ready`;
}

/** The included work in business terms ("Create Finished Product · Build Product BOM"), or null when there is none. */
export const itemNamesSummary = (request: BomRequest): string | null =>
  request.items.length > 0 ? request.items.map((item) => itemBusinessName(item.type)).join(' · ') : null;

/** The most useful single fact about where a draft stands. */
export function draftState(request: BomRequest): { label: string; tone: StatusTone } {
  if (isFuturePhase(request)) return { label: 'Future phase', tone: 'info' };
  if (request.items.length === 0) return { label: 'Intake in progress', tone: 'neutral' };
  const attention = request.items.filter((item) => item.completeness === 'hasIssues').length;
  if (attention > 0) return { label: `${attention} ${attention === 1 ? 'item needs' : 'items need'} attention`, tone: 'warning' };
  if (isReadyForReview(request, REFERENCE_DATA)) return { label: 'Ready to review', tone: 'success' };
  return { label: 'In progress', tone: 'neutral' };
}

export function lastActivity(request: BomRequest): { text: string; at: string } {
  const last = request.history.at(-1);
  return last ? { text: describeEvent(last), at: last.at } : { text: '—', at: request.updatedAt };
}

/** Compact Execution Identifier summary for a completed request: the first identifier and how many more. */
export function executionIdentifierSummary(request: BomRequest): string {
  const ids = request.items.flatMap((item) => (item.executionIdentifier ? [item.executionIdentifier] : []));
  if (ids.length === 0) return '—';
  return ids.length === 1 ? ids[0] : `${ids[0]} +${ids.length - 1} more`;
}

export const executionIdentifierDetail = (request: BomRequest): string =>
  request.items
    .filter((item) => item.executionIdentifier)
    .map((item) => `${itemLabel(item.type)}: ${item.executionIdentifier}`)
    .join('\n');

export const COMPLETENESS_CHIPS: Record<Completeness, { label: string; tone: StatusTone }> = {
  notStarted: { label: 'Not started', tone: 'neutral' },
  inProgress: { label: 'In progress', tone: 'neutral' },
  hasIssues: { label: 'Needs attention', tone: 'warning' },
  complete: { label: 'Complete', tone: 'success' },
};

/**
 * The authoring stages a draft can open from its pages. Intake is always available. Request Setup and Review &
 * Submit open once Intake has handed over on the functional path.
 */
export function stageLinks(request: BomRequest): Partial<Record<'intake' | 'setup' | 'review', string>> {
  const base = `/requests/${request.id}`;
  const handedOver =
    isFunctionalPath(request.businessNeed, request.materialScenario) && (request.items.length > 0 || hasCompletedIntake(request));
  return handedOver ? { intake: `${base}/intake`, setup: `${base}/setup`, review: `${base}/review` } : { intake: `${base}/intake` };
}
