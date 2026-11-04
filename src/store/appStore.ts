import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildSeedRequests } from '../data/seed';
import { DEFAULT_ROLE, isLifecycleId, isRoleId, type LifecycleId, type RoleId } from '../domain/access';
import type { DomainContext } from '../domain/history';
import {
  addItem as addItemOp,
  addUpload as addUploadOp,
  removeUpload as removeUploadOp,
  addReturn as addReturnOp,
  appendHistory as appendHistoryOp,
  completeIntake as completeIntakeOp,
  completeItem as completeItemOp,
  createRequest as createRequestOp,
  generateInitialItems as generateInitialItemsOp,
  recordCorrection as recordCorrectionOp,
  recordSystemIdentifier as recordSystemIdentifierOp,
  removeItem as removeItemOp,
  resolveReturn as resolveReturnOp,
  resubmitRequest as resubmitRequestOp,
  saveDraft as saveDraftOp,
  startExecution as startExecutionOp,
  submitRequest as submitRequestOp,
  updateItem as updateItemOp,
  updateRequestDetails as updateRequestDetailsOp,
  type OpResult,
  type RequestDetailsPatch,
  type ReturnInput,
} from '../domain/requests';
import type { BomRequest, HistoryEventType, HistoryMetadata, ItemType, RequestItem } from '../domain/types';
import { contextForRole } from './context';

/**
 * Bump when the persisted shape changes. A mismatch discards the saved state and re-seeds the demo data.
 * v2 added the BOM Request records (Stage 1).
 * v3 re-seeded the demo records with initiative-level Request Names.
 * v4 re-seeded Finished Product Create records with concept description attributes (generated Material Description).
 */
export const SCHEMA_VERSION = 4;
export const STORAGE_KEY = 'bom-pilot-store';

export interface UiPrefs {
  lastLifecycle: LifecycleId | null;
  dismissedHints: string[];
}

interface PersistedState {
  schemaVersion: number;
  role: RoleId;
  ui: UiPrefs;
  requests: Record<string, BomRequest>;
}

/** Session-only state; never persisted. */
interface TransientState {
  roleSwitchPending: boolean;
}

interface AppActions {
  /** Switching role also flags the switch so the route gate can redirect without an explanation. */
  setRole: (role: RoleId) => void;
  acknowledgeRoleSwitch: () => void;
  setLastLifecycle: (lifecycle: LifecycleId) => void;
  dismissHint: (hintId: string) => void;
  /** Re-seeds all demo data, including every request record. */
  resetDemoData: () => void;

  /*
   * Request actions. They run the pure domain operation as the current role and keep the result.
   * A failed submission still stores its updated record, so a Validation Failed event isn’t lost.
   */
  createRequest: (name?: string) => string;
  updateRequestDetails: (id: string, patch: RequestDetailsPatch) => OpResult;
  saveDraft: (id: string) => OpResult;
  completeIntake: (id: string) => OpResult;
  generateInitialItems: (id: string) => OpResult;
  addItem: (id: string, type: ItemType) => OpResult;
  removeItem: (id: string, itemId: string) => OpResult;
  updateItem: (id: string, itemId: string, data: RequestItem['data']) => OpResult;
  recordCorrection: (id: string, itemId?: string) => OpResult;
  addUpload: (id: string, input: { fileName: string; kind: 'referenceDocument' | 'supporting'; populatedFields?: string[]; sizeBytes?: number }) => OpResult;
  removeUpload: (id: string, uploadId: string) => OpResult;
  submitRequest: (id: string) => OpResult;
  startExecution: (id: string, itemIds?: string[]) => OpResult;
  addActionRequired: (id: string, input: ReturnInput) => OpResult;
  resolveActionRequired: (id: string, returnId: string) => OpResult;
  resubmitRequest: (id: string) => OpResult;
  recordSystemIdentifier: (id: string, itemId: string, executionIdentifier: string) => OpResult;
  completeItem: (id: string, itemId: string, executionIdentifier?: string) => OpResult;
  appendHistoryEvent: (
    id: string,
    type: HistoryEventType,
    extras?: { itemId?: string; metadata?: HistoryMetadata },
  ) => OpResult;
}

export type AppState = PersistedState & TransientState & AppActions;

