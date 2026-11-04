import { createInitialState, SCHEMA_VERSION, STORAGE_KEY, useAppStore } from './appStore';

describe('app store', () => {
  it('starts as the Requestor with default preferences', () => {
    const state = useAppStore.getState();
    expect(state.role).toBe('requestor');
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.ui).toEqual({ lastLifecycle: null, dismissedHints: [] });
  });

  it('persists the active role to local storage', () => {
    useAppStore.getState().setRole('executionSpecialist');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.state.role).toBe('executionSpecialist');
    expect(saved.version).toBe(SCHEMA_VERSION);
  });

  it('resets demo data to the initial state', () => {
    const { setRole, setLastLifecycle, resetDemoData } = useAppStore.getState();
    setRole('executionSpecialist');
    setLastLifecycle('completed');
    resetDemoData();
    expect(useAppStore.getState()).toMatchObject(createInitialState());
  });

  it('ignores malformed persisted values when rehydrating', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { role: 'admin', ui: { lastLifecycle: 'nope', dismissedHints: [1, 'a'] } }, version: SCHEMA_VERSION }),
    );
    await useAppStore.persist.rehydrate();
    const state = useAppStore.getState();
    expect(state.role).toBe('requestor');
    expect(state.ui).toEqual({ lastLifecycle: null, dismissedHints: ['a'] });
  });
});
