import { buildSeedRequests } from '../data/seed';
import { getLifecycle, getRequestStatus } from '../domain/status';
import { SCHEMA_VERSION, STORAGE_KEY, useAppStore } from './appStore';
import { selectRequest, selectRequestsByLifecycle, selectStatusCounts } from './selectors';

const state = () => useAppStore.getState();
const readyId = 'BR-2026-0148';

describe('request records in the store', () => {
  it('starts with the seeded demo requests across all lifecycles', () => {
    expect(Object.keys(state().requests)).toHaveLength(Object.keys(buildSeedRequests()).length);
    expect(selectRequestsByLifecycle(state(), 'drafts').length).toBeGreaterThanOrEqual(2);
    expect(selectRequestsByLifecycle(state(), 'requests').length).toBeGreaterThanOrEqual(3);
    expect(selectRequestsByLifecycle(state(), 'completed').length).toBeGreaterThanOrEqual(2);
    expect(selectStatusCounts(state()).actionRequired).toBeGreaterThan(0);
    expect(selectRequest(state(), readyId)?.id).toBe(readyId);
    expect(selectRequest(state(), 'nope')).toBeUndefined();
  });

  it('creates a draft request as the current persona and logs it', () => {
    const id = state().createRequest('Brand new product');
    const request = state().requests[id];
    expect(request.name).toBe('Brand new product');
    expect(request.requestor.name).toBe('Demo Requestor');
    expect(getLifecycle(request)).toBe('drafts');
    expect(request.history.map((e) => e.type)).toEqual(['draftCreated']);
  });

  it('walks the Intake and template actions', () => {
    const id = state().createRequest('Flow test');
    expect(state().completeIntake(id).ok).toBe(false);
    state().updateRequestDetails(id, { businessNeed: 'newProduct', materialScenario: 'noNewMaterials' });
    expect(state().completeIntake(id).ok).toBe(true);
    expect(state().generateInitialItems(id).ok).toBe(true);
    expect(state().requests[id].items.map((i) => i.type)).toEqual(['finishedGoodsCreate', 'extend', 'finishedGoodsBom']);
    const removal = state().removeItem(id, state().requests[id].items[0].id);
    expect(removal.ok && removal.removal?.missingRecommended).toEqual(['finishedGoodsCreate']);
    expect(state().requests[id].items.map((i) => i.type)).toEqual(['extend', 'finishedGoodsBom']);
    expect(state().removeItem(readyId, state().requests[readyId].items[0].id).ok).toBe(false);
    expect(state().saveDraft(id).ok).toBe(true);
  });

  it('keeps the updated record when a submission fails validation', () => {
    const id = state().createRequest('Incomplete');
    state().updateRequestDetails(id, { businessNeed: 'newProduct', materialScenario: 'noNewMaterials' });
    state().generateInitialItems(id);
    const result = state().submitRequest(id);
    expect(result.ok).toBe(false);
    expect(state().requests[id].history.map((e) => e.type)).toContain('validationFailed');
    expect(getRequestStatus(state().requests[id])).toBe('draft');
  });

  it('returns a typed failure for an unknown request', () => {
    expect(state().submitRequest('missing')).toEqual({ ok: false, error: 'That request doesn’t exist.' });
  });

  it('runs execution, return, resubmission and completion as the Execution Specialist and Requestor', () => {
    state().setRole('executionSpecialist');
    expect(state().startExecution(readyId).ok).toBe(true);
    const extendId = state().requests[readyId].items.find((i) => i.type === 'extend')!.id;
    expect(
      state().addActionRequired(readyId, { scope: 'item', itemId: extendId, category: 'conflictingData', requiredAction: 'Reconcile the plants.' }).ok,
    ).toBe(true);
    expect(getRequestStatus(state().requests[readyId])).toBe('actionRequired');

    state().setRole('requestor');
    expect(state().recordCorrection(readyId, extendId).ok).toBe(true);
    expect(state().resubmitRequest(readyId).ok).toBe(true);

    state().setRole('executionSpecialist');
    for (const item of state().requests[readyId].items) {
      expect(state().completeItem(readyId, item.id).ok).toBe(false);
      expect(state().recordSystemIdentifier(readyId, item.id, `ID-${item.type}`).ok).toBe(true);
      expect(state().completeItem(readyId, item.id).ok).toBe(true);
    }
    const done = state().requests[readyId];
    expect(getRequestStatus(done)).toBe('completed');
    expect(done.items.every((i) => i.completion?.completedBy.name === 'Demo Executor')).toBe(true);
    expect(done.returns.every((r) => r.resolution.state === 'resolved')).toBe(true);
  });

  it('appends generic history events', () => {
    const before = state().requests[readyId].history.length;
    expect(state().appendHistoryEvent(readyId, 'draftSaved').ok).toBe(true);
    expect(state().requests[readyId].history).toHaveLength(before + 1);
  });

  it('resets demo data to the seed, discarding changes and new requests', () => {
    const created = state().createRequest('Temporary');
    state().setRole('executionSpecialist');
    state().startExecution(readyId);
    state().resetDemoData();
    expect(state().requests[created]).toBeUndefined();
    expect(state().role).toBe('requestor');
    expect(state().requests).toEqual(buildSeedRequests());
  });
});

describe('persistence and schema handling', () => {
  it('persists request records under the current schema version', () => {
    const id = state().createRequest('Persisted');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.version).toBe(SCHEMA_VERSION);
    expect(saved.state.requests[id].name).toBe('Persisted');
    expect(saved.state).not.toHaveProperty('roleSwitchPending');
  });

  it('rehydrates saved requests', async () => {
    const id = state().createRequest('Survives reload');
    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    useAppStore.setState({ requests: {} }); // also overwrites storage, so put the saved copy back
    localStorage.setItem(STORAGE_KEY, saved);
    await useAppStore.persist.rehydrate();
    expect(state().requests[id]?.name).toBe('Survives reload');
  });

  it('re-seeds when the saved schema version is older', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { role: 'executionSpecialist', requests: { stale: { id: 'stale' } } }, version: SCHEMA_VERSION - 1 }),
    );
    await useAppStore.persist.rehydrate();
    expect(state().requests.stale).toBeUndefined();
    expect(state().role).toBe('requestor');
    expect(Object.keys(state().requests)).toEqual(Object.keys(buildSeedRequests()));
  });

  it('falls back to the seed when saved requests are malformed', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { role: 'requestor', requests: 'oops' }, version: SCHEMA_VERSION }));
    await useAppStore.persist.rehydrate();
    expect(Object.keys(state().requests)).toEqual(Object.keys(buildSeedRequests()));
  });
});
