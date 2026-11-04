import { isFunctionalPath } from './businessNeeds';
import { composeDescription } from './description/compose';
import { DESCRIPTION_TEMPLATES } from './description/templates';
import { appendEvents, newEvent, type DomainContext } from './history';
import { isBlank, textOf } from './items/accessors';
import { ITEM_DEFS, itemLabel } from './items/fieldSpecs';
import { isReturnReasonId } from './returnReasons';
import { allRequiredItemsComplete } from './status';
import { generateTemplate, RECOMMENDED_ITEM_TYPES, type TemplateItemSpec } from './template';
import type {
  ActionRequiredReturn,
  Actor,
  BomRequest,
  BusinessNeedId,
  FieldMap,
  FieldValue,
  HistoryEvent,
  HistoryEventType,
  HistoryMetadata,
  ItemType,
  MaterialScenarioId,
  RequestContext,
  RequestItem,
  ReturnReasonId,
  Upload,
  ValidationIssue,
} from './types';
import { emptyValidation, evaluateRequest } from './validation/engine';

/*
 * Request lifecycle operations. Every function is pure and immutable: it takes a request and an injected
 * context (time, actor, ids, reference data) and returns a new request or a typed failure. The store only
 * calls these and keeps the result.
 */

/** What a removal changed, so the UI can explain the impact. Present only on `removeItem` results. */
export interface RemovalInfo {
  itemId: string;
  type: ItemType;
  /** The removed item was part of the recommended starting template. */
  wasRecommended: boolean;
  /** Recommended item types that are now absent from the request. */
  missingRecommended: ItemType[];
  /** Remaining item types that relied on the removed item (derived values were cleared). */
  dependentItems: ItemType[];
  /** Blocking issues and warnings after the removal. */
  blockingCount: number;
  warningCount: number;
}

export type OpResult =
  | { ok: true; request: BomRequest; removal?: RemovalInfo }
  /** `request` carries the updated record to keep (for example a Validation Failed event). */
  | { ok: false; error: string; issues?: ValidationIssue[]; request?: BomRequest };

const fail = (error: string): OpResult => ({ ok: false, error });
const ok = (request: BomRequest): OpResult => ({ ok: true, request });

const touch = (request: BomRequest, ctx: DomainContext): BomRequest => ({ ...request, updatedAt: ctx.now });
const isSubmitted = (request: BomRequest) => Boolean(request.submittedAt);
const itemEvent = (ctx: DomainContext, type: HistoryEventType, item: RequestItem, extra: HistoryMetadata = {}): HistoryEvent =>
  newEvent(ctx, type, { itemId: item.id, metadata: { itemType: item.type, ...extra } });

export const fv = (value: string | string[], provenance: FieldValue['provenance'] = 'user', sourceRef?: string): FieldValue => ({
  value,
  provenance,
  ...(sourceRef ? { sourceRef } : {}),
});

/* ------------------------------------------------------------------ derivations and evaluation */

const isDerivable = (value: FieldValue | undefined) => !value || value.provenance === 'derived' || isBlank(value);

function derive(fields: FieldMap, id: string, value: FieldValue | undefined): FieldMap {
  if (!isDerivable(fields[id])) return fields;
  const next = { ...fields };
  if (value === undefined || isBlank(value)) delete next[id];
  else next[id] = value;
  return next;
}

/**
 * System-derived values. They fill blank or already-derived fields and never
 * overwrite something the user typed.
 */
