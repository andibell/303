/*
 * Prototype roles and route access.
 * This demo uses generic roles so the model can support different operating models.
 * This is a demo role switch, not authentication.
 */

export type RoleId = 'requestor' | 'executionSpecialist';
export const ROLE_IDS: readonly RoleId[] = ['requestor', 'executionSpecialist'];
export const DEFAULT_ROLE: RoleId = 'requestor';

export type LifecycleId = 'drafts' | 'requests' | 'completed';
export const LIFECYCLE_LABELS: Record<LifecycleId, string> = {
  drafts: 'Drafts',
  requests: 'Requests',
  completed: 'Completed',
};

export function isRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && (ROLE_IDS as readonly string[]).includes(value);
}

export function isLifecycleId(value: unknown): value is LifecycleId {
  return typeof value === 'string' && value in LIFECYCLE_LABELS;
}

export interface RoleConfig {
  id: RoleId;
  /** Short role name, used in explanations ('The Requestor view can’t…'). */
  label: string;
  /** The person's business role as shown in the role control. */
  displayLabel: string;
  description: string;
  lifecycles: readonly LifecycleId[];
  canCreateRequest: boolean;
  landingPath: string;
}

export const ROLES: Record<RoleId, RoleConfig> = {
  requestor: {
    id: 'requestor',
    label: 'Requestor',
    displayLabel: 'Requestor',
    description: 'Create, submit and track BOM Requests',
    lifecycles: ['drafts', 'requests', 'completed'],
    canCreateRequest: true,
    landingPath: '/work/drafts',
  },
  executionSpecialist: {
    id: 'executionSpecialist',
    label: 'Execution Specialist',
    displayLabel: 'Execution Specialist',
    description: 'Execute submitted requests (downstream execution team)',
    lifecycles: ['requests', 'completed'],
    canCreateRequest: false,
    landingPath: '/work/requests',
  },
};

/** Routes that author or edit a request. Only Requestors may open them. */
const REQUESTOR_ONLY_PATHS: readonly RegExp[] = [
  /^\/requests\/new$/,
  /^\/requests\/[^/]+\/(intake|setup|review|submitted)(\/.*)?$/,
];

export type AccessDecision = { allowed: true } | { allowed: false; reason: string };

export function checkAccess(role: RoleId, pathname: string): AccessDecision {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const config = ROLES[role];

  if (!config.canCreateRequest && REQUESTOR_ONLY_PATHS.some((pattern) => pattern.test(path))) {
    return {
      allowed: false,
      reason: `The ${config.label} view can’t create or edit BOM Requests. Those screens are only available to Requestors.`,
    };
  }

  const lifecycle = /^\/work\/([^/]+)$/.exec(path)?.[1];
  if (isLifecycleId(lifecycle) && !config.lifecycles.includes(lifecycle)) {
    return {
      allowed: false,
      reason: `${LIFECYCLE_LABELS[lifecycle]} aren’t part of the ${config.label} view. They are only available to Requestors.`,
    };
  }

  return { allowed: true };
}
