import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BUSINESS_NEEDS, MATERIAL_SCENARIOS } from '../../domain/businessNeeds';
import { getLifecycle, getRequestStatus } from '../../domain/status';
import { STORAGE_KEY, useAppStore } from '../../store/appStore';
import { renderApp } from '../../test/utils';

const pathname = () => screen.getByTestId('pathname').textContent ?? '';
const draftId = () => pathname().split('/')[2];
const draft = () => useAppStore.getState().requests[draftId()];
const FUTURE = 'Planned for a future phase';
const futureNotice = () => screen.getByText(FUTURE).closest('[role="status"]') as HTMLElement;

async function startNewRequest() {
  const user = userEvent.setup();
  renderApp('/work/drafts');
  await user.click(screen.getByRole('link', { name: 'New Request' }));
  return user;
}

const pickNeed = (user: ReturnType<typeof userEvent.setup>, label: string) => user.click(screen.getByRole('radio', { name: label }));

async function reachGoldenPath(user: ReturnType<typeof userEvent.setup>) {
  await pickNeed(user, 'New Product / Innovation');
  await pickNeed(user, 'No New Materials');
}

describe('New Request', () => {
  it('creates a Draft through the store as the logged-in Requestor and opens Intake', async () => {
    const before = Object.keys(useAppStore.getState().requests).length;
    await startNewRequest();
    expect(pathname()).toMatch(/^\/requests\/BR-\d{4}-\d{4}\/intake$/);
    expect(Object.keys(useAppStore.getState().requests)).toHaveLength(before + 1);
    const request = draft();
    expect(request.requestor.name).toBe('Demo Requestor');
    expect(getRequestStatus(request)).toBe('draft');
    expect(request.history.map((event) => event.type)).toEqual(['draftCreated']);
    expect(screen.getByRole('heading', { level: 1, name: 'New BOM Request' })).toBeInTheDocument();
    expect(screen.getByText(`Request ${request.id}`)).toBeInTheDocument();
  });

  it('asks the primary question and shows the three stages', async () => {
    await startNewRequest();
    expect(screen.getByRole('group', { name: /what is the business need for this request/i })).toBeInTheDocument();
    expect(screen.getByText('Request Setup')).toBeInTheDocument();
    expect(screen.getByText('Review & Submit')).toBeInTheDocument();
  });
});

describe('Business Need', () => {
  it('makes all six business needs selectable and saves the choice on the draft', async () => {
    const user = await startNewRequest();
    for (const need of BUSINESS_NEEDS) {
      const radio = screen.getByRole('radio', { name: need.label });
      expect(radio).toBeEnabled();
      await user.click(radio);
      expect(radio).toBeChecked();
      expect(draft().businessNeed).toBe(need.id);
    }
  });

  it.each(BUSINESS_NEEDS.filter((need) => !need.functional))('explains $label as a future phase and generates nothing', async (need) => {
    const user = await startNewRequest();
    await pickNeed(user, need.label);
    const notice = futureNotice();
    expect(notice).toHaveTextContent(FUTURE);
    expect(notice).toHaveTextContent(need.label);
    expect(draft().items).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /continue to request setup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recommended Request Items' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /new materials/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // informational, not an error
    expect(screen.getAllByRole('button', { name: 'Save Draft' }).length).toBeGreaterThan(0);
  });

  it('lets the user change a future choice back to the functional path', async () => {
    const user = await startNewRequest();
    await pickNeed(user, 'Packaging or Graphics Change');
    expect(futureNotice()).toBeInTheDocument();
    await pickNeed(user, 'New Product / Innovation');
    expect(screen.queryByText(FUTURE)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /new materials/i })).toBeInTheDocument();
  });

  it('clears the material scenario when the business need moves away from New Product', async () => {
    const user = await startNewRequest();
    await reachGoldenPath(user);
    expect(draft().materialScenario).toBe('noNewMaterials');
    await pickNeed(user, 'Facility or Contract Manufacturer Setup');
    expect(draft().materialScenario).toBeNull();
  });
});