export function applyDerivations(request: BomRequest): BomRequest {
  const hasBom = request.items.some((item) => item.type === 'finishedGoodsBom');
  // Finished Product Create first, so its generated values are what Extend and Product Bill of Materials carry over.
  const items = request.items.map((item): RequestItem => {
    if (item.type !== 'finishedGoodsCreate') return item;
    let fields = derive(item.data.fields, 'finishedGoodsBomSetupNeeded', hasBom ? fv('Y', 'derived', 'Product Bill of Materials item present') : undefined);
    fields = deriveDescription(fields);
    return { ...item, data: { fields } };
  });
  const found = items.find((item) => item.type === 'finishedGoodsCreate');
  const create = found?.type === 'finishedGoodsCreate' ? found : undefined;
  // Without Finished Product Create there is nothing to derive from, so previously derived values are cleared.
  const number = create?.data.fields.externalMaterialId;
  const description = create?.data.fields.materialDescription;
  const asDerived = (value: FieldValue | undefined) => (value && !isBlank(value) ? fv(textOf(value), 'derived', 'Finished Product Create') : undefined);

  return {
    ...request,
    items: items.map((item): RequestItem => {
      switch (item.type) {
        case 'finishedGoodsCreate':
          return item;
        case 'extend':
          return {
            ...item,
            data: {
              rows: item.data.rows.map((row) =>
                row.material.kind === 'requestItem'
                  ? { ...row, fields: derive(row.fields, 'externalMaterialId', asDerived(number)) }
                  : row,
              ),
            },
          };
        case 'finishedGoodsBom': {
          let header = derive(item.data.header, 'p40Fert', asDerived(number));
          header = derive(header, 'headerDescription', asDerived(description));
          header = derive(header, 'headerMatlType', create ? fv('finishedGoods', 'derived', 'Finished Product Create') : undefined);
          return { ...item, data: { ...item.data, header } };
        }
      }
    }),
  };
}

/**
 * The generated Material Description (a working-hypothesis template, see domain/description). It fills the
 * description only when it is blank or was generated before, so a typed value is never overwritten, and clears
 * a generated value once its required attributes are incomplete. It is never shortened.
 */
function deriveDescription(fields: FieldMap): FieldMap {
  const template = DESCRIPTION_TEMPLATES.finishedGoods;
  if (!template) return fields;
  const result = composeDescription(template, fields);
  return derive(fields, template.targetFieldId, result.value ? fv(result.value, 'derived', template.id) : undefined);
}

/** Derivations, then authoring validation, so item issues and completeness are always current. */
export const refresh = (request: BomRequest, ctx: DomainContext): BomRequest =>
  evaluateRequest(applyDerivations(request), ctx.reference, ctx.now, 'authoring');

/* ------------------------------------------------------------------ drafts and intake */

export const DEFAULT_REQUEST_NAME = 'Untitled BOM Request';

export function createRequest(input: { name?: string }, ctx: DomainContext): BomRequest {
  const request: BomRequest = {
    id: ctx.newId('req'),
    name: input.name?.trim() || DEFAULT_REQUEST_NAME,
    businessNeed: null,
    materialScenario: null,
    context: {},
    items: [],
    uploads: [],
    requestor: ctx.actor,
    isValidating: false,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    history: [],
    returns: [],
    submissions: [],
    validation: emptyValidation(),
    isSynthetic: true,
  };
  return appendEvents(request, newEvent(ctx, 'draftCreated'));
}

export interface RequestDetailsPatch {
  name?: string;
  businessNeed?: BusinessNeedId | null;
  materialScenario?: MaterialScenarioId | null;
  context?: RequestContext;
}

export function updateRequestDetails(request: BomRequest, patch: RequestDetailsPatch, ctx: DomainContext): OpResult {
  if (isSubmitted(request)) return fail('A submitted request can’t be edited here.');
  return ok(refresh(touch({ ...request, ...patch, context: { ...request.context, ...patch.context } }, ctx), ctx));
}

export function saveDraft(request: BomRequest, ctx: DomainContext): OpResult {
  if (isSubmitted(request)) return fail('Only a draft can be saved.');
  return ok(appendEvents(touch(request, ctx), newEvent(ctx, 'draftSaved')));
}

