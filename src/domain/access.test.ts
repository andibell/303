import { checkAccess } from './access';

describe('checkAccess', () => {
  it('lets a Requestor open every lifecycle and authoring route', () => {
    for (const path of ['/work/drafts', '/work/requests', '/work/completed', '/requests/new', '/requests/r1/intake', '/requests/r1/setup/i2', '/requests/r1/review', '/requests/r1/submitted']) {
      expect(checkAccess('requestor', path)).toEqual({ allowed: true });
    }
  });

  it('blocks Drafts and authoring routes for an Execution Specialist', () => {
    for (const path of ['/work/drafts', '/requests/new', '/requests/r1/intake', '/requests/r1/setup', '/requests/r1/setup/i2', '/requests/r1/review/', '/requests/r1/submitted']) {
      expect(checkAccess('executionSpecialist', path).allowed).toBe(false);
    }
  });

  it('lets an Execution Specialist open Requests, Completed and record views', () => {
    for (const path of ['/work/requests', '/work/completed', '/requests/r1', '/requests/r1/items/i1', '/requests/r1/package']) {
      expect(checkAccess('executionSpecialist', path)).toEqual({ allowed: true });
    }
  });
});