describe('Material scenario', () => {
  it('reveals the question only for New Product / Innovation, with all four values selectable', async () => {
    const user = await startNewRequest();
    expect(screen.queryByRole('group', { name: /new materials/i })).not.toBeInTheDocument();
    await pickNeed(user, 'New Product / Innovation');
    expect(screen.getByRole('group', { name: /will this request need any new materials/i })).toBeInTheDocument();
    for (const scenario of MATERIAL_SCENARIOS) {
      const radio = screen.getByRole('radio', { name: scenario.label });
      expect(radio).toBeEnabled();
      await user.click(radio);
      expect(draft().materialScenario).toBe(scenario.id);
    }
  });

  it.each(MATERIAL_SCENARIOS.filter((scenario) => !scenario.functional))(
    'treats $label as future phase: message, no template, no items',
    async (scenario) => {
      const user = await startNewRequest();
      await pickNeed(user, 'New Product / Innovation');
      await pickNeed(user, scenario.label);
      expect(futureNotice()).toHaveTextContent(/future product model/i);
      expect(futureNotice()).toHaveTextContent(scenario.label);
      expect(draft().items).toHaveLength(0);
      expect(draft().materialScenario).toBe(scenario.id);
      expect(screen.queryByRole('list', { name: 'Recommended Request Items' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /business justification/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /continue to request setup/i })).not.toBeInTheDocument();
    },
  );

  it('follows the functional path for No New Materials', async () => {
    const user = await startNewRequest();
    await reachGoldenPath(user);
    expect(screen.queryByText(FUTURE)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /business justification/i })).toBeInTheDocument();
    const preview = screen.getByRole('list', { name: 'Recommended Request Items' });
    expect(within(preview).getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent)).toEqual([
      'Create Finished Product',
      'Set Up Plant Availability',
      'Build Product BOM',
    ]);
    expect(within(preview).getByText('Finished Product Extend')).toBeInTheDocument();
    expect(screen.getByText(/we’ll start with these request items/i)).toBeInTheDocument();
    expect(screen.getByText(/not a fixed workflow/i)).toBeInTheDocument();
    expect(draft().items).toHaveLength(0); // nothing is generated until Continue
  });
});