export function completeIntake(request: BomRequest, ctx: DomainContext): OpResult {
  if (isSubmitted(request)) return fail('Intake can only be completed on a draft.');
  if (!request.businessNeed) return fail('Select a business need to complete Intake.');
  if (!request.materialScenario) return fail('Select a material scenario to complete Intake.');
  return ok(
    appendEvents(touch(request, ctx), newEvent(ctx, 'intakeCompleted', { metadata: { businessNeed: request.businessNeed, materialScenario: request.materialScenario } })),
  );
}

/* ------------------------------------------------------------------ request items */

const emptyData = (type: ItemType, fertId: string | undefined, ctx: DomainContext): RequestItem['data'] => {
  switch (type) {
    case 'finishedGoodsCreate':
      return { fields: {} };
    case 'extend':
      return {
        rows: fertId
          ? [{ id: ctx.newId('row'), material: { kind: 'requestItem', itemId: fertId }, materialType: 'finishedGoods', fields: {} }]
          : [],
      };
    case 'finishedGoodsBom':
      return { header: {}, components: [{ id: ctx.newId('cmp'), fields: {} }] };
  }
};

function buildItem(
  spec: TemplateItemSpec,
  fertId: string | undefined,
  ctx: DomainContext,
  options: { id?: string; recommended: boolean },
): RequestItem {
  const { id = ctx.newId('item'), recommended } = options;
  return {
    id,
    type: spec.type,
    required: spec.required,
    recommended,
    completeness: 'notStarted',
    execution: 'notSubmitted',
    issues: [],
    createdAt: ctx.now,
    updatedAt: ctx.now,
    data: emptyData(spec.type, fertId, ctx),
  } as RequestItem;
}

/** Generates the recommended template. Unsupported combinations generate nothing and say why. */
export function generateInitialItems(request: BomRequest, ctx: DomainContext): OpResult {
  if (isSubmitted(request)) return fail('Items can only be generated on a draft.');
  if (request.items.length > 0) return fail('This request already has Request Items.');
  const template = generateTemplate(request.businessNeed, request.materialScenario);
  if (!template.supported) return fail(template.reason);

  const fertId = ctx.newId('item');
  const items = template.items.map((spec) =>
    buildItem(spec, fertId, ctx, { id: spec.type === 'finishedGoodsCreate' ? fertId : undefined, recommended: true }),
  );
  const withItems = { ...request, items };
  return ok(
    refresh(
      appendEvents(touch(withItems, ctx), ...items.map((item) => itemEvent(ctx, 'itemAdded', item))),
      ctx,
    ),
  );
}

/** Why an item type can't be added right now, or null when it can. `addItem` applies the same checks. */
export function addItemBlocker(request: BomRequest, type: ItemType): string | null {
  if (isSubmitted(request)) return 'Request Items can only be added to a draft.';
  if (!isFunctionalPath(request.businessNeed, request.materialScenario)) {
    return 'Request Items can only be added on the New Product / Innovation, No New Materials path.';
  }
  if (request.items.some((item) => item.type === type)) return `${itemLabel(type)} is already part of this request.`;
  if (type === 'extend' && !request.items.some((item) => item.type === 'finishedGoodsCreate')) return 'Add Finished Product Create before Extend.';
  return null;
}

export function addItem(request: BomRequest, type: ItemType, ctx: DomainContext): OpResult {
  const blocker = addItemBlocker(request, type);
  if (blocker) return fail(blocker);
  const fertId = request.items.find((item) => item.type === 'finishedGoodsCreate')?.id;
  const item = buildItem({ type, required: true }, fertId, ctx, { recommended: RECOMMENDED_ITEM_TYPES.includes(type) });
  // Re-adding Finished Product Create re-links Extend rows whose Finished Product Create was removed. Nothing is substituted.
  const items = request.items.map((existing): RequestItem =>
    type === 'finishedGoodsCreate' && existing.type === 'extend'
      ? {
          ...existing,
          data: {
            rows: existing.data.rows.map((row) => {
              const { material } = row;
              const dangling = material.kind === 'requestItem' && !request.items.some((i) => i.id === material.itemId);
              return dangling ? { ...row, material: { kind: 'requestItem' as const, itemId: item.id } } : row;
            }),
          },
        }
      : existing,
  );
  return ok(refresh(appendEvents(touch({ ...request, items: [...items, item] }, ctx), itemEvent(ctx, 'itemAdded', item)), ctx));
}

