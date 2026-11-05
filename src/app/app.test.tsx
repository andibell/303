import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../store/appStore';
import { renderApp } from '../test/utils';

const pathname = () => screen.getByTestId('pathname').textContent;

async function switchRole(name: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /^(requestor|execution specialist)$/i }));
  await user.click(await screen.findByRole('menuitemradio', { name }));
}

describe('application shell', () => {
  it('renders the generic header and the Requestor landing page', () => {
    renderApp('/');

    expect(screen.getByText('BOM Pilot')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'BOM Work' })).toBeInTheDocument();
    expect(pathname()).toBe('/work/drafts');
  });

  it('keeps the global header to the product name and persona, with no disclaimer or navigation', () => {
    renderApp('/');
    const header = screen.getByRole('banner');
    expect(within(header).queryByText(/role switch is not authentication/i)).not.toBeInTheDocument();
    expect(within(header).queryByText(/poc demo/i)).not.toBeInTheDocument();
    expect(within(header).queryByRole('navigation')).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'BOM Work' })).not.toBeInTheDocument();
    expect(within(header).getByText('Demo Requestor')).toBeInTheDocument();
    expect(screen.getByText(/synthetic demo data only/i)).toBeInTheDocument();
  });

  it('presents the persona by business role, not as "viewing as"', () => {
    renderApp('/');
    expect(screen.getByRole('button', { name: 'Requestor' })).toBeInTheDocument();
    expect(screen.queryByText(/viewing as/i)).not.toBeInTheDocument();
  });

  describe('application navigation', () => {
    const appNav = () => screen.getByRole('navigation', { name: 'Application' });

    it('offers BOM Work and Reports below the header, marking the current area', () => {
      renderApp('/work/requests');
      const links = within(appNav()).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(['BOM Work', 'ReportsPlanned']);
      expect(within(appNav()).getByRole('link', { name: 'BOM Work' })).toHaveAttribute('aria-current', 'page');
      expect(within(appNav()).getByRole('link', { name: /Reports/ })).not.toHaveAttribute('aria-current');
    });

    it('keeps BOM Work current on every request screen', () => {
      renderApp('/requests/BR-2026-0148');
      expect(within(appNav()).getByRole('link', { name: 'BOM Work' })).toHaveAttribute('aria-current', 'page');
    });

    it('opens Reports as a future area with no reporting functionality', async () => {
      const user = userEvent.setup();
      renderApp('/work/drafts');
      await user.click(within(appNav()).getByRole('link', { name: /Reports/ }));
      expect(pathname()).toBe('/reports');
      expect(within(appNav()).getByRole('link', { name: /Reports/ })).toHaveAttribute('aria-current', 'page');
      const main = screen.getByRole('main');
      expect(within(main).getByRole('heading', { name: 'Reports are planned for a future phase' })).toBeInTheDocument();
      expect(within(main).queryByRole('table')).not.toBeInTheDocument();
      expect(within(main).queryByRole('img')).not.toBeInTheDocument();
      expect(within(main).queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows New Request to the Requestor only, at the far end of the navigation bar', async () => {
      renderApp('/work/drafts');
      expect(screen.getByRole('link', { name: 'New Request' })).toHaveAttribute('href', '/requests/new');
      await switchRole(/execution specialist/i);
      expect(screen.queryByRole('link', { name: 'New Request' })).not.toBeInTheDocument();
      expect(within(appNav()).getByRole('link', { name: 'BOM Work' })).toBeInTheDocument();
      expect(within(appNav()).getByRole('link', { name: /Reports/ })).toBeInTheDocument();
    });

    it('creates exactly one Draft when New Request is used', async () => {
      const user = userEvent.setup();
      renderApp('/work/drafts');
      const before = Object.keys(useAppStore.getState().requests).length;
      await user.click(screen.getByRole('link', { name: 'New Request' }));
      expect(pathname()).toMatch(/^\/requests\/BR-\d{4}-\d{4}\/intake$/);
      expect(Object.keys(useAppStore.getState().requests)).toHaveLength(before + 1);
    });
  });

  it('shows Drafts, Requests and Completed to a Requestor', () => {
    renderApp('/work/requests');
    const tabs = within(screen.getByRole('tablist', { name: /bom work lifecycle/i })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Drafts', 'Requests', 'Completed']);
  });
});