export const createInitialState = (): PersistedState => ({
  schemaVersion: SCHEMA_VERSION,
  role: DEFAULT_ROLE,
  ui: { lastLifecycle: null, dismissedHints: [] },
  requests: buildSeedRequests(),
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Accepts only well-formed persisted values; anything else falls back to the defaults. */
function sanitize(persisted: unknown): PersistedState {
  const initial = createInitialState();
  if (!isPlainObject(persisted)) return initial;
  const { role, ui, requests } = persisted as Partial<Record<keyof PersistedState, unknown>>;
  const uiRecord = isPlainObject(ui) ? ui : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    role: isRoleId(role) ? role : initial.role,
    ui: {
      lastLifecycle: isLifecycleId(uiRecord.lastLifecycle) ? uiRecord.lastLifecycle : null,
      dismissedHints: Array.isArray(uiRecord.dismissedHints)
        ? uiRecord.dismissedHints.filter((hint): hint is string => typeof hint === 'string')
        : [],
    },
    requests: isPlainObject(requests) ? (requests as Record<string, BomRequest>) : initial.requests,
  };
}

const notFound = (): OpResult => ({ ok: false, error: 'That request doesn’t exist.' });

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /** Runs a domain operation on one request as the current role and stores the outcome. */
      const apply = (id: string, operation: (request: BomRequest, ctx: DomainContext) => OpResult): OpResult => {
        const { requests, role } = get();
        const request = requests[id];
        if (!request) return notFound();
        const result = operation(request, contextForRole(role));
        const next = result.ok ? result.request : result.request;
        if (next) set((state) => ({ requests: { ...state.requests, [id]: next } }));
        return result;
      };

      return {
        ...createInitialState(),
        roleSwitchPending: false,
        setRole: (role) => set((state) => (state.role === role ? state : { role, roleSwitchPending: true })),
        acknowledgeRoleSwitch: () => set({ roleSwitchPending: false }),
        setLastLifecycle: (lastLifecycle) => set((state) => ({ ui: { ...state.ui, lastLifecycle } })),
        dismissHint: (hintId) =>
          set((state) => ({
            ui: { ...state.ui, dismissedHints: [...new Set([...state.ui.dismissedHints, hintId])] },
          })),
        resetDemoData: () => set({ ...createInitialState(), roleSwitchPending: false }),

        createRequest: (name) => {
          let request = createRequestOp({ name }, contextForRole(get().role));
          while (get().requests[request.id]) request = createRequestOp({ name }, contextForRole(get().role));
          set((state) => ({ requests: { ...state.requests, [request.id]: request } }));
          return request.id;
        },
        updateRequestDetails: (id, patch) => apply(id, (r, ctx) => updateRequestDetailsOp(r, patch, ctx)),
        saveDraft: (id) => apply(id, saveDraftOp),
        completeIntake: (id) => apply(id, completeIntakeOp),
        generateInitialItems: (id) => apply(id, generateInitialItemsOp),
        addItem: (id, type) => apply(id, (r, ctx) => addItemOp(r, type, ctx)),
        removeItem: (id, itemId) => apply(id, (r, ctx) => removeItemOp(r, itemId, ctx)),
        updateItem: (id, itemId, data) => apply(id, (r, ctx) => updateItemOp(r, itemId, data, ctx)),
        addUpload: (id, input) => apply(id, (r, ctx) => addUploadOp(r, { populatedFields: [], ...input }, ctx)),
        removeUpload: (id, uploadId) => apply(id, (r, ctx) => removeUploadOp(r, uploadId, ctx)),
        recordCorrection: (id, itemId) => apply(id, (r, ctx) => recordCorrectionOp(r, ctx, itemId)),
        submitRequest: (id) => apply(id, submitRequestOp),
        startExecution: (id, itemIds) => apply(id, (r, ctx) => startExecutionOp(r, ctx, itemIds)),
        addActionRequired: (id, input) => apply(id, (r, ctx) => addReturnOp(r, input, ctx)),
        resolveActionRequired: (id, returnId) => apply(id, (r, ctx) => resolveReturnOp(r, returnId, ctx)),
        resubmitRequest: (id) => apply(id, resubmitRequestOp),
        recordSystemIdentifier: (id, itemId, value) => apply(id, (r, ctx) => recordSystemIdentifierOp(r, itemId, value, ctx)),
        completeItem: (id, itemId, executionIdentifier) =>
          apply(id, (r, ctx) => completeItemOp(r, itemId, ctx, { executionIdentifier })),
        appendHistoryEvent: (id, type, extras) =>
          apply(id, (r, ctx) => ({ ok: true, request: appendHistoryOp(r, type, ctx, extras) })),
      };
    },
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ schemaVersion, role, ui, requests }): PersistedState => ({ schemaVersion, role, ui, requests }),
      migrate: () => createInitialState(),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
);