/**
 * Removes an item from a draft. Any item, including a recommended one, may be removed: the template is a
 * starting point. Nothing is regenerated or substituted. The result carries `removal` so the UI can explain
 * when a recommended item is gone. After submission removal is refused with an error.
 */
export function removeItem(request: BomRequest, itemId: string, ctx: DomainContext): OpResult {
  if (isSubmitted(request)) return fail('Request Items can’t be removed after a request has been submitted.');
  const item = request.items.find((entry) => entry.id === itemId);
  if (!item) return fail('That Request Item doesn’t exist.');

  const remaining = request.items.filter((entry) => entry.id !== itemId);
  const next = refresh(appendEvents(touch({ ...request, items: remaining }, ctx), itemEvent(ctx, 'itemRemoved', item, { recommended: item.recommended })), ctx);
  const present = new Set(next.items.map((entry) => entry.type));
  const dependsOnFert = (type: ItemType) => item.type === 'finishedGoodsCreate' && (type === 'extend' || type === 'finishedGoodsBom');

  return {
    ok: true,
    request: next,
    removal: {
      itemId,
      type: item.type,
      wasRecommended: item.recommended,
      missingRecommended: isFunctionalPath(next.businessNeed, next.materialScenario)
        ? RECOMMENDED_ITEM_TYPES.filter((type) => !present.has(type))
        : [],
      dependentItems: next.items.map((entry) => entry.type).filter(dependsOnFert),
      blockingCount: next.validation.blockingCount,
      warningCount: next.validation.warningCount,
    },
  };
}

/** What removing an item would change, without changing anything: the same result `removeItem` reports. */
export function previewRemoval(request: BomRequest, itemId: string, ctx: DomainContext): RemovalInfo | null {
  const result = removeItem(request, itemId, ctx);
  return result.ok ? (result.removal ?? null) : null;
}

/** Replaces one item’s data. After submission only a returned item is editable. */
export function updateItem(request: BomRequest, itemId: string, data: RequestItem['data'], ctx: DomainContext): OpResult {
  const item = request.items.find((entry) => entry.id === itemId);
  if (!item) return fail('That Request Item doesn’t exist.');
  if (isSubmitted(request) && item.execution !== 'returned') return fail('Only a returned item can be edited after submission.');
  const next = { ...item, data, updatedAt: ctx.now } as RequestItem;
  return ok(refresh(touch({ ...request, items: request.items.map((entry) => (entry.id === itemId ? next : entry)) }, ctx), ctx));
}

/** Records that the requestor corrected something in response to a return. */
export function recordCorrection(request: BomRequest, ctx: DomainContext, itemId?: string): OpResult {
  const item = itemId ? request.items.find((entry) => entry.id === itemId) : undefined;
  if (itemId && !item) return fail('That Request Item doesn’t exist.');
  return ok(appendEvents(touch(request, ctx), item ? itemEvent(ctx, 'correctionMade', item) : newEvent(ctx, 'correctionMade')));
}

/* ------------------------------------------------------------------ submission */

/** Marks the submission review as running (the Validating status). */
export function startValidation(request: BomRequest): OpResult {
  if (isSubmitted(request)) return fail('This request has already been submitted.');
  return ok({ ...request, isValidating: true });
}

interface ReviewOutcome {
  request: BomRequest;
  passed: boolean;
}

