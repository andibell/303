import type { RoleId } from '../domain/access';
import type { Actor } from '../domain/types';

/** Generic demonstration personas. */
export interface DemoPersona {
  roleId: RoleId;
  name: string;
  initials: string;
  title: string;
}

export const PERSONAS: Record<RoleId, DemoPersona> = {
  requestor: {
    roleId: 'requestor',
    name: 'Demo Requestor',
    initials: 'DR',
    title: 'Requestor',
  },
  executionSpecialist: {
    roleId: 'executionSpecialist',
    name: 'Demo Executor',
    initials: 'DE',
    title: 'Execution Specialist',
  },
};

/** The acting identity recorded in history for a demo role. */
export const personaActor = (roleId: RoleId): Actor => ({
  id: `persona-${roleId}`,
  name: PERSONAS[roleId].name,
  role: roleId,
});
