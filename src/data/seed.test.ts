import { REFERENCE_DATA } from './reference';
import { buildSeedRequests } from './seed';
import { describeEvent } from '../domain/history';
import { getLifecycle, getRequestStatus, groupByLifecycle } from '../domain/status';
import { validateRequest } from '../domain/validation/engine';

const seed = buildSeedRequests();
const all = Object.values(seed);
const byStatus = (status: string) => all.filter((r) => getRequestStatus(r) === status);

describe('seed data', () => {
  it('is deterministic', () => {
    expect(buildSeedRequests()).toEqual(buildSeedRequests());
  });

  it('meets the demo minimums: 2 drafts, 3 active requests, 2 completed', () => {
    const groups = groupByLifecycle(all);
    expect(groups.drafts.length).toBeGreaterThanOrEqual(2);
    expect(groups.requests.length).toBeGreaterThanOrEqual(3);
    expect(groups.completed.length).toBeGreaterThanOrEqual(2);
  });

  it('shows every state the demo needs', () => {
    for (const status of ['draft', 'readyForExecution', 'inProgress', 'actionRequired', 'completed']) {
      expect(byStatus(status).length, status).toBeGreaterThan(0);
    }
  });

  it('includes a partially completed parent request', () => {
    const partial = byStatus('inProgress')[0];
    const states = partial.items.map((item) => item.execution);
    expect(states).toContain('completed');
    expect(states.some((s) => s !== 'completed')).toBe(true);
    expect(getLifecycle(partial)).toBe('requests');
  });

  it('shows Request Items in different states', () => {
    const states = new Set(all.flatMap((r) => r.items.map((i) => i.execution)));
    for (const state of ['notSubmitted', 'ready', 'inProgress', 'returned', 'completed']) expect(states.has(state as never)).toBe(true);
    const completeness = new Set(all.flatMap((r) => r.items.map((i) => i.completeness)));
    expect(completeness.has('notStarted') || completeness.has('inProgress')).toBe(true);
    expect(completeness.has('hasIssues')).toBe(true);
    expect(completeness.has('complete')).toBe(true);
  });

  it('has structured return reasons, including an open one and a resolved one', () => {
    const returns = all.flatMap((r) => r.returns);
    expect(returns.some((r) => r.resolution.state === 'open')).toBe(true);
    expect(returns.some((r) => r.resolution.state === 'resolved')).toBe(true);
    for (const entry of returns) {
      expect(entry.category).toBeTruthy();
      expect(entry.requiredAction).toBeTruthy();
    }
  });

  it('records a resubmission as history, with no resubmitted status', () => {
    const resubmitted = all.filter((r) => r.history.some((e) => e.type === 'requestResubmitted'));
    expect(resubmitted.length).toBeGreaterThanOrEqual(2);
    expect(all.every((r) => getRequestStatus(r) !== ('resubmitted' as never))).toBe(true);
  });

  it('gives every completed item an Execution Identifier and automatic completion metadata', () => {
    for (const request of byStatus('completed')) {
      expect(request.completedAt).toBeTruthy();
      for (const item of request.items) {
        expect(item.executionIdentifier).toBeTruthy();
        expect(item.completion?.completedBy.role).toBe('executionSpecialist');
        expect(item.completion?.completedAt).toBeTruthy();
      }
    }
  });

  it('keeps every submitted request free of blocking issues', () => {
    for (const request of all.filter((r) => r.submittedAt)) {
      expect(validateRequest(request, REFERENCE_DATA, 'submission').filter((i) => i.blocking), request.id).toEqual([]);
    }
  });

  it('keeps a draft with blocking issues so validation can be demonstrated', () => {
    const issues = all.filter((r) => !r.submittedAt).flatMap((r) => r.validation.issues.filter((i) => i.blocking));
    expect(issues.length).toBeGreaterThan(0);
  });

  it('shows a visible but future-phase draft with no generated items', () => {
    const future = all.find((r) => r.materialScenario === 'allNewMaterials');
    expect(future?.items).toHaveLength(0);
    expect(getLifecycle(future!)).toBe('drafts');
  });

  it('has readable history in time order for every request', () => {
    for (const request of all) {
      const times = request.history.map((e) => e.at);
      expect([...times].sort()).toEqual(times);
      for (const event of request.history) expect(describeEvent(event)).not.toBe(event.type);
    }
  });

  it('is synthetic and uses no interview participant names', () => {
    const text = JSON.stringify(all);
    for (const name of ['Hultsman', 'Hyatt', 'Digby', 'Tatto', 'Pedersen', 'Simpson', 'Reasoner', 'Hurren', 'Boudreau', 'McMinn', 'Casstevens']) {
      expect(text).not.toContain(name);
    }
    expect(all.every((r) => r.isSynthetic)).toBe(true);
    expect(REFERENCE_DATA.notice).toMatch(/synthetic/i);
  });
});
