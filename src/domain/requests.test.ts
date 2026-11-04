import { describeEvent } from './history';
import {
  addItem,
  addItemBlocker,
  previewRemoval,
  addUpload,
  removeUpload,
  addReturn,
  completeItem,
  createRequest,
  generateInitialItems,
  recordSystemIdentifier,
  removeItem,
  resolveReturn,
  resubmitRequest,
  startExecution,
  submitRequest,
  updateItem,
  updateRequestDetails,
  completeIntake,
  fv,
} from './requests';
import { getLifecycle, getRequestStatus, groupByLifecycle, itemProgress } from './status';
import type { BomRequest, ExtendItem, HistoryEventType } from './types';
import { EXECUTOR, itemOf, makeCtx, must, REQUESTOR, templateDraft, validDraft, deepFreeze } from '../test/fixtures';

const submitted = () => {
  const { request, ctx } = validDraft();
  return { request: must(submitRequest(request, ctx())), ctx };
};
const types = (request: BomRequest): HistoryEventType[] => request.history.map((event) => event.type);

describe('drafts and intake', () => {
  it('starts as a Draft in the Drafts lifecycle with a Draft Created event', () => {
    const request = createRequest({ name: 'My request' }, makeCtx()());
    expect(getRequestStatus(request)).toBe('draft');
    expect(getLifecycle(request)).toBe('drafts');
    expect(types(request)).toEqual(['draftCreated']);
    expect(request.isSynthetic).toBe(true);
  });

  it('generates the three template items and logs each addition', () => {
    const { request } = templateDraft();
    expect(request.items.map((item) => item.type)).toEqual(['finishedGoodsCreate', 'extend', 'finishedGoodsBom']);
    expect(types(request).filter((type) => type === 'itemAdded')).toHaveLength(3);
    expect(types(request)).toContain('intakeCompleted');
  });

  it('generates no items and says why for an unsupported path', () => {
    const ctx = makeCtx();
    let request = createRequest({ name: 'x' }, ctx());
    request = must(updateRequestDetails(request, { businessNeed: 'newProduct', materialScenario: 'someNewMaterials' }, ctx()));
    request = must(completeIntake(request, ctx()));
    const result = generateInitialItems(request, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/future phase/i);
    expect(request.items).toHaveLength(0);
  });

  it('keeps the shared business context on the parent and gives items no override', () => {
    const { request } = templateDraft();
    expect(request.context.businessJustification?.value).toBe('Launch test product.');
    for (const item of request.items) expect(JSON.stringify(item.data)).not.toContain('businessJustification');
  });

  it('still generates all three recommended items, each marked as recommended', () => {
    const { request } = templateDraft();
    expect(request.items.map((item) => item.type)).toEqual(['finishedGoodsCreate', 'extend', 'finishedGoodsBom']);
    expect(request.items.every((item) => item.recommended)).toBe(true);
  });

  it('prevents adding a duplicate item type', () => {
    const { request, ctx } = templateDraft();
    expect(addItem(request, 'extend', ctx()).ok).toBe(false);
  });

  it('derives system values without overwriting what the user typed', () => {
    const { request } = validDraft();
    const extend = itemOf<ExtendItem>(request, 'extend');
    expect(extend.data.rows[0].fields.externalMaterialId).toMatchObject({ value: '900001', provenance: 'derived' });
    expect(itemOf(request, 'finishedGoodsCreate').data).toMatchObject({ fields: { finishedGoodsBomSetupNeeded: { value: 'Y', provenance: 'derived' } } });

    const typed = must(
      updateItem(request, extend.id, { rows: [{ ...extend.data.rows[0], fields: { ...extend.data.rows[0].fields, externalMaterialId: fv('777') } }] }, makeCtx()()),
    );
    const changed = itemOf<ExtendItem>(typed, 'extend').data.rows[0].fields.externalMaterialId;
    expect(changed).toMatchObject({ value: '777', provenance: 'user' });
  });
});

