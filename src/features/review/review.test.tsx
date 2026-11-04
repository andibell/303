import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { fv } from '../../domain/requests';
import { getRequestStatus } from '../../domain/status';
import type { ItemType } from '../../domain/types';
import { useAppStore } from '../../store/appStore';
import { validDraft } from '../../test/fixtures';
import { renderApp } from '../../test/utils';

const pathname = () => screen.getByTestId('pathname').textContent ?? '';
const req = (id: string) => useAppStore.getState().requests[id];
const itemId = (id: string, type: ItemType) => req(id).items.find((item) => item.type === type)!.id;
const section = (name: string) => screen.getByRole('region', { name });
const summary = () => screen.getByTestId('validation-summary');

/** A golden-path draft made through the store, as Intake makes it: nothing filled in yet. */
function goldenDraft(name = 'Product Launch Alpha') {
  const store = useAppStore.getState();
  const id = store.createRequest(name);
  store.updateRequestDetails(id, {
    businessNeed: 'newProduct',
    materialScenario: 'noNewMaterials',
    context: { businessJustification: fv('New sample product.') },
  });
  store.completeIntake(id);
  store.generateInitialItems(id);
  return id;
}

/** A draft with no blocking issues, built by the domain fixtures and placed in the store. */
function readyDraft() {
  const { request } = validDraft();
  act(() => useAppStore.setState((state) => ({ requests: { ...state.requests, [request.id]: request } })));
  return request.id;
}

function openReview(id: string) {
  const user = userEvent.setup();
  renderApp(`/requests/${id}/review`);
  return user;
}

describe('Review & Submit context', () => {
  it('shows Intake and Request Setup as completed stages and Review & Submit as current', () => {
    openReview(goldenDraft());
    const stages = within(screen.getByRole('navigation', { name: 'Request authoring' })).getAllByRole('listitem');
    expect(stages[0]).toHaveTextContent('Intake (completed)');
    expect(stages[1]).toHaveTextContent('Request Setup (completed)');
    expect(stages[2]).toHaveTextContent('Review & Submit');
    expect(stages[2]).not.toHaveTextContent('completed');
    expect(stages[2]).toHaveAttribute('aria-current', 'step');
  });

  it('summarizes the request from its own data', () => {
    const id = goldenDraft();
    openReview(id);
    expect(screen.getByRole('heading', { level: 1, name: 'Product Launch Alpha' })).toBeInTheDocument();
    expect(screen.getByText(`Request ${id}`)).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    const card = section('Request summary');
    expect(card).toHaveTextContent('New Product / Innovation');
    expect(card).toHaveTextContent('No New Materials');
    expect(card).toHaveTextContent('New sample product.');
    expect(card).toHaveTextContent('3 Request Items');
  });

  it('sends a draft that has not been through Intake back to Intake', () => {
    const id = useAppStore.getState().createRequest('Unfinished');
    openReview(id);
    expect(pathname()).toBe(`/requests/${id}/intake`);
  });
});

describe('read-only Request Items', () => {
  it('shows each Request Item the request holds, with its entered and generated values', () => {
    const id = readyDraft();
    openReview(id);
    const create = section('Create Finished Product');
    expect(create).toHaveTextContent('Finished Product Create');
    expect(create).toHaveTextContent('CS - Case');
    expect(create).toHaveTextContent('TEST MODEL-B SIZE-B BOX 12PK');
    expect(section('Set Up Plant Availability')).toHaveTextContent('FAC-01 · Facility 01');
    // Values carried over from Create Finished Product keep their provenance note.
    expect(section('Build Product BOM')).toHaveTextContent('From Create Finished Product.');
    expect(within(screen.getByRole('main')).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(screen.getByRole('main')).queryAllByRole('combobox')).toHaveLength(0);
  });

  it('follows the request’s actual items, not a fixed list', () => {
    const id = goldenDraft();
    useAppStore.getState().removeItem(id, itemId(id, 'finishedGoodsBom'));
    openReview(id);
    expect(screen.queryByRole('region', { name: 'Build Product BOM' })).not.toBeInTheDocument();
    expect(section('Request summary')).toHaveTextContent('2 Request Items');
  });

  it('lets each item be collapsed and expanded', async () => {
    const user = openReview(readyDraft());
    const toggle = screen.getByRole('button', { name: 'Hide details for Create Finished Product' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show details for Create Finished Product' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('returns to the item in Request Setup from its Edit action', async () => {
    const id = goldenDraft();
    const user = openReview(id);
    await user.click(within(section('Create Finished Product')).getByRole('link', { name: 'Edit Create Finished Product' }));
    expect(pathname()).toBe(`/requests/${id}/setup/${itemId(id, 'finishedGoodsCreate')}`);
  });
});

describe('validation summary', () => {
  it('says Unable to submit and lists the blocking issues with a way back to each', async () => {
    const id = goldenDraft();
    const user = openReview(id);
    expect(within(summary()).getByRole('heading', { name: 'Unable to submit' })).toBeInTheDocument();
    expect(summary()).toHaveTextContent('Create Finished Product');
    expect(summary()).toHaveTextContent('Minimum Shelf Life is required.');
    await user.click(within(summary()).getByRole('link', { name: 'Edit Create Finished Product' }));
    expect(pathname()).toBe(`/requests/${id}/setup/${itemId(id, 'finishedGoodsCreate')}`);
  });

  it('says Ready to submit when the domain finds nothing blocking', () => {
    openReview(readyDraft());
    expect(within(summary()).getByRole('heading', { name: 'Ready to submit' })).toBeInTheDocument();
    expect(screen.getByTestId('submit-readiness')).toHaveTextContent('Ready to submit');
  });
});

describe('submitting', () => {
  it('refuses an incomplete request, keeps it a draft and moves focus to the validation summary', async () => {
    const id = goldenDraft();
    const user = openReview(id);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(pathname()).toBe(`/requests/${id}/review`);
    expect(req(id).submittedAt).toBeUndefined();
    expect(getRequestStatus(req(id))).toBe('draft');
    expect(screen.getByRole('alert')).toHaveTextContent('Validation found issues that must be fixed before submitting.');
    expect(document.activeElement).toHaveTextContent('Unable to submit');
  });

  it('submits a ready request through the store and confirms it in BOM Work', async () => {
    const id = readyDraft();
    const user = openReview(id);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(getRequestStatus(req(id))).toBe('readyForExecution');
    expect(req(id).history.some((event) => event.type === 'requestSubmitted')).toBe(true);
    expect(pathname()).toBe('/work/requests');
    expect(await screen.findByText('Test product submitted. Status: Ready for Execution.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Test product' })).toBeInTheDocument();
  });

  it('offers Back to Request Setup and Edit Request Details instead of editing in Review', async () => {
    const id = goldenDraft();
    const user = openReview(id);
    await user.click(screen.getByRole('link', { name: 'Back to Request Setup' }));
    expect(pathname()).toBe(`/requests/${id}/setup`);
  });

  it('opens Request Setup from Edit Request Details', async () => {
    const id = goldenDraft();
    const user = openReview(id);
    await user.click(screen.getByRole('link', { name: 'Edit Request Details' }));
    expect(pathname()).toBe(`/requests/${id}/setup`);
  });
});

describe('narrow screens', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('opens only the items that need attention', () => {
    openReview(goldenDraft());
    expect(screen.getByRole('button', { name: /details for Create Finished Product/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /details for Build Product BOM/ })).toHaveAttribute('aria-expanded', 'false');
  });
});