describe('Intake validation', () => {
  it('does not flag untouched fields, but flags an emptied field after the user leaves it', async () => {
    const user = await startNewRequest();
    expect(screen.queryByText(/enter a name for this request/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('textbox', { name: /request name/i }));
    await user.tab();
    expect(screen.getByText('Enter a name for this request.')).toBeInTheDocument();
  });

  it('blocks Continue until the required Intake information is present, next to each field', async () => {
    const user = await startNewRequest();
    await user.click(screen.getByRole('button', { name: /continue to request setup/i }));
    expect(screen.getByText('Select a business need.')).toBeInTheDocument();
    expect(screen.getByText('Enter a name for this request.')).toBeInTheDocument();
    expect(pathname()).toMatch(/intake$/);
    expect(draft().items).toHaveLength(0);

    await pickNeed(user, 'New Product / Innovation');
    await user.click(screen.getByRole('button', { name: /continue to request setup/i }));
    expect(screen.getByText('Select a material scenario.')).toBeInTheDocument();
  });

  it('requires a business justification on the functional path and keeps what was entered', async () => {
    const user = await startNewRequest();
    await user.type(screen.getByRole('textbox', { name: /request name/i }), 'Product Alpha Sample');
    await reachGoldenPath(user);
    await user.click(screen.getByRole('button', { name: /continue to request setup/i }));

    expect(screen.getByText('Business justification is required.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /business justification/i })).toBeInvalid();
    expect(pathname()).toMatch(/intake$/);
    expect(draft().items).toHaveLength(0);
    expect(screen.getByRole('textbox', { name: /request name/i })).toHaveValue('Product Alpha Sample');
    expect(draft().name).toBe('Product Alpha Sample');
    expect(draft().materialScenario).toBe('noNewMaterials');
  });
});

describe('Reference Data upload', () => {
  const file = (name: string, size = 4096) => new File([new Uint8Array(size)], name);

  it('shows the chosen file, labels it simulated, and stores only metadata', async () => {
    const user = await startNewRequest();
    await reachGoldenPath(user);
    await user.upload(screen.getByLabelText('Reference Data file', { selector: 'input' }), file('sample-reference-data.xlsx', 6144));

    expect(screen.getByText('sample-reference-data.xlsx')).toBeInTheDocument();
    expect(screen.getByText('Simulated upload')).toBeInTheDocument();
    expect(screen.getByText(/nothing is read or extracted/i)).toBeInTheDocument();
    expect(draft().uploads).toHaveLength(1);
    expect(draft().uploads[0]).toMatchObject({ fileName: 'sample-reference-data.xlsx', kind: 'referenceDocument', sizeBytes: 6144, simulated: true, populatedFields: [] });
  });

  it('replaces and removes the file before progressing', async () => {
    const user = await startNewRequest();
    await reachGoldenPath(user);
    const input = screen.getByLabelText('Reference Data file', { selector: 'input' });
    await user.upload(input, file('first.xlsx'));
    await user.upload(input, file('second.xlsx'));
    expect(screen.queryByText('first.xlsx')).not.toBeInTheDocument();
    expect(screen.getByText('second.xlsx')).toBeInTheDocument();
    expect(draft().uploads.map((u) => u.fileName)).toEqual(['second.xlsx']);

    await user.click(screen.getByRole('button', { name: 'Remove second.xlsx' }));
    expect(screen.queryByText('second.xlsx')).not.toBeInTheDocument();
    expect(draft().uploads).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Choose Reference Data file' })).toBeInTheDocument();
  });

  it('is not offered before the functional path is reached', async () => {
    const user = await startNewRequest();
    expect(screen.queryByText(/Reference Data file/)).not.toBeInTheDocument();
    await pickNeed(user, 'New Product / Innovation');
    await pickNeed(user, 'Some New Materials');
    expect(screen.queryByText(/Reference Data file/)).not.toBeInTheDocument();
  });
});

describe('Save Draft', () => {
  it('saves through the store, confirms visibly, and updates last modified', async () => {
    const user = await startNewRequest();
    const before = draft();
    await user.type(screen.getByRole('textbox', { name: /request name/i }), 'Saved product');
    await user.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    expect(screen.getByText(/draft saved\. you’ll find it in bom work under drafts/i)).toBeInTheDocument();
    expect(screen.getByText(/^Saved at /)).toBeInTheDocument();
    const after = draft();
    expect(after.name).toBe('Saved product');
    expect(after.history.at(-1)?.type).toBe('draftSaved');
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });

  it('keeps a future-phase choice when saved', async () => {
    const user = await startNewRequest();
    await pickNeed(user, 'Reformulation / Ingredient Change');
    await user.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);
    expect(draft().businessNeed).toBe('reformulation');
    expect(draft().history.at(-1)?.type).toBe('draftSaved');
    expect(draft().items).toHaveLength(0);
  });

  it('lets the user leave, find the draft in BOM Work, and still have it after a reload', async () => {
    const user = await startNewRequest();
    await user.type(screen.getByRole('textbox', { name: /request name/i }), 'Product Beta Sample');
    await pickNeed(user, 'New Product / Innovation');
    await user.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);
    await user.click(screen.getByRole('link', { name: 'Back to BOM Work' }));

    expect(pathname()).toBe('/work/drafts');
    const row = screen.getByRole('row', { name: /Product Beta Sample/ });
    expect(row).toHaveTextContent('New Product / Innovation');
    expect(row).toHaveTextContent('Intake in progress');

    // Simulate a browser reload: keep only what was persisted, then rehydrate and render again.
    const id = Object.values(useAppStore.getState().requests).find((r) => r.name === 'Product Beta Sample')!.id;
    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    act(() => useAppStore.setState({ requests: {} }));
    localStorage.setItem(STORAGE_KEY, saved);
    await act(async () => useAppStore.persist.rehydrate());
    expect(useAppStore.getState().requests[id].name).toBe('Product Beta Sample');
    expect(getLifecycle(useAppStore.getState().requests[id])).toBe('drafts');
  });

  it('commits typed text when the user clicks a link without tabbing out first', async () => {
    const user = await startNewRequest();
    await user.type(screen.getByRole('textbox', { name: /request name/i }), 'Typed then left');
    await user.click(screen.getByRole('link', { name: 'Back to BOM Work' }));
    expect(screen.getByRole('row', { name: /Typed then left/ })).toBeInTheDocument();
  });
});

describe('golden path to Request Setup', () => {
  async function completeIntake() {
    const user = await startNewRequest();
    await user.type(screen.getByRole('textbox', { name: /request name/i }), 'Product Gamma Sample');
    await reachGoldenPath(user);
    await user.type(screen.getByRole('textbox', { name: /business justification/i }), 'New sample product for the Region A region.');
    await user.click(screen.getByRole('button', { name: /continue to request setup/i }));
    return user;
  }

  it('generates Finished Product Create, Extend and Product Bill of Materials through the domain and records the history', async () => {
    await completeIntake();
    const request = draft();
    expect(request.items.map((item) => item.type)).toEqual(['finishedGoodsCreate', 'extend', 'finishedGoodsBom']);
    expect(request.history.map((event) => event.type)).toEqual([
      'draftCreated',
      'intakeCompleted',
      'itemAdded',
      'itemAdded',
      'itemAdded',
    ]);
    expect(request.context.businessJustification?.value).toBe('New sample product for the Region A region.');
    expect(getLifecycle(request)).toBe('drafts');
  });

  it('hands off to Request Setup with the request context and the three items', async () => {
    await completeIntake();
    expect(pathname()).toBe(`/requests/${draftId()}/setup`);
    expect(screen.getByRole('heading', { level: 1, name: 'Product Gamma Sample' })).toBeInTheDocument();
    expect(screen.getByTestId('request-path')).toHaveTextContent('New Product / Innovation · No New Materials');
    const nav = screen.getByRole('navigation', { name: 'Request Items' });
    expect(within(nav).getAllByRole('button', { name: /^(Create Finished Product|Set Up Plant Availability|Build Product BOM)/ })).toHaveLength(3);
  });

  it('does not generate items twice when the user returns to Intake and continues', async () => {
    const user = await completeIntake();
    await user.click(screen.getByRole('link', { name: /^Intake/ }));
    expect(screen.getByText(/request items have been generated/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Packaging or Graphics Change' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /go to request setup/i }));
    expect(draft().items).toHaveLength(3);
    expect(draft().history.filter((event) => event.type === 'itemAdded')).toHaveLength(3);
  });

  it('sends the Continue link of a draft with items to Request Setup', async () => {
    const user = await completeIntake();
    const id = draftId();
    await user.click(screen.getByRole('link', { name: 'Back to BOM Work' }));
    expect(screen.getByRole('link', { name: 'Continue Product Gamma Sample' })).toHaveAttribute('href', `/requests/${id}/setup`);
  });
});

describe('unknown and submitted requests', () => {
  it('explains when an Intake address doesn’t match a request', () => {
    renderApp('/requests/nope/intake');
    expect(screen.getByText(/couldn’t find that request/i)).toBeInTheDocument();
  });

  it('sends a submitted request’s Intake address to its record', () => {
    renderApp('/requests/BR-2026-0148/intake');
    expect(pathname()).toBe('/requests/BR-2026-0148');
  });
});