describe('uploads', () => {
  it('adds and removes an upload on a draft, storing only metadata', () => {
    const { request, ctx } = templateDraft();
    const added = must(addUpload(request, { fileName: ' Reference Data_Test.xlsx ', kind: 'referenceDocument', populatedFields: [], sizeBytes: 2048 }, ctx()));
    expect(added.uploads).toHaveLength(1);
    expect(added.uploads[0]).toMatchObject({ fileName: 'Reference Data_Test.xlsx', kind: 'referenceDocument', sizeBytes: 2048, simulated: true, uploadedBy: REQUESTOR });
    const removed = must(removeUpload(added, added.uploads[0].id, ctx()));
    expect(removed.uploads).toEqual([]);
    expect(removeUpload(removed, 'nope', ctx()).ok).toBe(false);
    expect(addUpload(request, { fileName: ' ', kind: 'referenceDocument', populatedFields: [] }, ctx()).ok).toBe(false);
  });

  it('refuses upload changes after submission', () => {
    const { request, ctx } = submitted();
    expect(addUpload(request, { fileName: 'x.xlsx', kind: 'referenceDocument', populatedFields: [] }, ctx()).ok).toBe(false);
  });
});

describe('Request Item removal', () => {
  const removed = (type: 'finishedGoodsCreate' | 'extend' | 'finishedGoodsBom') => {
    const { request, ctx } = validDraft();
    const result = removeItem(request, itemOf(request, type).id, ctx());
    if (!result.ok) throw new Error(result.error);
    return { before: request, result, after: result.request, ctx };
  };

  it.each(['finishedGoodsCreate', 'extend', 'finishedGoodsBom'] as const)('allows %s to be removed from a draft', (type) => {
    const { after } = removed(type);
    expect(after.items.map((i) => i.type)).not.toContain(type);
    expect(after.items).toHaveLength(2);
  });

  it('reports that a removed recommended item leaves the request without it', () => {
    const { result } = removed('finishedGoodsCreate');
    expect(result.ok && result.removal).toMatchObject({
      type: 'finishedGoodsCreate',
      wasRecommended: true,
      missingRecommended: ['finishedGoodsCreate'],
      dependentItems: ['extend', 'finishedGoodsBom'],
    });
    const bom = removed('finishedGoodsBom').result;
    expect(bom.ok && bom.removal).toMatchObject({ type: 'finishedGoodsBom', missingRecommended: ['finishedGoodsBom'], dependentItems: [] });
  });

  it('recalculates validation and completeness after removal', () => {
    const { before, after, result } = removed('finishedGoodsCreate');
    expect(before.validation.blockingCount).toBe(0);
    expect(before.items.map((i) => i.completeness)).toEqual(['complete', 'complete', 'complete']);
    // Extend and Product Bill of Materials lose their derived values and the Product Bill of Materials setup answer.
    expect(after.validation.blockingCount).toBeGreaterThan(0);
    expect(after.validation.submittable).toBe(false);
    expect(after.validation.evaluatedAt).not.toBe(before.validation.evaluatedAt);
    const extend = itemOf<ExtendItem>(after, 'extend');
    expect(extend.completeness).not.toBe('complete');
    expect(extend.data.rows[0].fields.externalMaterialId).toBeUndefined();
    expect(itemOf(after, 'finishedGoodsBom').data).toMatchObject({ header: expect.not.objectContaining({ p40Fert: expect.anything() }) });
    expect(result.ok && result.removal?.blockingCount).toBe(after.validation.blockingCount);
  });

  it('updates the Product Bill of Materials setup expectation when Product Bill of Materials is removed', () => {
    const { after } = removed('finishedGoodsBom');
    expect(after.validation.issues.filter((i) => i.ruleId.startsWith('finishedGoodsBom.'))).toEqual([]);
    // The derived "BOM setup needed = Y" is cleared, so Finished Product Create now asks the user to answer it.
    expect(itemOf(after, 'finishedGoodsCreate').completeness).toBe('inProgress');
    expect(after.validation.issues.map((i) => i.ruleId)).toContain('finishedGoodsCreate.finishedGoodsBomSetupNeeded.required');
    expect(after.validation.issues.map((i) => i.ruleId)).not.toContain('finishedGoodsCreate.bomSetup.consistency');
  });

  it('records an append-only Request Item Removed event', () => {
    const { before, after } = removed('extend');
    expect(after.history.slice(0, before.history.length)).toEqual(before.history);
    const event = after.history.at(-1)!;
    expect(event).toMatchObject({ type: 'itemRemoved', itemId: itemOf(before, 'extend').id, metadata: { itemType: 'extend', recommended: true } });
    expect(describeEvent(event)).toBe('Finished Product Extend removed');
  });

  it('does not regenerate or substitute a removed item', () => {
    const { after, ctx } = removed('finishedGoodsBom');
    expect(after.items.map((i) => i.type)).toEqual(['finishedGoodsCreate', 'extend']);
    // Later edits and re-evaluation don't bring it back.
    const create = itemOf(after, 'finishedGoodsCreate');
    const edited = must(updateItem(after, create.id, create.data, ctx()));
    expect(edited.items.map((i) => i.type)).toEqual(['finishedGoodsCreate', 'extend']);
    // Generating the template again is refused rather than re-adding anything.
    expect(generateInitialItems(edited, ctx()).ok).toBe(false);
    // Removing everything leaves an empty request, with no replacement items.
    const empty = ['finishedGoodsCreate', 'extend'].reduce(
      (current, type) => must(removeItem(current, itemOf(current, type as 'extend').id, ctx())),
      edited,
    );
    expect(empty.items).toEqual([]);
  });

  it('only adds a removed item back when explicitly asked, keeping its recommended marker', () => {
    const { after, ctx } = removed('finishedGoodsBom');
    const readded = must(addItem(after, 'finishedGoodsBom', ctx()));
    expect(itemOf(readded, 'finishedGoodsBom')).toMatchObject({ recommended: true, completeness: 'notStarted' });
  });

  it('re-links Extend to a re-added Finished Product Create without substituting anything', () => {
    const { after, ctx } = removed('finishedGoodsCreate');
    const readded = must(addItem(after, 'finishedGoodsCreate', ctx()));
    const newId = itemOf(readded, 'finishedGoodsCreate').id;
    expect(itemOf<ExtendItem>(readded, 'extend').data.rows[0].material).toEqual({ kind: 'requestItem', itemId: newId });
  });

  it('refuses removal after submission with a clear error', () => {
    const { request, ctx } = submitted();
    for (const item of request.items) {
      const result = removeItem(request, item.id, ctx());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('Request Items can’t be removed after a request has been submitted.');
    }
    expect(request.items).toHaveLength(3);
  });

  it('refuses removal of an item that doesn’t exist', () => {
    const { request, ctx } = validDraft();
    expect(removeItem(request, 'nope', ctx()).ok).toBe(false);
  });
});

