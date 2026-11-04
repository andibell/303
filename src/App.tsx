import { HashRouter } from 'react-router-dom';
import { AppProviders } from './app/AppProviders';
import { AppRoutes } from './app/AppRoutes';

// Hash routing works on any static host without server rewrites.
export default function App() {
  return (
    <AppProviders>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProviders>
  );
}
