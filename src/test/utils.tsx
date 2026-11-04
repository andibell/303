import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/AppRoutes';

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="pathname">{pathname}</output>;
}

/** Renders the real route table at a path, inside the theme and a memory router. */
export function renderApp(path = '/') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </AppProviders>,
  );
}