describe('Request Item add and removal previews', () => {
  it('previews a removal without changing the request', () => {
    const { request, ctx } = templateDraft();
    deepFreeze(request);
    const preview = previewRemoval(request, itemOf(request, 'finishedGoodsCreate').id, ctx());
    const actual = removeItem(request, itemOf(request, 'finishedGoodsCreate').id, ctx());
    expect(preview).toEqual(actual.ok && actual.removal);
    expect(request.items).toHaveLength(3);
    expect(previewRemoval(request, 'nope', ctx())).toBeNull();
  });

  it('explains why an item type can’t be added, matching addItem', () => {
    const { request, ctx } = templateDraft();
    expect(addItemBlocker(request, 'finishedGoodsBom')).toBe('Product Bill of Materials is already part of this request.');
    const withoutCreate = must(removeItem(must(removeItem(request, itemOf(request, 'extend').id, ctx())), itemOf(request, 'finishedGoodsCreate').id, ctx()));
    expect(addItemBlocker(withoutCreate, 'extend')).toBe('Add Finished Product Create before Extend.');
    expect(addItemBlocker(withoutCreate, 'finishedGoodsCreate')).toBeNull();
    const refused = addItem(withoutCreate, 'extend', ctx());
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe(addItemBlocker(withoutCreate, 'extend'));
    expect(addItemBlocker(submitted().request, 'finishedGoodsCreate')).toBe('Request Items can only be added to a draft.');
  });
});

