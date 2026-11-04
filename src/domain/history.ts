import { itemLabel } from './items/fieldSpecs';
import { returnReasonLabel } from './returnReasons';
import type { Actor, BomRequest, HistoryEvent, HistoryEventType, HistoryMetadata, ItemType, ReturnReasonId } from './types';

/**
 * Injected time, identity and reference data. Keeping these out of the domain functions makes every
 * operation deterministic and testable.
 */
export interface DomainContext {
  now: string;
  actor: Actor;
  newId: (prefix: string) => string;
  reference: import('./referenceTypes').ReferenceData;
}

export function newEvent(
  ctx: DomainContext,
  type: HistoryEventType,
  extras: { itemId?: string; metadata?: HistoryMetadata } = {},
): HistoryEvent {
  return { id: ctx.newId('evt'), type, at: ctx.now, actor: ctx.actor, ...extras };
}

/** History is append-only: this returns a longer list and never edits or removes an entry. */
export function appendEvents(request: BomRequest, ...events: HistoryEvent[]): BomRequest {
  return { ...request, history: [...request.history, ...events] };
}

const meta = <T extends string | number | boolean | string[]>(event: HistoryEvent, key: string): T | undefined =>
  event.metadata?.[key] as T | undefined;

/** Plain-language label for display. Technical event names are never shown to users. */
export function describeEvent(event: HistoryEvent): string {
  const itemType = meta<ItemType>(event, 'itemType');
  const item = itemType ? itemLabel(itemType) : 'Request item';
  switch (event.type) {
    case 'draftCreated':
      return 'Draft created';
    case 'draftSaved':
      return 'Draft saved';
    case 'intakeCompleted':
      return 'Intake completed';
    case 'itemAdded':
      return `${item} added`;
    case 'itemRemoved':
      return `${item} removed`;
    case 'validationFailed':
      return `Validation found ${meta<number>(event, 'blockingCount') ?? 0} issue(s) to fix`;
    case 'validationPassed':
      return 'Validation passed';
    case 'requestSubmitted':
      return 'Request submitted';
    case 'readyForExecution':
      return 'Ready for execution';
    case 'executionStarted':
      return `Execution started on ${item}`;
    case 'actionRequired': {
      const reason = meta<ReturnReasonId>(event, 'category');
      const scope = meta<string>(event, 'scope') === 'request' ? 'the request' : item;
      return `Returned for action on ${scope}${reason ? `: ${returnReasonLabel(reason)}` : ''}`;
    }
    case 'correctionMade':
      return itemType ? `Correction made to ${item}` : 'Correction made';
    case 'requestResubmitted':
      return `Request resubmitted (submission ${meta<number>(event, 'version') ?? 2})`;
    case 'itemCompleted':
      return `${item} completed`;
    case 'executionIdentifierRecorded':
      return `Execution Identifier ${meta<string>(event, 'executionIdentifier') ?? ''} recorded for ${item}`.replace('  ', ' ');
    case 'requestCompleted':
      return 'Request completed';
  }
}
