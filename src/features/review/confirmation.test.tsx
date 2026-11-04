import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fv } from '../../domain/requests';
import { getLifecycle, getRequestStatus } from '../../domain/status';
import { STORAGE_KEY, useAppStore } from '../../store/appStore';
import { validDraft } from '../../test/fixtures';
import { renderApp } from '../../test/utils';
import { formatDateTime } from '../work/format';

const pathname = () => screen.getByTestId('pathname').textContent ?? '';
const req = (id: string) => useAppStore.getState().requests[id];

/** A valid draft submitted through the store, the same action Review & Submit runs. */
function submittedRequest() {
  const { request } = validDraft();
  act(() => useAppStore.setState((state) => ({ requests: { ...state.requests, [request.id]: request } })));
  const result = useAppStore.getState().submitRequest(request.id);
  if (!result.ok) throw new Error(result.error);
  return request.id;
}

function openConfirmation(id: string) {
  const user = userEvent.setup();
  renderApp(`/requests/${id}/submitted`);
  return user;
}

describe('Confirmation', () => {
  it('reflects the actual submitted request', () => {
    const id = submittedRequest();
    openConfirmation(id);
    const request = req(id);
    expect(screen.getByRole('heading', { level: 1, name: 'Request submitted' })).toBeInTheDocument();
    expect(screen.getByText('Your request has been submitted and is now available in BOM Work.')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('confirmation-request-id')).toHaveTextContent(id);
    const summary = screen.getByTestId('confirmation-summary');
    expect(summary).toHaveTextContent('Test product');
    expect(summary).toHaveTextContent('New Product / Innovation');
    expect(summary).toHaveTextContent('No New Materials');
    expect(summary).toHaveTextContent('3 Request Items');
    expect(summary).toHaveTextContent(formatDateTime(request.submittedAt));
    // The submitted state is text with an icon, not color alone.
    expect(within(summary).getByText('Submitted')).toBeInTheDocument();
    expect(summary).toHaveTextContent('Ready for Execution');
  });

  it('moves focus to the success heading', () => {
    openConfirmation(submittedRequest());
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Request submitted' }));
  });

  it('keeps the submitted request in the Requestor’s Requests list', () => {
    const id = submittedRequest();
    expect(getLifecycle(req(id))).toBe('requests');
    renderApp('/work/requests');
    expect(screen.getByRole('link', { name: 'Test product' })).toBeInTheDocument();
  });

  it('opens BOM Work Requests with the submitted request present and named', async () => {
    const id = submittedRequest();
    const user = openConfirmation(id);
    await user.click(screen.getByRole('link', { name: 'View in BOM Work' }));
    expect(pathname()).toBe('/work/requests');
    expect(screen.getByRole('link', { name: 'Test product' })).toBeInTheDocument();
    expect(await screen.findByText(`Test product (${id}) is listed in Requests. Status: Ready for Execution.`)).toBeInTheDocument();
  });

  it('starts another request as a fresh draft without touching the submitted one', async () => {
    const id = submittedRequest();
    const before = req(id);
    const user = openConfirmation(id);
    await user.click(screen.getByRole('link', { name: 'Start another request' }));
    expect(pathname()).toMatch(/^\/requests\/BR-\d{4}-\d{4}\/intake$/);
    const newId = pathname().split('/')[2];
    expect(newId).not.toBe(id);
    expect(getRequestStatus(req(newId))).toBe('draft');
    expect(req(id)).toBe(before);
  });

  it('offers Return to BOM Work as a text action', async () => {
    const user = openConfirmation(submittedRequest());
    await user.click(screen.getByRole('link', { name: 'Return to BOM Work' }));
    expect(pathname()).toBe('/work/drafts');
  });

  it('shows the same confirmation after a reload, from the persisted store', async () => {
    const id = submittedRequest();
    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    act(() => useAppStore.setState({ requests: {} }));
    localStorage.setItem(STORAGE_KEY, saved);
    await act(async () => useAppStore.persist.rehydrate());
    openConfirmation(id);
    expect(screen.getByRole('heading', { level: 1, name: 'Request submitted' })).toBeInTheDocument();
    expect(screen.getByTestId('confirmation-request-id')).toHaveTextContent(id);
  });
});

describe('Confirmation recovery', () => {
  it('explains an unknown request and offers a way back to BOM Work', async () => {
    const user = openConfirmation('BR-0000-0000');
    expect(screen.queryByRole('heading', { name: 'Request submitted' })).not.toBeInTheDocument();
    expect(screen.getByText('We couldn’t find that request')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to BOM Work' }));
    expect(pathname()).toBe('/work/drafts');
  });

  it('shows no confirmation for a draft that hasn’t been submitted, and leads back to Review & Submit', async () => {
    const store = useAppStore.getState();
    const id = store.createRequest('Still a draft');
    store.updateRequestDetails(id, { businessNeed: 'newProduct', materialScenario: 'noNewMaterials', context: { businessJustification: fv('x') } });
    store.completeIntake(id);
    store.generateInitialItems(id);
    const user = openConfirmation(id);
    expect(screen.queryByRole('heading', { name: 'Request submitted' })).not.toBeInTheDocument();
    expect(screen.getByText('This request hasn’t been submitted yet')).toBeInTheDocument();
    expect(req(id).submittedAt).toBeUndefined();
    await user.click(screen.getByRole('link', { name: 'Go to Review & Submit' }));
    expect(pathname()).toBe(`/requests/${id}/review`);
  });
});