describe('submission', () => {
  it('blocks submission while a blocking error exists, and logs Validation Failed', () => {
    const { request, ctx } = templateDraft();
    const result = submitRequest(request, ctx());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues?.length).toBeGreaterThan(0);
    expect(result.issues?.every((issue) => issue.blocking)).toBe(true);
    expect(result.request && types(result.request)).toContain('validationFailed');
    expect(getRequestStatus(request)).toBe('draft');
  });

  it('submits a valid draft: Ready for Execution, in Requests, with history', () => {
    const { request } = submitted();
    expect(getRequestStatus(request)).toBe('readyForExecution');
    expect(getLifecycle(request)).toBe('requests');
    expect(request.items.every((item) => item.execution === 'ready')).toBe(true);
    expect(request.submissions).toHaveLength(1);
    expect(request.submittedBy).toEqual(REQUESTOR);
    expect(types(request).slice(-3)).toEqual(['validationPassed', 'requestSubmitted', 'readyForExecution']);
  });

  it('shows Validating while the review runs, and groups it with Drafts', () => {
    const { request } = validDraft();
    const validating = { ...request, isValidating: true };
    expect(getRequestStatus(validating)).toBe('validating');
    expect(getLifecycle(validating)).toBe('drafts');
  });

  it('refuses to submit twice and freezes non-returned items', () => {
    const { request, ctx } = submitted();
    expect(submitRequest(request, ctx()).ok).toBe(false);
    expect(updateItem(request, request.items[0].id, request.items[0].data, ctx()).ok).toBe(false);
  });
});

