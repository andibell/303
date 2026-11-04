import { act, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { fv } from '../../domain/requests';
import { getRequestStatus } from '../../domain/status';
import type { FertCreateItem, ItemType } from '../../domain/types';
import { STORAGE_KEY, useAppStore } from '../../store/appStore';
import { renderApp } from '../../test/utils';

const pathname = () => screen.getByTestId('pathname').textContent ?? '';
const req = (id: string) => useAppStore.getState().requests[id];
const typesOf = (id: string) => req(id).items.map((item) => item.type);
const itemId = (id: string, type: ItemType) => req(id).items.find((item) => item.type === type)!.id;

const NAMES = {
  'Finished Product Create': 'Create Finished Product',
  'Finished Product Extend': 'Set Up Plant Availability',
  'Product Bill of Materials': 'Build Product BOM',
} as const;
type Technical = keyof typeof NAMES;

/** A golden-path draft made through the store, exactly as Intake makes it: nothing filled in yet. */
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

function openSetup(path?: string) {
  const id = goldenDraft();
  const user = userEvent.setup();
  renderApp(path ?? `/requests/${id}/setup`);
  return { id, user };
}

const nav = () => screen.getByRole('navigation', { name: 'Request Items' });
const card = (technical: Technical) => within(nav()).getByRole('button', { name: new RegExp(`^${NAMES[technical]}`) });
const cardNames = () =>
  within(nav())
    .queryAllByRole('button', { name: /^(Create Finished Product|Set Up Plant Availability|Build Product BOM)/ })
    .map((button) => button.querySelector('p')?.textContent);
const workspaceHeading = () => document.getElementById('item-workspace-heading');

async function confirmRemove(user: ReturnType<typeof userEvent.setup>, technical: Technical) {
  await user.click(screen.getByRole('button', { name: `Remove ${technical}` }));
  const dialog = screen.getByRole('dialog', { name: `Remove ${NAMES[technical]}?` });
  await user.click(within(dialog).getByRole('button', { name: `Remove ${NAMES[technical]}` }));
  await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
}

async function addViaMenu(user: ReturnType<typeof userEvent.setup>, technical: Technical) {
  await user.click(screen.getByRole('button', { name: 'Add New Request Item' }));
  await user.click(await screen.findByRole('menuitem', { name: new RegExp(NAMES[technical]) }));
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
}

/** Starts work on an item through the store, the way the editors will: some data entered. */
function startCreate(id: string, itemCode?: string) {
  const create = req(id).items.find((item) => item.type === 'finishedGoodsCreate') as FertCreateItem;
  act(() => {
    useAppStore
      .getState()
      .updateItem(id, create.id, { fields: { ...create.data.fields, materialDescription: fv('MODEL-A STD SIZE-B BOX'), ...(itemCode ? { itemCode: fv(itemCode) } : {}) } });
  });
}

describe('Request Setup context', () => {
  it('shows the Request Name as the title, with ID, Draft state, path and save state beneath', () => {
    const { id } = openSetup();
    expect(screen.getByRole('heading', { level: 1, name: 'Product Launch Alpha' })).toBeInTheDocument();
    expect(screen.getByText(`Request ${id}`)).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByTestId('request-path')).toHaveTextContent('New Product / Innovation · No New Materials');
    expect(screen.getByText(/^Saved at/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View Intake' })).not.toBeInTheDocument();
  });

  it('lists the generated items by business name, technical type beneath, opening the first by default', () => {
    openSetup();
    expect(cardNames()).toEqual(['Create Finished Product', 'Set Up Plant Availability', 'Build Product BOM']);
    expect(card('Finished Product Create')).toHaveAttribute('aria-current', 'true');
    expect(workspaceHeading()).toHaveTextContent('Create Finished Product');
    expect(screen.getByTestId('item-technical-label')).toHaveTextContent('Finished Product Create');
    expect(cardNames().join(' ')).not.toMatch(/\d/); // not numbered steps
  });

  it('sends a submitted request to its record, and a future-phase draft back to Intake', () => {
    renderApp('/requests/BR-2026-0148/setup');
    expect(pathname()).toBe('/requests/BR-2026-0148');
  });

  it('sends a draft that has not been through Intake back to Intake', () => {
    renderApp('/requests/BR-2026-0149/setup');
    expect(pathname()).toBe('/requests/BR-2026-0149/intake');
  });
});

describe('progressive validation', () => {
  it('presents untouched items as Not started, with no issue or warning counts', () => {
    const id = goldenDraft();
    renderApp(`/requests/${id}/setup`);
    for (const technical of Object.keys(NAMES) as Technical[]) expect(card(technical)).toHaveTextContent('Not started');
    expect(screen.queryByTestId('item-issues')).not.toBeInTheDocument();
    expect(screen.queryByText(/to resolve/)).not.toBeInTheDocument();
    expect(screen.queryByText(/warning/)).not.toBeInTheDocument();
    expect(screen.getByTestId('item-progress')).toHaveTextContent('0 of 3 Request Items ready');
    const readiness = screen.getByTestId('review-readiness');
    expect(readiness).toHaveTextContent('0 of 3 Request Items ready');
    expect(readiness).toHaveTextContent('Complete the Request Items in any order, then review the request before submitting.');
    expect(readiness).not.toHaveTextContent(/to resolve|warning|need attention/);
  });

  it('leaves the underlying domain validation unchanged', () => {
    const id = goldenDraft();
    const { validation, items } = req(id);
    expect(validation.blockingCount).toBe(9);
    expect(validation.warningCount).toBe(19);
    expect(items.every((item) => item.completeness === 'notStarted' && item.issues.length > 0)).toBe(true);
    renderApp(`/requests/${id}/setup`);
    expect(req(id).validation).toEqual(validation);
  });

  it('shows an item’s issues and warnings once it is In progress', async () => {
    const id = goldenDraft();
    startCreate(id);
    expect(req(id).items.find((item) => item.type === 'finishedGoodsCreate')?.completeness).toBe('inProgress');
    renderApp(`/requests/${id}/setup`);
    expect(card('Finished Product Create')).toHaveTextContent('In progress');
    const issues = screen.getByTestId('item-issues');
    expect(issues).toHaveTextContent('issues to resolve before submission');
    expect(card('Finished Product Extend')).toHaveTextContent('Not started');
    expect(screen.getByTestId('review-readiness')).toHaveTextContent(/to resolve/);
  });

  it('marks an item Needs attention when invalid data was entered, and says so in the summary', () => {
    const id = goldenDraft();
    startCreate(id, 'A1'); // a Product Code shorter than three characters breaks a rule
    expect(req(id).items.find((item) => item.type === 'finishedGoodsCreate')?.completeness).toBe('hasIssues');
    renderApp(`/requests/${id}/setup`);
    expect(card('Finished Product Create')).toHaveTextContent('Needs attention');
    expect(screen.getByTestId('item-progress')).toHaveTextContent('0 of 3 Request Items ready · 1 needs attention');
    expect(screen.getByTestId('review-readiness')).toHaveTextContent('Items still need attention before this request can be submitted.');
  });

  it('does not weaken submission: the domain still refuses an incomplete request, with every blocking issue', () => {
    const id = goldenDraft();
    const result = useAppStore.getState().submitRequest(id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues?.filter((issue) => issue.blocking).length).toBeGreaterThanOrEqual(9);
    expect(req(id).submittedAt).toBeUndefined();
  });
});

describe('Request Item cards', () => {
  it('leads with the business name, then the technical type, with status in the card', () => {
    openSetup();
    const button = card('Finished Product Extend');
    const [name, technical] = Array.from(button.querySelectorAll('p')).map((p) => p.textContent);
    expect(name).toBe('Set Up Plant Availability');
    expect(technical).toBe('Finished Product Extend');
    expect(button).toHaveTextContent('Not started');
  });

  it('keeps the description out of the cards and in the selected workspace', async () => {
    const { user } = openSetup();
    expect(screen.getByTestId('item-description')).toHaveTextContent('Set up the finished product material needed for this request.');
    expect(within(nav()).queryByText(/Set up the finished product material/)).not.toBeInTheDocument();
    expect(within(nav()).queryByText(/component structure/)).not.toBeInTheDocument();
    await user.click(card('Product Bill of Materials'));
    expect(screen.getByTestId('item-description')).toHaveTextContent('Define the component structure for the finished product.');
    expect(within(nav()).queryByText(/component structure/)).not.toBeInTheDocument();
  });

  it('opens items in any order without completing the others first', async () => {
    const { id, user } = openSetup();
    for (const technical of ['Product Bill of Materials', 'Finished Product Extend', 'Finished Product Create'] as const) {
      await user.click(card(technical));
      expect(card(technical)).toHaveAttribute('aria-current', 'true');
      expect(within(nav()).getAllByRole('button').filter((button) => button.getAttribute('aria-current'))).toHaveLength(1);
      expect(workspaceHeading()).toHaveTextContent(NAMES[technical]);
      expect(screen.getByTestId('item-technical-label')).toHaveTextContent(technical);
    }
    expect(req(id).items.every((item) => item.completeness === 'notStarted')).toBe(true);
    expect(pathname()).toBe(`/requests/${id}/setup/${itemId(id, 'finishedGoodsCreate')}`);
  });

  it('is keyboard operable', async () => {
    const { user } = openSetup();
    card('Finished Product Extend').focus();
    await user.keyboard('{Enter}');
    expect(card('Finished Product Extend')).toHaveAttribute('aria-current', 'true');
  });

  it('opens the item named in the address, and shows the first item when the address names a missing one', () => {
    const id = goldenDraft();
    renderApp(`/requests/${id}/setup/${itemId(id, 'finishedGoodsBom')}`);
    expect(workspaceHeading()).toHaveTextContent('Build Product BOM');
  });

  it('shows the first item for an address that names a missing item', () => {
    const id = goldenDraft();
    renderApp(`/requests/${id}/setup/nope`);
    expect(workspaceHeading()).toHaveTextContent('Create Finished Product');
  });

  it('gives each card its own Remove, named for its technical type, and keeps selecting and removing apart', async () => {
    const { id, user } = openSetup();
    expect(screen.getAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove Finished Product Create',
      'Remove Finished Product Extend',
      'Remove Product Bill of Materials',
    ]);
    // Removing a card that isn't open neither opens it nor changes the open item.
    await user.click(screen.getByRole('button', { name: 'Remove Product Bill of Materials' }));
    expect(screen.getByRole('dialog', { name: 'Remove Build Product BOM?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(card('Finished Product Create')).toHaveAttribute('aria-current', 'true'); // still the open item
    expect(typesOf(id)).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Remove Product Bill of Materials' })).toHaveFocus(); // focus returns to what opened the dialog
    // Selecting never removes.
    await user.click(card('Product Bill of Materials'));
    expect(typesOf(id)).toHaveLength(3);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the recommended marker nowhere in the workspace, so it does not dominate', () => {
    openSetup();
    expect(screen.queryByText(/Recommended/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Required$/i)).not.toBeInTheDocument(); // recommended items are never badged as required
  });
});

describe('selected Request Item workspace', () => {
  it('leads with the business name, then the technical type and status, then a short description', () => {
    openSetup();
    const section = screen.getByRole('region', { name: 'Create Finished Product' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Create Finished Product' })).toBeInTheDocument();
    expect(within(section).getByTestId('item-technical-label')).toHaveTextContent('Finished Product Create');
    expect(within(section).getByText('Not started')).toBeInTheDocument();
    expect(within(section).getByTestId('item-description')).toBeInTheDocument();
    expect(within(section).getByTestId('fert-create-editor')).toBeInTheDocument();
  });

  it('keeps the later-stage notice for the items whose editors are not built yet', async () => {
    const { user } = openSetup();
    await user.click(card('Finished Product Extend'));
    expect(screen.getByText('Detailed interaction is outside the current POC review scope.')).toBeInTheDocument();
    expect(screen.queryByText(/later stage|isn’t built|not built/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('fert-create-editor')).not.toBeInTheDocument();
  });

  it('no longer carries Remove or any other item-management action', () => {
    openSetup();
    const section = screen.getByRole('region', { name: 'Create Finished Product' });
    expect(within(section).queryByRole('button', { name: /remove|add/i })).not.toBeInTheDocument();
  });

  it('does not let the user edit the system-defined names', () => {
    openSetup();
    const editors = screen.getAllByRole('button', { name: /edit/i });
    expect(editors.map((button) => button.getAttribute('aria-label'))).toEqual(['Edit request name']);
    expect(screen.queryByRole('textbox', { name: /Create Finished Product|Finished Product Create/ })).not.toBeInTheDocument();
  });
});

describe('removing Request Items', () => {
  it('asks for confirmation and explains the consequences the domain reports', async () => {
    const { id, user } = openSetup();
    await user.click(screen.getByRole('button', { name: 'Remove Finished Product Create' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove Create Finished Product?' });
    expect(dialog).toHaveTextContent('Create Finished Product (Finished Product Create) will be removed from this draft. Nothing has been entered in it yet.');
    expect(dialog).toHaveTextContent('part of the recommended starting template');
    expect(dialog).toHaveTextContent('Set Up Plant Availability and Build Product BOM use values carried over from Create Finished Product');
    expect(dialog).toHaveTextContent('may change whether this request is complete');
    expect(dialog).not.toHaveTextContent(/issue|warning/); // untouched work isn't presented as mistakes
    expect(typesOf(id)).toHaveLength(3); // nothing changes until confirmed

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(typesOf(id)).toHaveLength(3);
    expect(req(id).history.some((event) => event.type === 'itemRemoved')).toBe(false);
  });

  it('warns that entered information goes with the item', async () => {
    const id = goldenDraft();
    startCreate(id);
    const user = userEvent.setup();
    renderApp(`/requests/${id}/setup`);
    await user.click(screen.getByRole('button', { name: 'Remove Finished Product Create' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('along with the information entered in it');
  });

  it('describes no dependent items when the domain reports none', async () => {
    const { user } = openSetup();
    await user.click(screen.getByRole('button', { name: 'Remove Product Bill of Materials' }));
    expect(screen.getByRole('dialog', { name: 'Remove Build Product BOM?' })).not.toHaveTextContent('carried over');
  });

  it.each([
    ['Finished Product Create', 'finishedGoodsCreate', 'Set Up Plant Availability'],
    ['Finished Product Extend', 'extend', 'Create Finished Product'],
    ['Product Bill of Materials', 'finishedGoodsBom', 'Create Finished Product'],
  ] as const)('removes %s from a Draft through the store and keeps a sensible item open', async (technical, type, stays) => {
    const { id, user } = openSetup();
    if (type === 'finishedGoodsBom') await user.click(card('Product Bill of Materials')); // open the item being removed
    await confirmRemove(user, technical);
    expect(typesOf(id)).not.toContain(type);
    expect(typesOf(id)).toHaveLength(2);
    expect(req(id).history.at(-1)).toMatchObject({ type: 'itemRemoved', metadata: { itemType: type, recommended: true } });
    expect(cardNames()).not.toContain(NAMES[technical]);
    expect(screen.getByText(`${NAMES[technical]} removed from this request.`)).toBeInTheDocument();
    expect(workspaceHeading()).toHaveTextContent(type === 'finishedGoodsBom' ? 'Set Up Plant Availability' : stays);
    expect(getRequestStatus(req(id))).toBe('draft');
  });

  it('moves focus to the item that took its place when the open item is removed', async () => {
    const { user } = openSetup();
    await confirmRemove(user, 'Finished Product Create');
    expect(workspaceHeading()).toHaveTextContent('Set Up Plant Availability');
    expect(workspaceHeading()).toHaveFocus();
  });

  it('keeps focus on the open item’s card when a different item is removed', async () => {
    const { user } = openSetup();
    await confirmRemove(user, 'Product Bill of Materials');
    expect(card('Finished Product Create')).toHaveFocus();
    expect(card('Finished Product Create')).toHaveAttribute('aria-current', 'true');
  });

  it('keeps focus on the page when the last item is removed', async () => {
    const { id, user } = openSetup();
    await confirmRemove(user, 'Product Bill of Materials');
    await confirmRemove(user, 'Finished Product Extend');
    await confirmRemove(user, 'Finished Product Create');
    expect(req(id).items).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'No Request Items are included' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add New Request Item' })).toHaveFocus();
    expect(screen.getByTestId('review-readiness')).toHaveTextContent('No Request Items included');
  });

  it('updates progress after a removal, without surfacing counts for untouched work', async () => {
    const { user } = openSetup();
    expect(screen.getByTestId('item-progress')).toHaveTextContent('0 of 3 Request Items ready');
    await confirmRemove(user, 'Finished Product Create');
    expect(screen.getByTestId('item-progress')).toHaveTextContent('0 of 2 Request Items ready');
    expect(screen.queryByText(/to resolve/)).not.toBeInTheDocument();
  });

  it('never regenerates a removed item, including when the user goes back through Intake', async () => {
    const { id, user } = openSetup();
    await confirmRemove(user, 'Product Bill of Materials');
    await confirmRemove(user, 'Finished Product Extend');
    await confirmRemove(user, 'Finished Product Create');
    await user.click(screen.getByRole('link', { name: /^Intake/ }));
    expect(pathname()).toBe(`/requests/${id}/intake`);
    expect(screen.getByRole('radio', { name: 'New Product / Innovation' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Go to Request Setup' }));
    expect(pathname()).toBe(`/requests/${id}/setup`);
    expect(req(id).items).toHaveLength(0);
    expect(req(id).history.filter((event) => event.type === 'itemAdded')).toHaveLength(3);
    await user.click(screen.getByRole('link', { name: 'Back to BOM Work' }));
    expect(screen.getByRole('link', { name: 'Continue Product Launch Alpha' })).toHaveAttribute('href', `/requests/${id}/setup`);
  });
});

describe('Add New +', () => {
  it('sits below the Request Items and offers nothing while all supported items are included', async () => {
    const { user } = openSetup();
    const add = screen.getByRole('button', { name: 'Add New Request Item' });
    expect(add).toHaveTextContent('Add New +');
    expect(nav().compareDocumentPosition(add) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Available to add' })).not.toBeInTheDocument();
    await user.click(add);
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.getByRole('menuitem')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem')).toHaveTextContent('All supported Request Items are included');
  });

  it('lists only the missing supported types, with technical labels and recommendation where useful', async () => {
    const { user } = openSetup();
    await confirmRemove(user, 'Product Bill of Materials');
    await user.click(screen.getByRole('button', { name: 'Add New Request Item' }));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Build Product BOM');
    expect(items[0]).toHaveTextContent('Product Bill of Materials · Recommended for this request');
  });

  it('adds a removed item back through the store as an explicit action, and focuses it', async () => {
    const { id, user } = openSetup();
    await confirmRemove(user, 'Finished Product Create');
    await addViaMenu(user, 'Finished Product Create');
    expect(typesOf(id)).toContain('finishedGoodsCreate');
    expect(req(id).history.at(-1)).toMatchObject({ type: 'itemAdded', metadata: { itemType: 'finishedGoodsCreate' } });
    expect(req(id).history.filter((event) => event.type === 'itemAdded')).toHaveLength(4);
    expect(cardNames()).toEqual(['Create Finished Product', 'Set Up Plant Availability', 'Build Product BOM']);
    expect(card('Finished Product Create')).toHaveAttribute('aria-current', 'true');
    expect(workspaceHeading()).toHaveFocus();
    expect(screen.getByText('Create Finished Product added to this request.')).toBeInTheDocument();
    expect(screen.getByTestId('item-progress')).toHaveTextContent('0 of 3 Request Items ready');
  });

  it('explains when an item can’t be added yet, and never offers a duplicate', async () => {
    const { id, user } = openSetup();
    expect(useAppStore.getState().addItem(id, 'extend').ok).toBe(false);
    expect(typesOf(id)).toHaveLength(3);

    await confirmRemove(user, 'Finished Product Extend');
    await confirmRemove(user, 'Finished Product Create');
    await user.click(screen.getByRole('button', { name: 'Add New Request Item' }));
    const extend = screen.getByRole('menuitem', { name: /Set Up Plant Availability/ });
    expect(extend).toHaveAttribute('aria-disabled', 'true');
    expect(extend).toHaveTextContent('Add Finished Product Create before Extend.');
    expect(screen.getAllByRole('menuitem')).toHaveLength(2); // Create and Extend; BOM is still included
    await user.click(screen.getByRole('menuitem', { name: /Create Finished Product/ }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add New Request Item' }));
    expect(screen.getByRole('menuitem', { name: /Set Up Plant Availability/ })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('refuses Draft item changes on a submitted request', () => {
    const store = useAppStore.getState();
    const submitted = store.requests['BR-2026-0148'];
    expect(store.removeItem(submitted.id, submitted.items[0].id).ok).toBe(false);
    expect(store.addItem(submitted.id, 'finishedGoodsCreate').ok).toBe(false);
    expect(useAppStore.getState().requests['BR-2026-0148'].items).toHaveLength(submitted.items.length);
  });
});

describe('editing the Request Name', () => {
  const editName = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Edit request name' }));
    return screen.getByRole('textbox', { name: /request name/i });
  };

  it('edits in place: shows the current name focused, then saves through the store', async () => {
    const { id, user } = openSetup();
    const before = req(id);
    const input = await editName(user);
    expect(input).toHaveValue('Product Launch Alpha');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Product Alpha Innovation');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const after = req(id);
    expect(after.name).toBe('Product Alpha Innovation');
    expect(after.id).toBe(before.id);
    expect(after.items).toEqual(before.items);
    expect(after.businessNeed).toBe(before.businessNeed);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: 'Product Alpha Innovation' })).toBeInTheDocument();
    expect(screen.getByText('Request name updated.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit request name' })).toHaveFocus();
    expect(screen.getByText(`Request ${id}`)).toBeInTheDocument();
  });

  it('saves with Enter and cancels with Escape, restoring the stored value', async () => {
    const { id, user } = openSetup();
    const before = req(id);
    let input = await editName(user);
    await user.clear(input);
    await user.type(input, 'Something else');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('heading', { level: 1, name: 'Product Launch Alpha' })).toBeInTheDocument();
    expect(req(id)).toBe(before); // nothing was written
    expect(screen.getByRole('button', { name: 'Edit request name' })).toHaveFocus();

    input = await editName(user);
    expect(input).toHaveValue('Product Launch Alpha'); // the stored value, not the abandoned edit
    await user.clear(input);
    await user.type(input, 'Future Path Sample{Enter}');
    expect(req(id).name).toBe('Future Path Sample');
  });

  it('cancels with the Cancel button and makes no change', async () => {
    const { id, user } = openSetup();
    const before = req(id);
    const input = await editName(user);
    await user.type(input, ' extra');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(req(id)).toBe(before);
    expect(screen.getByRole('heading', { level: 1, name: 'Product Launch Alpha' })).toBeInTheDocument();
  });

  it('requires a non-empty name', async () => {
    const { id, user } = openSetup();
    const before = req(id);
    const input = await editName(user);
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name for this request.')).toBeInTheDocument();
    expect(input).toBeInvalid();
    expect(req(id)).toBe(before);
    await user.type(input, 'Summer Innovation Launch');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(req(id).name).toBe('Summer Innovation Launch');
  });

  it('changes nothing but the name: not the items, material descriptions, System identifiers or other details', async () => {
    const id = goldenDraft();
    startCreate(id);
    const user = userEvent.setup();
    renderApp(`/requests/${id}/setup`);
    const before = req(id);
    const input = await editName(user);
    await user.clear(input);
    await user.type(input, 'Product Beta Launch{Enter}');
    const after = req(id);
    expect(after.items).toEqual(before.items);
    expect((after.items[0] as FertCreateItem).data.fields.materialDescription?.value).toBe('MODEL-A STD SIZE-B BOX');
    expect(after.items.map((item) => item.executionIdentifier)).toEqual(before.items.map((item) => item.executionIdentifier));
    expect(after.context).toEqual(before.context);
    expect(after.materialScenario).toBe(before.materialScenario);
  });

  it('is reflected in BOM Work straight away', async () => {
    const { id, user } = openSetup();
    const input = await editName(user);
    await user.clear(input);
    await user.type(input, 'Product Alpha Innovation{Enter}');
    await user.click(screen.getByRole('link', { name: 'Back to BOM Work' }));
    expect(screen.getByRole('link', { name: 'Continue Product Alpha Innovation' })).toHaveAttribute('href', `/requests/${id}/setup`);
    expect(screen.queryByText('Product Launch Alpha')).not.toBeInTheDocument();
  });

  it('is never derived from material attributes', () => {
    const id = goldenDraft('Future Path Sample');
    startCreate(id);
    expect(req(id).name).toBe('Future Path Sample');
  });

  it('is not offered, or accepted, once a request has been submitted', () => {
    renderApp('/requests/BR-2026-0148');
    expect(screen.queryByRole('button', { name: 'Edit request name' })).not.toBeInTheDocument();
    const before = req('BR-2026-0148');
    expect(useAppStore.getState().updateRequestDetails('BR-2026-0148', { name: 'Renamed' }).ok).toBe(false);
    expect(req('BR-2026-0148').name).toBe(before.name);
  });
});

describe('authoring navigation', () => {
  it('shows the three stages as navigation, with Request Setup current and Review & Submit not reached', () => {
    openSetup();
    const stages = screen.getByRole('navigation', { name: 'Request authoring' });
    const items = within(stages).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).toHaveTextContent('Request Setup');
    expect(items[2]).toHaveTextContent('Review & Submit');
    expect(items[2]).not.toHaveTextContent('completed');
    expect(items[2]).not.toHaveAttribute('aria-current');
    expect(items[0]).toHaveTextContent('Intake (completed)');
  });

  it('returns to Intake through it, keeps everything, and comes back to Request Setup', async () => {
    const { id, user } = openSetup();
    await confirmRemove(user, 'Product Bill of Materials');
    const before = req(id);
    await user.click(within(screen.getByRole('navigation', { name: 'Request authoring' })).getByRole('link', { name: /^Intake/ }));
    expect(pathname()).toBe(`/requests/${id}/intake`);
    expect(screen.getByRole('navigation', { name: 'Request authoring' }).querySelector('[aria-current="step"]')).toHaveTextContent('Intake');
    expect(req(id)).toBe(before); // visiting Intake changes nothing

    await user.click(screen.getByRole('button', { name: 'Go to Request Setup' }));
    expect(pathname()).toBe(`/requests/${id}/setup`);
    expect(typesOf(id)).toEqual(['finishedGoodsCreate', 'extend']);
    expect(cardNames()).toEqual(['Create Finished Product', 'Set Up Plant Availability']);
  });

  it('reaches Review & Submit without submitting anything', async () => {
    const { id, user } = openSetup();
    expect(screen.getByTestId('review-readiness')).toHaveTextContent('Nothing is submitted until you submit from Review & Submit.');
    await user.click(screen.getByRole('link', { name: 'Continue to Review & Submit' }));
    expect(pathname()).toBe(`/requests/${id}/review`);
    expect(req(id).submittedAt).toBeUndefined();
    expect(getRequestStatus(req(id))).toBe('draft');
    expect(req(id).history.some((event) => event.type === 'requestSubmitted')).toBe(false);
  });
});

describe('saving', () => {
  it('saves the draft through the store and keeps item changes after a reload', async () => {
    const { id, user } = openSetup();
    await confirmRemove(user, 'Finished Product Create');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(req(id).history.at(-1)?.type).toBe('draftSaved');
    expect(screen.getByText(/Draft saved/)).toBeInTheDocument();

    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    act(() => useAppStore.setState({ requests: {} }));
    localStorage.setItem(STORAGE_KEY, saved);
    await act(async () => useAppStore.persist.rehydrate());
    expect(typesOf(id)).toEqual(['extend', 'finishedGoodsBom']);
  });
});

describe('role access', () => {
  it('keeps Request Setup Requestor-only: an Execution Specialist is sent back to their landing page', () => {
    const id = goldenDraft();
    useAppStore.setState({ role: 'executionSpecialist' });
    renderApp(`/requests/${id}/setup`);
    expect(pathname()).toBe('/work/requests');
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

  it('collapses the item list behind a summary that keeps the current item in view', async () => {
    const { user } = openSetup();
    const toggle = screen.getByRole('button', { name: /Request Items · 0 of 3 Request Items ready/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Create Finished Product · Not started');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(card('Product Bill of Materials'));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Build Product BOM · Not started');
    expect(workspaceHeading()).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Request actions' })).toContainElement(screen.getByRole('button', { name: 'Save Draft' }));
  });

  it('keeps Remove and Add New + reachable inside the collapsed list, and separate from selection', async () => {
    const { id, user } = openSetup();
    await user.click(screen.getByRole('button', { name: /Request Items · / }));
    expect(screen.getByRole('button', { name: 'Remove Finished Product Extend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add New Request Item' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Finished Product Extend' }));
    expect(screen.getByRole('dialog', { name: 'Remove Set Up Plant Availability?' })).toBeInTheDocument();
    expect(typesOf(id)).toHaveLength(3);
  });

  it('keeps the Request Name editable', async () => {
    const { id, user } = openSetup();
    await user.click(screen.getByRole('button', { name: 'Edit request name' }));
    await user.type(screen.getByRole('textbox', { name: /request name/i }), ' 2{Enter}');
    expect(req(id).name).toBe('Product Launch Alpha 2');
  });
});
