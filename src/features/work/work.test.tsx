import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../store/appStore';
import { renderApp } from '../../test/utils';
import { itemSummary, executionIdentifierSummary } from './summaries';
import { buildSeedRequests } from '../../data/seed';

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const rowText = (index: number) => rows()[index].textContent ?? '';

describe('BOM Work: Drafts', () => {
  it('lists the Requestor’s seeded drafts with the useful columns', () => {
    renderApp('/work/drafts');
    const table = screen.getByRole('table');
    for (const header of ['Request ID', 'Request name', 'Business need', 'Material scenario', 'Request Items', 'State', 'Last modified', 'Action']) {
      expect(within(table).getByRole('columnheader', { name: new RegExp(header) })).toBeInTheDocument();
    }
    expect(rows()).toHaveLength(2);
    expect(rowText(0)).toContain('BR-2026-0151');
    expect(rowText(0)).toContain('New Product / Innovation');
    expect(rowText(0)).toContain('No New Materials');
    expect(rowText(0)).toMatch(/\d of 3 items ready/);
    expect(screen.queryByText('BR-2026-0149')).not.toBeInTheDocument(); // another Requestor’s draft
  });

  it('shows what needs attention on a draft, and a Continue action for each', () => {
    renderApp('/work/drafts');
    expect(screen.getByText(/1 item needs attention/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Continue / })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Continue Product Launch Beta' })).toHaveAttribute(
      'href',
      '/requests/BR-2026-0151/setup',
    );
  });

  it('puts recently modified work first and can re-sort by Request ID', async () => {
    const user = userEvent.setup();
    renderApp('/work/drafts');
    expect(rowText(0)).toContain('BR-2026-0151');
    await user.click(screen.getByRole('button', { name: 'Request ID' }));
    expect(rowText(0)).toContain('BR-2026-0150');
    await user.click(screen.getByRole('button', { name: 'Request ID' }));
    expect(rowText(0)).toContain('BR-2026-0151');
  });

  it('searches by Request ID or name, with an empty result that can be cleared', async () => {
    const user = userEvent.setup();
    renderApp('/work/drafts');
    const search = screen.getByRole('searchbox', { name: /search by request id or name/i });
    await user.type(search, '0150');
    expect(rows()).toHaveLength(1);
    expect(rowText(0)).toContain('Product Configuration Gamma');
    await user.clear(search);
    await user.type(search, 'Product Launch Beta');
    expect(rows()).toHaveLength(1);
    expect(rowText(0)).toContain('BR-2026-0151');
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText(/no drafts match “zzz”/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(rows()).toHaveLength(2);
  });

  it('shows an empty state that points at the one global New Request action, without a competing button', () => {
    useAppStore.setState({ requests: {} });
    renderApp('/work/drafts');
    expect(screen.getByRole('heading', { name: 'No drafts yet' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /new request/i })).toHaveLength(1);
    expect(within(screen.getByRole('main')).queryByRole('link', { name: /new request/i })).not.toBeInTheDocument();
  });

  it('leads each row with the Request Name, shows the Request ID as secondary, and names the work in business terms', () => {
    renderApp('/work/drafts');
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers.slice(0, 2)).toEqual(['Request name', 'Request ID']);
    expect(rowText(0)).toContain('Create Finished Product · Set Up Plant Availability · Build Product BOM');
    expect(rowText(0)).not.toContain('finishedGoods');
  });
});

describe('BOM Work: Requests', () => {
  it('lists submitted requests with derived statuses', () => {
    renderApp('/work/requests');
    expect(rows().length).toBeGreaterThanOrEqual(3);
    const table = within(screen.getByRole('table'));
    expect(table.getAllByText('Ready for Execution').length).toBeGreaterThan(0);
    expect(table.getByText('In Progress')).toBeInTheDocument();
    expect(table.getByText('Action Required')).toBeInTheDocument();
    for (const header of ['Request ID', 'Business need', 'Requestor', 'Status', 'Progress', 'Submitted', 'Last activity']) {
      expect(table.getByRole('columnheader', { name: new RegExp(header) })).toBeInTheDocument();
    }
  });

  it('shows item progress and the latest activity in plain language', () => {
    renderApp('/work/requests');
    const inProgress = rows().find((row) => row.textContent?.includes('BR-2026-0146'))!;
    expect(inProgress.textContent).toContain('1 of 3 items complete');
    const returned = rows().find((row) => row.textContent?.includes('BR-2026-0145'))!;
    expect(returned.textContent).toContain('Returned for action on Finished Product Extend: Plant or extension issue');
    expect(within(returned).getByRole('link', { name: 'Open Product Launch Zeta' })).toHaveAttribute('href', '/requests/BR-2026-0145');
  });
});

describe('BOM Work: Completed', () => {
  it('lists completed requests with completion date, item summary and Execution Identifiers', () => {
    renderApp('/work/completed');
    expect(rows()).toHaveLength(2);
    const table = within(screen.getByRole('table'));
    for (const header of ['Request ID', 'Request name', 'Business need', 'Completed', 'Request Items', 'Execution Identifiers']) {
      expect(table.getByRole('columnheader', { name: new RegExp(header) })).toBeInTheDocument();
    }
    expect(rowText(0)).toContain('3 of 3 items complete');
    expect(rowText(0)).toMatch(/4000\d+ \+2 more/);
    expect(screen.queryByText('BOMs')).not.toBeInTheDocument();
  });
});

describe('BOM Work: Execution Specialist', () => {
  beforeEach(() => useAppStore.setState({ role: 'executionSpecialist' }));

  it('sees Requests and Completed with the same list pattern, and no Drafts or New Request', () => {
    renderApp('/work/requests');
    expect(screen.queryByRole('tab', { name: 'Drafts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new request/i })).not.toBeInTheDocument();
    expect(rows().length).toBeGreaterThanOrEqual(3);
    expect(within(screen.getByRole('table')).getByText('Action Required')).toBeInTheDocument();
  });

  it('can open Completed', () => {
    renderApp('/work/completed');
    expect(rows()).toHaveLength(2);
  });
});

describe('list summaries', () => {
  const seed = buildSeedRequests();
  it('summarizes items for drafts and submitted requests', () => {
    expect(itemSummary(seed['BR-2026-0149'])).toBe('No items yet');
    expect(itemSummary(seed['BR-2026-0146'])).toBe('1 of 3 items complete');
  });
  it('summarizes Execution Identifiers compactly', () => {
    expect(executionIdentifierSummary(seed['BR-2026-0140'])).toMatch(/^4000\d+ \+2 more$/);
    expect(executionIdentifierSummary(seed['BR-2026-0148'])).toBe('—');
  });
});