describe('lifecycle grouping', () => {
  it('puts unsubmitted work in Drafts, submitted unfinished work in Requests, and finished work in Completed', () => {
    const draft = validDraft().request;
    const ready = submitted().request;
    const { request: inFlight, ctx } = submitted();
    const started = must(startExecution(inFlight, ctx(EXECUTOR)));
    const done = ['finishedGoodsCreate', 'extend', 'finishedGoodsBom'].reduce(
      (current, type) => must(completeItem(current, itemOf(current, type as 'finishedGoodsCreate').id, ctx(EXECUTOR), { executionIdentifier: `ID-${type}` })),
      started,
    );
    const groups = groupByLifecycle([draft, ready, started, done]);
    expect(groups.drafts).toEqual([draft]);
    expect(groups.requests).toHaveLength(2);
    expect(groups.completed).toEqual([done]);
  });

  it('sorts each group by most recently updated', () => {
    const older = { ...validDraft().request, id: 'a', updatedAt: '2026-10-01T00:00:00.000Z' };
    const newer = { ...validDraft().request, id: 'b', updatedAt: '2026-10-02T00:00:00.000Z' };
    expect(groupByLifecycle([older, newer]).drafts.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('execution and item completion', () => {
  it('starts execution on ready items and moves the request to In Progress', () => {
    const { request, ctx } = submitted();
    const started = must(startExecution(request, ctx(EXECUTOR), [itemOf(request, 'extend').id]));
    expect(itemOf(started, 'extend').execution).toBe('inProgress');
    expect(itemOf(started, 'finishedGoodsCreate').execution).toBe('ready');
    expect(getRequestStatus(started)).toBe('inProgress');
    expect(types(started).at(-1)).toBe('executionStarted');
  });

  it('requires the Execution Identifier to complete an item', () => {
    const { request, ctx } = submitted();
    const id = itemOf(request, 'finishedGoodsCreate').id;
    for (const blank of [undefined, '', '   ']) {
      const result = completeItem(request, id, ctx(EXECUTOR), { executionIdentifier: blank });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Execution Identifier/);
    }
    expect(recordSystemIdentifier(request, id, '  ', ctx(EXECUTOR)).ok).toBe(false);
  });

  it('completes using an identifier recorded earlier', () => {
    const { request, ctx } = submitted();
    const id = itemOf(request, 'finishedGoodsCreate').id;
    const recorded = must(recordSystemIdentifier(request, id, '4000099', ctx(EXECUTOR)));
    expect(itemOf(recorded, 'finishedGoodsCreate').execution).toBe('ready');
    const done = must(completeItem(recorded, id, ctx(EXECUTOR)));
    expect(itemOf(done, 'finishedGoodsCreate').executionIdentifier).toBe('4000099');
  });

  it('captures completion metadata automatically from the acting user and the clock', () => {
    const { request, ctx } = submitted();
    const at = ctx(EXECUTOR);
    const done = must(completeItem(request, itemOf(request, 'finishedGoodsCreate').id, at, { executionIdentifier: ' 4000123 ' }));
    const item = itemOf(done, 'finishedGoodsCreate');
    expect(item.execution).toBe('completed');
    expect(item.executionIdentifier).toBe('4000123');
    expect(item.completion).toEqual({ completedBy: EXECUTOR, completedAt: at.now });
    expect(types(done).slice(-2)).toEqual(['executionIdentifierRecorded', 'itemCompleted']);
    expect(done.history.at(-1)).toMatchObject({ itemId: item.id, actor: EXECUTOR, at: at.now });
  });

  it('keeps the parent in Requests while any required item is incomplete', () => {
    const { request, ctx } = submitted();
    const partial = must(completeItem(request, itemOf(request, 'finishedGoodsCreate').id, ctx(EXECUTOR), { executionIdentifier: 'A1' }));
    expect(getRequestStatus(partial)).toBe('inProgress');
    expect(getLifecycle(partial)).toBe('requests');
    expect(partial.completedAt).toBeUndefined();
    expect(itemProgress(partial)).toEqual({ completed: 1, total: 3 });
    expect(types(partial)).not.toContain('requestCompleted');
  });

  it('moves the parent to Completed automatically when every required item completes', () => {
    const { request, ctx } = submitted();
    let current = request;
    for (const type of ['finishedGoodsCreate', 'extend', 'finishedGoodsBom'] as const) {
      current = must(completeItem(current, itemOf(current, type).id, ctx(EXECUTOR), { executionIdentifier: `ID-${type}` }));
    }
    const at = current.history.at(-1)!.at;
    expect(getRequestStatus(current)).toBe('completed');
    expect(getLifecycle(current)).toBe('completed');
    expect(current.completedAt).toBe(at);
    expect(types(current).at(-1)).toBe('requestCompleted');
    expect(itemProgress(current)).toEqual({ completed: 3, total: 3 });
  });

  it('ignores optional items when deciding the parent is complete', () => {
    const { request, ctx } = submitted();
    const optional = { ...request, items: request.items.map((i) => (i.type === 'finishedGoodsBom' ? { ...i, required: false } : i)) };
    let current = optional;
    for (const type of ['finishedGoodsCreate', 'extend'] as const) {
      current = must(completeItem(current, itemOf(current, type).id, ctx(EXECUTOR), { executionIdentifier: type }));
    }
    expect(getRequestStatus(current)).toBe('completed');
  });

  it('cannot complete an item twice', () => {
    const { request, ctx } = submitted();
    const id = itemOf(request, 'finishedGoodsCreate').id;
    const done = must(completeItem(request, id, ctx(EXECUTOR), { executionIdentifier: 'A1' }));
    expect(completeItem(done, id, ctx(EXECUTOR), { executionIdentifier: 'A2' }).ok).toBe(false);
  });
});

describe('Action Required', () => {
  const input = (request: BomRequest, overrides = {}) => ({
    scope: 'item' as const,
    itemId: itemOf(request, 'extend').id,
    category: 'plantOrExtension' as const,
    section: 'Plants',
    fieldId: 'producingPlants',
    requiredAction: 'Confirm the producing plant.',
    ...overrides,
  });

  it('creates a structured item-level return and makes the request Action Required', () => {
    const { request, ctx } = submitted();
    const returned = must(addReturn(request, input(request, { explanation: 'Plant FAC-06 can’t produce this.' }), ctx(EXECUTOR)));
    expect(getRequestStatus(returned)).toBe('actionRequired');
    expect(itemOf(returned, 'extend').execution).toBe('returned');
    expect(itemOf(returned, 'finishedGoodsCreate').execution).toBe('ready');
    expect(returned.returns).toHaveLength(1);
    expect(returned.returns[0]).toMatchObject({
      scope: 'item',
      category: 'plantOrExtension',
      section: 'Plants',
      fieldId: 'producingPlants',
      requiredAction: 'Confirm the producing plant.',
      explanation: 'Plant FAC-06 can’t produce this.',
      createdBy: EXECUTOR,
      resolution: { state: 'open' },
    });
    expect(types(returned).at(-1)).toBe('actionRequired');
  });

  it('supports a parent-level return that applies to every open item', () => {
    const { request, ctx } = submitted();
    const partial = must(completeItem(request, itemOf(request, 'finishedGoodsCreate').id, ctx(EXECUTOR), { executionIdentifier: 'A1' }));
    const returned = must(addReturn(partial, { scope: 'request', category: 'approvalNeeded', requiredAction: 'Attach approval.' }, ctx(EXECUTOR)));
    expect(returned.returns[0].scope).toBe('request');
    expect(returned.returns[0].itemId).toBeUndefined();
    expect(returned.items.map((i) => i.execution)).toEqual(['completed', 'returned', 'returned']);
  });

  it('requires a valid category, a required action, and an open target item', () => {
    const { request, ctx } = submitted();
    expect(addReturn(request, input(request, { requiredAction: '  ' }), ctx(EXECUTOR)).ok).toBe(false);
    expect(addReturn(request, input(request, { category: 'nonsense' }), ctx(EXECUTOR)).ok).toBe(false);
    expect(addReturn(request, input(request, { itemId: 'missing' }), ctx(EXECUTOR)).ok).toBe(false);
    const done = must(completeItem(request, itemOf(request, 'extend').id, ctx(EXECUTOR), { executionIdentifier: 'A1' }));
    expect(addReturn(done, input(done), ctx(EXECUTOR)).ok).toBe(false);
  });

  it('blocks completing a returned item', () => {
    const { request, ctx } = submitted();
    const returned = must(addReturn(request, input(request), ctx(EXECUTOR)));
    expect(completeItem(returned, itemOf(returned, 'extend').id, ctx(EXECUTOR), { executionIdentifier: 'A1' }).ok).toBe(false);
  });

  it('resolves a return and records who and when, without a permanent status', () => {
    const { request, ctx } = submitted();
    const returned = must(addReturn(request, input(request), ctx(EXECUTOR)));
    const at = ctx();
    const resolved = must(resolveReturn(returned, returned.returns[0].id, at));
    expect(resolved.returns[0].resolution).toEqual({ state: 'resolved', resolvedAt: at.now, resolvedBy: REQUESTOR });
    expect(types(resolved).at(-1)).toBe('correctionMade');
    expect(resolveReturn(resolved, returned.returns[0].id, ctx()).ok).toBe(false);
  });

  it('allows a returned item to be corrected and resubmitted, recorded as history not status', () => {
    const { request, ctx } = submitted();
    const returned = must(addReturn(request, input(request), ctx(EXECUTOR)));
    const extend = itemOf<ExtendItem>(returned, 'extend');
    const corrected = must(
      updateItem(returned, extend.id, { rows: extend.data.rows.map((row) => ({ ...row, fields: { ...row.fields, producingPlants: fv(['FAC-02']) } })) }, ctx()),
    );
    const resubmitted = must(resubmitRequest(corrected, ctx()));

    expect(getRequestStatus(resubmitted)).toBe('readyForExecution');
    expect(itemOf(resubmitted, 'extend').execution).toBe('ready');
    expect(resubmitted.submissions.map((s) => [s.version, s.kind])).toEqual([[1, 'initial'], [2, 'resubmission']]);
    expect(resubmitted.returns[0].resolution).toMatchObject({ state: 'resolved', resubmissionVersion: 2 });
    expect(types(resubmitted)).toContain('requestResubmitted');
    expect(describeEvent(resubmitted.history.find((e) => e.type === 'requestResubmitted')!)).toBe('Request resubmitted (submission 2)');
    // No status value represents "resubmitted".
    expect(['draft', 'validating', 'readyForExecution', 'inProgress', 'actionRequired', 'completed']).toContain(getRequestStatus(resubmitted));
  });

  it('refuses to resubmit while a blocking issue remains', () => {
    const { request, ctx } = submitted();
    const returned = must(addReturn(request, input(request), ctx(EXECUTOR)));
    const extend = itemOf<ExtendItem>(returned, 'extend');
    const broken = must(
      updateItem(returned, extend.id, { rows: extend.data.rows.map((row) => ({ ...row, fields: { ...row.fields, producingPlants: fv(['0000']) } })) }, ctx()),
    );
    const result = resubmitRequest(broken, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.request && types(result.request)).toContain('validationFailed');
    expect(getRequestStatus(broken)).toBe('actionRequired');
  });

  it('refuses to resubmit when nothing was returned', () => {
    const { request, ctx } = submitted();
    expect(resubmitRequest(request, ctx()).ok).toBe(false);
  });
});

describe('append-only history', () => {
  it('never edits or removes earlier events as the request moves through its life', () => {
    const { request, ctx } = validDraft();
    const frozen = deepFreeze(request);
    const snapshots: BomRequest[] = [frozen];
    let current: BomRequest = frozen;
    const steps: ((r: BomRequest) => BomRequest)[] = [
      (r) => must(submitRequest(r, ctx())),
      (r) => must(startExecution(r, ctx(EXECUTOR))),
      (r) => must(addReturn(r, { scope: 'item', itemId: itemOf(r, 'extend').id, category: 'other', requiredAction: 'Fix.' }, ctx(EXECUTOR))),
      (r) => must(resubmitRequest(r, ctx())),
      (r) => must(completeItem(r, itemOf(r, 'finishedGoodsCreate').id, ctx(EXECUTOR), { executionIdentifier: 'A1' })),
    ];
    for (const step of steps) {
      current = deepFreeze(step(current));
      snapshots.push(current);
    }
    for (let i = 1; i < snapshots.length; i++) {
      const before = snapshots[i - 1].history;
      const after = snapshots[i].history;
      expect(after.length).toBeGreaterThan(before.length);
      expect(after.slice(0, before.length)).toEqual(before);
    }
    expect(new Set(current.history.map((e) => e.id)).size).toBe(current.history.length);
  });

  it('records the actor and a timestamp on every event', () => {
    const { request } = submitted();
    for (const event of request.history) {
      expect(event.actor.id).toBeTruthy();
      expect(Date.parse(event.at)).not.toBeNaN();
    }
  });
});