/** The full simulated review before a request is submitted. */
function runSubmissionReview(request: BomRequest, ctx: DomainContext): ReviewOutcome {
  const reviewed = { ...evaluateRequest(applyDerivations(request), ctx.reference, ctx.now, 'submission'), isValidating: false };
  if (reviewed.validation.submittable && reviewed.items.length > 0) {
    return { request: appendEvents(reviewed, newEvent(ctx, 'validationPassed')), passed: true };
  }
  return {
    request: appendEvents(
      touch(reviewed, ctx),
      newEvent(ctx, 'validationFailed', { metadata: { blockingCount: Math.max(reviewed.validation.blockingCount, reviewed.items.length === 0 ? 1 : 0) } }),
    ),
    passed: false,
  };
}

const failedReview = (outcome: ReviewOutcome, hasItems: boolean): OpResult => ({
  ok: false,
  error: hasItems ? 'Validation found issues that must be fixed before submitting.' : 'Add Request Items before submitting.',
  issues: outcome.request.validation.issues.filter((issue) => issue.blocking),
  request: outcome.request,
});

export function submitRequest(request: BomRequest, ctx: DomainContext): OpResult {
  if (isSubmitted(request)) return fail('This request has already been submitted.');
  const outcome = runSubmissionReview(request, ctx);
  if (!outcome.passed) return failedReview(outcome, request.items.length > 0);

  const items = outcome.request.items.map((item): RequestItem => ({ ...item, execution: 'ready' }));
  const submitted: BomRequest = {
    ...outcome.request,
    items,
    submittedAt: ctx.now,
    submittedBy: ctx.actor,
    updatedAt: ctx.now,
    submissions: [{ version: 1, kind: 'initial', at: ctx.now, by: ctx.actor, items }],
  };
  return ok(appendEvents(submitted, newEvent(ctx, 'requestSubmitted'), newEvent(ctx, 'readyForExecution')));
}

/* ------------------------------------------------------------------ execution */

export function startExecution(request: BomRequest, ctx: DomainContext, itemIds?: string[]): OpResult {
  if (!isSubmitted(request)) return fail('Only a submitted request can be executed.');
  const targets = request.items.filter((item) => item.execution === 'ready' && (!itemIds || itemIds.includes(item.id)));
  if (targets.length === 0) return fail('No Request Items are ready for execution.');
  const ids = new Set(targets.map((item) => item.id));
  return ok(
    appendEvents(
      touch({ ...request, items: request.items.map((item) => (ids.has(item.id) ? { ...item, execution: 'inProgress' } : item)) }, ctx),
      ...targets.map((item) => itemEvent(ctx, 'executionStarted', item)),
    ),
  );
}

export interface ReturnInput {
  scope: 'request' | 'item';
  itemId?: string;
  category: ReturnReasonId;
  section?: string;
  fieldId?: string;
  requiredAction: string;
  explanation?: string;
}

/** Execution sends a request back with structured feedback. */
export function addReturn(request: BomRequest, input: ReturnInput, ctx: DomainContext): OpResult {
  if (!isSubmitted(request)) return fail('Only a submitted request can be returned.');
  if (!isReturnReasonId(input.category)) return fail('Choose a reason category.');
  if (input.requiredAction.trim() === '') return fail('Describe the action the requestor needs to take.');

  let targets: RequestItem[];
  if (input.scope === 'item') {
    const item = request.items.find((entry) => entry.id === input.itemId);
    if (!item) return fail('Choose the Request Item being returned.');
    if (item.execution === 'completed') return fail('A completed item can’t be returned.');
    targets = [item];
  } else {
    targets = request.items.filter((item) => item.execution !== 'completed');
    if (targets.length === 0) return fail('Every Request Item is already completed.');
  }

  const entry: ActionRequiredReturn = {
    id: ctx.newId('ret'),
    scope: input.scope,
    ...(input.scope === 'item' ? { itemId: input.itemId } : {}),
    category: input.category,
    ...(input.section ? { section: input.section } : {}),
    ...(input.fieldId ? { fieldId: input.fieldId } : {}),
    requiredAction: input.requiredAction.trim(),
    ...(input.explanation?.trim() ? { explanation: input.explanation.trim() } : {}),
    createdBy: ctx.actor,
    createdAt: ctx.now,
    resolution: { state: 'open' },
  };
  const ids = new Set(targets.map((item) => item.id));
  const events =
    input.scope === 'item'
      ? [itemEvent(ctx, 'actionRequired', targets[0], { category: input.category, scope: 'item', returnId: entry.id })]
      : [newEvent(ctx, 'actionRequired', { metadata: { category: input.category, scope: 'request', returnId: entry.id } })];

  return ok(
    appendEvents(
      touch(
        {
          ...request,
          returns: [...request.returns, entry],
          items: request.items.map((item): RequestItem => (ids.has(item.id) ? { ...item, execution: 'returned' } : item)),
        },
        ctx,
      ),
      ...events,
    ),
  );
}