describe('role switching', () => {
  it('switches to the Execution Specialist view and removes Drafts and New Request', async () => {
    renderApp('/work/drafts');
    await switchRole(/execution specialist/i);

    expect(useAppStore.getState().role).toBe('executionSpecialist');
    expect(screen.getByRole('button', { name: 'Execution Specialist' })).toBeInTheDocument();
    expect(pathname()).toBe('/work/requests');

    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Requests', 'Completed']);
    expect(screen.queryByRole('tab', { name: 'Drafts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New Request' })).not.toBeInTheDocument();
  });

  it('stays on a page both roles can open, and switches back cleanly', async () => {
    renderApp('/work/completed');
    await switchRole(/execution specialist/i);
    expect(pathname()).toBe('/work/completed');

    await switchRole(/^requestor/i);
    expect(screen.getByRole('tab', { name: 'Drafts' })).toBeInTheDocument();
  });

  it('redirects silently when the new role cannot open the current page', async () => {
    renderApp('/requests/abc/intake');
    await switchRole(/execution specialist/i);

    expect(pathname()).toBe('/work/requests');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('starts as the Execution Specialist when that role was persisted', () => {
    useAppStore.setState({ role: 'executionSpecialist' });
    renderApp('/');
    expect(pathname()).toBe('/work/requests');
    expect(screen.queryByRole('tab', { name: 'Drafts' })).not.toBeInTheDocument();
  });
});

describe('route protection', () => {
  beforeEach(() => useAppStore.setState({ role: 'executionSpecialist' }));

  it('redirects an Execution Specialist away from Drafts and explains why', () => {
    renderApp('/work/drafts');
    expect(pathname()).toBe('/work/requests');
    expect(screen.getByRole('alert')).toHaveTextContent(/drafts aren’t part of the execution specialist view/i);
  });

  it.each(['/requests/new', '/requests/abc/intake', '/requests/abc/setup/item1', '/requests/abc/review'])(
    'redirects an Execution Specialist away from %s',
    (path) => {
      renderApp(path);
      expect(pathname()).toBe('/work/requests');
      expect(screen.getByRole('alert')).toHaveTextContent(/only available to requestors/i);
    },
  );

  it('lets an Execution Specialist open a request record and execution package', () => {
    renderApp('/requests/abc/package');
    expect(pathname()).toBe('/requests/abc/package');
    expect(screen.getByRole('heading', { level: 1, name: 'Execution package' })).toBeInTheDocument();
  });

  it('lets a Requestor start a new request, which opens Intake', () => {
    useAppStore.setState({ role: 'requestor' });
    renderApp('/requests/new');
    expect(pathname()).toMatch(/^\/requests\/BR-\d{4}-\d{4}\/intake$/);
    expect(screen.getByRole('heading', { level: 1, name: 'New BOM Request' })).toBeInTheDocument();
  });
});

describe('screens outside the current review scope', () => {
  const SCOPE = 'Detailed interaction is outside the current POC review scope.';

  it.each([
    ['/requests/BR-2026-0148', 'BOM Request'],
    ['/requests/BR-2026-0148/package', 'Execution package'],
    ['/requests/BR-2026-0148/items/item_1', 'Request Item'],
  ])('%s says so in restrained terms, without sounding broken', (path, title) => {
    renderApp(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent(SCOPE);
    expect(main).toHaveTextContent('In the full product');
    expect(main).not.toHaveTextContent(/isn’t built|not built|planned for stage|unfinished|broken/i);
    expect(within(main).getByRole('link', { name: 'Back to BOM Work' })).toBeInTheDocument();
  });

  it('sends a submitted request’s Review & Submit address to its record, on the same notice', () => {
    renderApp('/requests/BR-2026-0148/review');
    expect(pathname()).toBe('/requests/BR-2026-0148');
    expect(screen.getByRole('main')).toHaveTextContent(SCOPE);
  });

  it('opens a submitted request from the Requests list on the same notice', async () => {
    const user = userEvent.setup();
    renderApp('/work/requests');
    await user.click(screen.getByRole('link', { name: /^Open Product Launch Delta/ }));
    expect(screen.getByRole('main')).toHaveTextContent(SCOPE);
  });

  it('keeps an unknown address a plain "not found", not a scope notice', () => {
    renderApp('/no/such/page');
    expect(screen.getByRole('main')).toHaveTextContent('Page not found');
    expect(screen.getByRole('main')).not.toHaveTextContent(SCOPE);
  });

  it('uses the scope wording for the one Request Item whose detail is still outside the review', async () => {
    const user = userEvent.setup();
    renderApp('/requests/BR-2026-0151/setup');
    await user.click(within(screen.getByRole('navigation', { name: 'Request Items' })).getByRole('button', { name: /^Set Up Plant Availability/ }));
    expect(screen.getByRole('region', { name: 'Set Up Plant Availability' })).toHaveTextContent(SCOPE);
    await user.click(within(screen.getByRole('navigation', { name: 'Request Items' })).getByRole('button', { name: /^Build Product BOM/ }));
    expect(screen.getByRole('region', { name: 'Build Product BOM' })).not.toHaveTextContent(SCOPE);
    expect(screen.getByTestId('bom-editor')).toBeInTheDocument();
  });

  it('keeps the prototype and synthetic-data disclosure in the footer', () => {
    renderApp('/work/drafts');
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/synthetic demo data only · no connection to external systems/i);
  });
});
