import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { checkAccess, ROLES } from '../domain/access';
import { useAppStore } from '../store/appStore';

/**
 * Route protection for the prototype roles. If the current role can’t open the page, redirect to the
 * role’s landing page. A direct attempt explains why; a redirect caused by switching roles is silent,
 * because the user just asked for the other view.
 */
export function RouteGate() {
  const role = useAppStore((state) => state.role);
  const roleSwitchPending = useAppStore((state) => state.roleSwitchPending);
  const acknowledgeRoleSwitch = useAppStore((state) => state.acknowledgeRoleSwitch);
  const { pathname } = useLocation();
  const decision = checkAccess(role, pathname);

  // Keep the flag until the user is on a page the new role can open, so a redirect that is still
  // in flight is never mistaken for a direct attempt.
  useEffect(() => {
    if (roleSwitchPending && decision.allowed) acknowledgeRoleSwitch();
  }, [roleSwitchPending, decision.allowed, acknowledgeRoleSwitch]);

  if (decision.allowed) return <Outlet />;
  return (
    <Navigate
      to={ROLES[role].landingPath}
      replace
      state={roleSwitchPending ? undefined : { notice: { severity: 'warning', message: decision.reason } }}
    />
  );
}