/** The requestor acknowledges a return as addressed. The item stays returned until the request is resubmitted. */
export function resolveReturn(request: BomRequest, returnId: string, ctx: DomainContext): OpResult {
  const entry = request.returns.find((candidate) => candidate.id === returnId);
  if (!entry) return fail('That return doesn’t exist.');
  if (entry.resolution.state === 'resolved') return fail('That return is already resolved.');
  const item = entry.itemId ? request.items.find((candidate) => candidate.id === entry.itemId) : undefined;
  return ok(
    appendEvents(
      touch(
        {
          ...request,
          returns: request.returns.map((candidate) =>
            candidate.id === returnId
              ? { ...candidate, resolution: { state: 'resolved', resolvedAt: ctx.now, resolvedBy: ctx.actor } }
              : candidate,
          ),
        },
        ctx,
      ),
      item ? itemEvent(ctx, 'correctionMade', item, { returnId }) : newEvent(ctx, 'correctionMade', { metadata: { returnId } }),
    ),
  );
}

/** Resubmission is a history event, not a status. Returned items go back to Ready. */
export function resubmitRequest(request: BomRequest, ctx: DomainContext): OpResult {
  if (!isSubmitted(request)) return fail('Only a submitted request can be resubmitted.');
  if (!request.items.some((item) => item.execution === 'returned')) return fail('Nothing was returned on this request.');
  const outcome = runSubmissionReview(request, ctx);
  if (!outcome.passed) return failedReview(outcome, true);

  const version = request.submissions.length + 1;
  const items = outcome.request.items.map((item): RequestItem => (item.execution === 'returned' ? { ...item, execution: 'ready' } : item));
  const resubmitted: BomRequest = {
    ...outcome.request,
    items,
    updatedAt: ctx.now,
    returns: request.returns.map((entry) =>
      entry.resolution.state === 'open'
        ? { ...entry, resolution: { state: 'resolved', resolvedAt: ctx.now, resolvedBy: ctx.actor, resubmissionVersion: version } }
        : entry,
    ),
    submissions: [...request.submissions, { version, kind: 'resubmission', at: ctx.now, by: ctx.actor, items }],
  };
  return ok(appendEvents(resubmitted, newEvent(ctx, 'requestResubmitted', { metadata: { version } }), newEvent(ctx, 'readyForExecution')));
}

/* ------------------------------------------------------------------ completion */

const canExecute = (item: RequestItem) => item.execution === 'ready' || item.execution === 'inProgress';

/** Records the manually entered Execution Identifier without completing the item. */
export function recordSystemIdentifier(request: BomRequest, itemId: string, executionIdentifier: string, ctx: DomainContext): OpResult {
  const item = request.items.find((entry) => entry.id === itemId);
  if (!item) return fail('That Request Item doesn’t exist.');
  if (!canExecute(item)) return fail('An Execution Identifier can only be recorded on an item that is ready or in progress.');
  const value = executionIdentifier.trim();
  if (value === '') return fail('Enter the Execution Identifier.');
  return ok(
    appendEvents(
      touch(
        {
          ...request,
          items: request.items.map((entry) =>
            entry.id === itemId ? { ...entry, executionIdentifier: value, executionIdentifierRecordedAt: ctx.now } : entry,
          ),
        },
        ctx,
      ),
      itemEvent(ctx, 'executionIdentifierRecorded', item, { executionIdentifier: value }),
    ),
  );
}

