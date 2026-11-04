import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from '../components/common/LoadingState';
import { AppShell } from '../components/shell/AppShell';
import { IntakePage } from '../features/intake/IntakePage';
import { NewRequestPage } from '../features/intake/NewRequestPage';
import { RequestSetupPage } from '../features/setup/RequestSetupPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { WorkPage } from '../features/work/WorkPage';
import { PlaceholderPage } from '../features/placeholders/PlaceholderPage';
import { ROLES } from '../domain/access';
import { useAppStore } from '../store/appStore';

// Development-only design-system check. The DEV guard lets the bundler drop it from production builds.
const StylePreviewPage = import.meta.env.DEV ? lazy(() => import('../features/dev/StylePreviewPage')) : null;

function RoleLanding() {
  const role = useAppStore((state) => state.role);
  return <Navigate to={ROLES[role].landingPath} replace />;
}

/** Screens outside the current review scope show a scope notice. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RoleLanding />} />
        <Route path="work" element={<RoleLanding />} />
        <Route path="work/:lifecycle" element={<WorkPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="requests/new" element={<NewRequestPage />} />
        <Route path="requests/:id/intake" element={<IntakePage />} />
        <Route path="requests/:id/setup/:itemId?" element={<RequestSetupPage />} />
        <Route path="requests/:id/review" element={<ReviewPage />} />
        <Route
          path="requests/:id"
          element={
            <PlaceholderPage
              title="BOM Request"
              description="In the full product, this shows the request summary, its Request Items, Execution Identifiers and history."
            />
          }
        />
        <Route
          path="requests/:id/items/:itemId"
          element={
            <PlaceholderPage title="Request Item" description="In the full product, this shows the execution-ready data for one Request Item." />
          }
        />
        <Route
          path="requests/:id/package"
          element={
            <PlaceholderPage
              title="Execution package"
              description="In the full product, this is the validated, execution-ready output for manual System entry."
            />
          }
        />
        {StylePreviewPage && (
          <Route
            path="dev/style-preview"
            element={
              <Suspense fallback={<LoadingState label="Loading style preview…" />}>
                <StylePreviewPage />
              </Suspense>
            }
          />
        )}
        <Route
          path="*"
          element={
            <PlaceholderPage title="Page not found" description="That address doesn’t match a page in BOM Pilot." notFound />
          }
        />
      </Route>
    </Routes>
  );
}
