import { REFERENCE_DATA } from '../data/reference';
import { personaActor } from '../data/personas';
import type { RoleId } from '../domain/access';
import type { DomainContext } from '../domain/history';

const randomSuffix = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

/** The real clock, identity and ids for a demo role. Tests and seeds pass their own deterministic context. */
export function contextForRole(role: RoleId, now: string = new Date().toISOString()): DomainContext {
  return {
    now,
    actor: personaActor(role),
    reference: REFERENCE_DATA,
    newId: (prefix) =>
      // Requests get a readable ID in the same shape as the demo records; everything else gets a short random id.
      prefix === 'req'
        ? `BR-${new Date(now).getFullYear()}-${2000 + Math.floor(Math.random() * 8000)}`
        : `${prefix}_${randomSuffix()}`,
  };
}