/**
 * Completes one item. The Execution Identifier is the only thing the user types; who completed it, when, the
 * status change and the history are captured automatically. When every required item is complete the
 * parent completes too, and moves to Completed.
 */
export function completeItem(
  request: BomRequest,
  itemId: string,
  ctx: DomainContext,
  options: { executionIdentifier?: string } = {},
): OpResult {
  const item = request.items.find((entry) => entry.id === itemId);
  if (!item) return fail('That Request Item doesn’t exist.');
  if (item.execution === 'completed') return fail('That item is already completed.');
  if (item.execution === 'returned') return fail('That item was returned and must be corrected and resubmitted first.');
  if (!canExecute(item)) return fail('That item isn’t ready for execution.');

  const supplied = options.executionIdentifier?.trim();
  const executionIdentifier = supplied || item.executionIdentifier;
  if (ITEM_DEFS[item.type].requiresExecutionIdentifier && !executionIdentifier) {
    return fail('Enter the Execution Identifier to complete this item.');
  }

  let next: BomRequest = request;
  if (executionIdentifier && executionIdentifier !== item.executionIdentifier) {
    const recorded = recordSystemIdentifier(request, itemId, executionIdentifier, ctx);
    if (!recorded.ok) return recorded;
    next = recorded.request;
  }
  const completedBy: Actor = ctx.actor;
  next = appendEvents(
    touch(
      {
        ...next,
        items: next.items.map((entry): RequestItem =>
          entry.id === itemId ? { ...entry, execution: 'completed', completion: { completedBy, completedAt: ctx.now } } : entry,
        ),
      },
      ctx,
    ),
    itemEvent(ctx, 'itemCompleted', item),
  );
  if (allRequiredItemsComplete(next)) {
    next = appendEvents({ ...next, completedAt: ctx.now }, newEvent(ctx, 'requestCompleted'));
  }
  return ok(next);
}

/** Generic append for events the lifecycle operations don’t cover. History stays append-only. */
export function appendHistory(
  request: BomRequest,
  type: HistoryEventType,
  ctx: DomainContext,
  extras: { itemId?: string; metadata?: HistoryMetadata } = {},
): BomRequest {
  return appendEvents(request, newEvent(ctx, type, extras));
}


/** Attaches a (simulated) upload and records which fields it populated. Nothing is parsed in the POC. */
export function addUpload(
  request: BomRequest,
  input: { fileName: string; kind: Upload['kind']; populatedFields: string[]; sizeBytes?: number },
  ctx: DomainContext,
): OpResult {
  if (isSubmitted(request)) return fail('Uploads can only be added to a draft.');
  if (input.fileName.trim() === '') return fail('An upload needs a file name.');
  const upload: Upload = {
    id: ctx.newId('upl'),
    fileName: input.fileName.trim(),
    ...(input.sizeBytes !== undefined ? { sizeBytes: input.sizeBytes } : {}),
    kind: input.kind,
    uploadedAt: ctx.now,
    uploadedBy: ctx.actor,
    simulated: true,
    populatedFields: input.populatedFields,
  };
  return ok(touch({ ...request, uploads: [...request.uploads, upload] }, ctx));
}

/** Removes an upload from a draft, for example before replacing it. */
export function removeUpload(request: BomRequest, uploadId: string, ctx: DomainContext): OpResult {
  if (isSubmitted(request)) return fail('Uploads can only be changed on a draft.');
  if (!request.uploads.some((upload) => upload.id === uploadId)) return fail('That upload doesn’t exist.');
  return ok(touch({ ...request, uploads: request.uploads.filter((upload) => upload.id !== uploadId) }, ctx));
}
