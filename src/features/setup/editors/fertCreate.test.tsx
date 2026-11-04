import { act, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '../../../app/AppProviders';
import { REFERENCE_DATA } from '../../../data/reference';
import { ITEM_DEFS } from '../../../domain/items/fieldSpecs';
import { fv } from '../../../domain/requests';
import type { FertCreateItem, ValidationIssue } from '../../../domain/types';
import { STORAGE_KEY, useAppStore } from '../../../store/appStore';
import { renderApp } from '../../../test/utils';
import { FieldControl } from './FieldControl';

const req = (id: string) => useAppStore.getState().requests[id];
const create = (id: string) => req(id).items.find((item) => item.type === 'finishedGoodsCreate') as FertCreateItem;
const fields = (id: string) => create(id).data.fields;

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

function openEditor(id = goldenDraft()) {
  const user = userEvent.setup();
  renderApp(`/requests/${id}/setup`);
  return { id, user };
}

const editor = () => screen.getByTestId('fert-create-editor');
const box = (label: RegExp) => within(editor()).getByRole('textbox', { name: label });
const nav = () => screen.getByRole('navigation', { name: 'Request Items' });
const card = (name: string) => within(nav()).getByRole('button', { name: new RegExp(`^${name}`) });
const workspaceStatus = () => within(screen.getByRole('region', { name: 'Create Finished Product' })).getAllByText(/Not started|In progress|Needs attention|Complete/)[0];

type User = ReturnType<typeof userEvent.setup>;

async function chooseUnit(user: User, label: string) {
  await user.click(within(editor()).getByRole('combobox', { name: /Orderable Unit/ }));
  await user.click(await screen.findByRole('option', { name: label }));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
}

async function chooseIn(user: User, field: RegExp, option: string) {
  await user.click(within(editor()).getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
}

/** The concept attributes for "ALPH STD MODEL-A SIZE-B BOX 12PK". */
async function describeProduct(user: User) {
  await chooseIn(user, /^Brand/, 'Brand Alpha');
  await chooseIn(user, /^Variant/, 'Standard');
  await chooseIn(user, /^Model/, 'Model A');
  await chooseIn(user, /^Package size/, 'Size B');
  await chooseIn(user, /^Container type/, 'Box');
  await chooseIn(user, /^Pack configuration/, '12-pack');
}

/** Fills every required Finished Product Create field with valid representative values. BOM setup is derived. */
async function fillValid(user: User) {
  await user.type(box(/Source Material Identifier/), '900123');
  await describeProduct(user);
  await user.type(box(/Product Code/), '10049000123456');
  await chooseUnit(user, 'CS - Case');
  await user.type(box(/Minimum Shelf Life/), '90');
  await user.type(box(/Total Shelf Life/), '270');
  await user.click(within(editor()).getByRole('radio', { name: /Ambient/ }));
  await user.click(within(editor()).getByRole('radio', { name: 'Region A' }));
}

describe('Create Finished Product editor', () => {
  it('renders inside the selected workspace with the business and technical names kept', () => {
    openEditor();
    const section = screen.getByRole('region', { name: 'Create Finished Product' });
    expect(within(section).getByTestId('fert-create-editor')).toBeInTheDocument();
    expect(within(section).getByTestId('item-technical-label')).toHaveTextContent('Finished Product Create');
    expect(within(section).getByTestId('item-description')).toHaveTextContent('Set up the finished product material needed for this request.');
  });

  it('groups the fields into business sections, with Product information building the description', () => {
    openEditor();
    const headings = within(editor()).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Material identity', 'Product information', 'Units and weights', 'Shelf life and storage', 'Market and BOM setup']);
  });

  it('renders every visible field from the Finished Product Create configuration, with its configured label', () => {
    openEditor();
    for (const spec of (ITEM_DEFS.finishedGoodsCreate.groups.main ?? []).filter((entry) => entry.id !== 'materialDescription')) {
      const label = new RegExp(spec.label.replace(/[?/()]/g, '\\$&'));
      const present =
        within(editor()).queryAllByRole('textbox', { name: label }).length +
        within(editor()).queryAllByRole('combobox', { name: label }).length +
        within(editor()).queryAllByRole('group', { name: label }).length;
      expect(present, spec.id).toBeGreaterThan(0);
    }
  });

  it('shows the parent business justification read-only, from Intake', () => {
    openEditor();
    const block = screen.getByTestId('inherited-justification');
    expect(block).toHaveTextContent('New sample product.');
    expect(within(block).getByRole('link', { name: 'Edit in Intake' })).toBeInTheDocument();
    expect(within(block).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('marks required fields accessibly and leaves optional ones unmarked', () => {
    openEditor();
    expect(box(/Source Material Identifier/)).toBeRequired();
    expect(box(/Product Code/)).toBeRequired();
    expect(box(/Minimum Shelf Life/)).toBeRequired();
    expect(box(/Net Weight/)).not.toBeRequired();
    expect(box(/Gross Weight/)).not.toBeRequired();
    expect(within(editor()).getByRole('combobox', { name: /Weight Unit/ })).not.toBeRequired();
  });
});

describe('progressive validation', () => {
  it('shows no errors on untouched fields, although the domain holds every issue', () => {
    const { id } = openEditor();
    expect(create(id).issues.length).toBeGreaterThan(0);
    expect(within(editor()).queryAllByRole('textbox').filter((input) => input.getAttribute('aria-invalid') === 'true')).toHaveLength(0);
    expect(within(editor()).queryByText(/is required/)).not.toBeInTheDocument();
    expect(within(editor()).queryAllByText(/^(Not started|In progress|Complete|Needs attention)$/)).toHaveLength(0); // no section states yet
  });

  it('shows a required-field error once the user leaves the field empty, associated with the field', async () => {
    const { user } = openEditor();
    await user.click(box(/Source Material Identifier/));
    await user.tab();
    expect(box(/Source Material Identifier/)).toHaveAttribute('aria-invalid', 'true');
    expect(box(/Source Material Identifier/)).toHaveAccessibleDescription(/Source Material Identifier is required\./);
    expect(box(/Product Code/)).not.toHaveAttribute('aria-invalid', 'true'); // still untouched
  });

  it('waits until the user leaves a typed field before calling it invalid', async () => {
    const { user } = openEditor();
    await user.type(box(/Product Code/), 'A1');
    expect(box(/Product Code/)).not.toHaveAttribute('aria-invalid', 'true');
    await user.tab();
    expect(box(/Product Code/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('distinguishes a warning from an error', () => {
    const spec = (ITEM_DEFS.finishedGoodsCreate.groups.main ?? [])[0];
    const issue = (severity: 'error' | 'warning'): ValidationIssue => ({
      id: 'x',
      ruleId: 'x',
      severity,
      category: 'missing',
      message: 'Check this value.',
      blocking: severity === 'error',
      source: spec.source,
    });
    const view = (severity: 'error' | 'warning') =>
      render(
        <AppProviders>
          <FieldControl spec={spec} presentation={{ width: 'half' }} value={undefined} issue={issue(severity)} onChange={() => {}} onBlur={() => {}} />
        </AppProviders>,
      );
    const warning = view('warning');
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(/Warning: Check this value\./);
    warning.unmount();
    view('error');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox')).not.toHaveAccessibleDescription(/Warning/);
  });

  it('raises no warnings on Finished Product Create, because no evidence-backed Finished Product Create rule is a warning', async () => {
    const { id, user } = openEditor();
    await fillValid(user);
    expect(create(id).issues.filter((issue) => !issue.blocking)).toHaveLength(0);
    expect(screen.queryByText(/Warning:/)).not.toBeInTheDocument();
  });
});

describe('Product Code', () => {
  it('accepts a generic product code', async () => {
    const { id, user } = openEditor();
    await user.type(box(/Product Code/), 'SKU-ABC-01');
    await user.tab();
    expect(box(/Product Code/)).not.toHaveAttribute('aria-invalid', 'true');
    expect(fields(id).itemCode?.value).toBe('SKU-ABC-01');
    expect(create(id).issues.some((issue) => issue.fieldId === 'itemCode')).toBe(false);
  });

  it.each(['A1', 'invalid code', 'X'.repeat(25)])('shows an error for %s once entered', async (value) => {
    const { user } = openEditor();
    await user.type(box(/Product Code/), value);
    await user.tab();
    expect(box(/Product Code/)).toHaveAttribute('aria-invalid', 'true');
    expect(box(/Product Code/)).toHaveAccessibleDescription(/3- to 24-character product code/);
  });
});

describe('controlled and reference values', () => {
  it('offers exactly the documented orderable units from the reference data', async () => {
    const { user } = openEditor();
    await user.click(within(editor()).getByRole('combobox', { name: /Orderable Unit/ }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(REFERENCE_DATA.orderableUoms.map((choice) => choice.label));
  });

  it('offers the documented temperature conditions and target markets as radios', () => {
    openEditor();
    const temperature = within(editor()).getByRole('group', { name: /Temperature Condition/ });
    expect(within(temperature).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(
      REFERENCE_DATA.temperatureConditions.map((choice) => choice.id),
    );
    expect(temperature).toHaveTextContent('Typical room conditions.');
    const market = within(editor()).getByRole('group', { name: /Target Market/ });
    expect(within(market).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['Region A', 'Region B', 'Region C']);
  });

  it('suggests representative weight units but accepts any unit, because no list is documented', async () => {
    const { id, user } = openEditor();
    const unit = within(editor()).getByRole('combobox', { name: /Weight Unit/ });
    await user.click(unit);
    const options = within(await screen.findByRole('listbox')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(REFERENCE_DATA.weightUnits.map((choice) => choice.label));
    await user.click(screen.getByRole('option', { name: 'KG - Kilogram' }));
    expect(fields(id).weightUnit?.value).toBe('KG');
    await user.clear(unit);
    await user.type(unit, 'OZ');
    await user.tab();
    expect(fields(id).weightUnit?.value).toBe('OZ');
    expect(create(id).issues.some((issue) => issue.fieldId === 'weightUnit')).toBe(false);
  });

  it('stores the chosen value through the store with user provenance', async () => {
    const { id, user } = openEditor();
    await chooseUnit(user, 'PK - Pack');
    expect(fields(id).orderableBaseUom).toEqual({ value: 'PK', provenance: 'user' });
  });
});

describe('shelf life', () => {
  it('accepts whole days and flags anything else, without comparing the two values', async () => {
    const { id, user } = openEditor();
    await user.type(box(/Minimum Shelf Life/), '90.5');
    await user.tab();
    expect(box(/Minimum Shelf Life/)).toHaveAccessibleDescription(/whole number of days/);
    await user.clear(box(/Minimum Shelf Life/));
    await user.type(box(/Minimum Shelf Life/), '400');
    await user.type(box(/Total Shelf Life/), '90'); // minimum above total: not a rule (unsupported hypothesis)
    await user.tab();
    expect(box(/Minimum Shelf Life/)).not.toHaveAttribute('aria-invalid', 'true');
    expect(box(/Total Shelf Life/)).not.toHaveAttribute('aria-invalid', 'true');
    expect(create(id).issues.some((issue) => /shelf/i.test(issue.fieldId ?? ''))).toBe(false);
    expect(within(editor()).getAllByText('days')).toHaveLength(2);
  });
});

describe('Shipping Category', () => {
  it('is not a Create Product field: it belongs to the extension workflow', () => {
    openEditor();
    expect(within(editor()).queryByRole('textbox', { name: /Ship Mtl/ })).not.toBeInTheDocument();
    expect((ITEM_DEFS.extend.groups.row ?? []).some((spec) => spec.id === 'shippingCategory')).toBe(true);
  });

  it('shows generic setup guidance when an alternate orderable unit is chosen', async () => {
    const { user } = openEditor();
    expect(screen.queryByTestId('field-orderableBaseUom-note')).not.toBeInTheDocument();
    await chooseUnit(user, 'PAL - Pallet');
    expect(screen.getByTestId('field-orderableBaseUom-note')).toHaveTextContent('additional setup');
    await chooseUnit(user, 'CS - Case');
    expect(screen.queryByTestId('field-orderableBaseUom-note')).not.toBeInTheDocument();
  });
});

describe('Product Bill of Materials setup and the reference guide link', () => {
  it('sets BOM setup from the Build Product BOM item and shows the link only when setup is needed', async () => {
    const { id, user } = openEditor();
    const setup = within(editor()).getByRole('group', { name: /Product Bill of Materials Setup Needed/ });
    expect(within(setup).getByRole('radio', { name: 'Yes' })).toBeChecked();
    expect(screen.getByTestId('field-finishedGoodsBomSetupNeeded-provenance')).toHaveTextContent('Generated because Build Product BOM is included in this request.');
    expect(screen.queryByText(/Product Bill of Materials item present/)).not.toBeInTheDocument();
    expect(box(/reference document link/i)).toBeInTheDocument();

    await user.click(within(setup).getByRole('radio', { name: 'No' }));
    expect(fields(id).finishedGoodsBomSetupNeeded).toEqual({ value: 'N', provenance: 'user' });
    expect(within(editor()).queryByRole('textbox', { name: /reference document link/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-finishedGoodsBomSetupNeeded-provenance')).not.toBeInTheDocument();

    await user.click(within(setup).getByRole('radio', { name: 'Yes' }));
    expect(box(/reference document link/i)).toBeInTheDocument();
  });
});

describe('status and completeness', () => {
  it('moves from Not started to In progress, with the card, workspace and readiness in step', async () => {
    const { user } = openEditor();
    expect(card('Create Finished Product')).toHaveTextContent('Not started');
    await user.type(box(/Source Material Identifier/), '900123');
    expect(card('Create Finished Product')).toHaveTextContent('In progress');
    expect(workspaceStatus()).toHaveTextContent('In progress');
    expect(screen.getByTestId('review-readiness')).toHaveTextContent('Items still need attention before this request can be submitted.');
    expect(within(editor()).getAllByText('In progress').length).toBeGreaterThan(0); // section state
  });

  it('marks the item Needs attention for genuinely invalid entered data', async () => {
    const { id, user } = openEditor();
    await user.type(box(/Product Code/), 'A1');
    await user.tab();
    expect(create(id).completeness).toBe('hasIssues');
    expect(card('Create Finished Product')).toHaveTextContent('Needs attention');
    expect(workspaceStatus()).toHaveTextContent('Needs attention');
    expect(screen.getByTestId('item-progress')).toHaveTextContent('1 needs attention');
  });

  it('reaches Complete with valid representative data, from the domain’s own completeness', async () => {
    const { id, user } = openEditor();
    await fillValid(user);
    expect(create(id).completeness).toBe('complete');
    expect(card('Create Finished Product')).toHaveTextContent('Complete');
    expect(workspaceStatus()).toHaveTextContent('Complete');
    expect(screen.getByTestId('item-progress')).toHaveTextContent('1 of 3 Request Items ready');
    expect(within(editor()).getAllByText('Complete')).toHaveLength(4); // every evidence-backed section
    expect(screen.getByText('No issues found')).toBeInTheDocument();
  });

  it('keeps values after moving to another Request Item and back', async () => {
    const { user } = openEditor();
    await user.type(box(/Source Material Identifier/), '900123');
    await user.click(card('Set Up Plant Availability'));
    expect(screen.queryByTestId('fert-create-editor')).not.toBeInTheDocument();
    await user.click(card('Create Finished Product'));
    expect(box(/Source Material Identifier/)).toHaveValue('900123');
  });

  it('persists values after a reload and shows saved invalid values as errors straight away', async () => {
    const id = goldenDraft();
    const first = openEditor(id);
    await first.user.type(box(/Source Material Identifier/), '900123');
    await first.user.type(box(/Product Code/), 'A1');
    await first.user.click(screen.getByRole('button', { name: 'Save Draft' }));

    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    act(() => useAppStore.setState({ requests: {} }));
    localStorage.setItem(STORAGE_KEY, saved);
    await act(async () => useAppStore.persist.rehydrate());
    expect(create(id).completeness).toBe('hasIssues');

    document.body.innerHTML = '';
    renderApp(`/requests/${id}/setup`);
    expect(box(/Source Material Identifier/)).toHaveValue('900123');
    expect(box(/Product Code/)).toHaveAttribute('aria-invalid', 'true');
    expect(box(/Minimum Shelf Life/)).not.toHaveAttribute('aria-invalid', 'true');
    expect(card('Create Finished Product')).toHaveTextContent('Needs attention');
  });

  it('starts afresh when Finished Product Create is removed and added back', async () => {
    const { id, user } = openEditor();
    await user.type(box(/Source Material Identifier/), '900123');
    await user.click(screen.getByRole('button', { name: 'Remove Finished Product Create' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('along with the information entered in it');
    await user.click(within(dialog).getByRole('button', { name: 'Remove Create Finished Product' }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    await user.click(screen.getByRole('button', { name: 'Add New Request Item' }));
    await user.click(await screen.findByRole('menuitem', { name: /Create Finished Product/ }));
    expect(await screen.findByTestId('fert-create-editor')).toBeInTheDocument();
    expect(box(/Source Material Identifier/)).toHaveValue('');
    expect(create(id).completeness).toBe('notStarted');
  });
});

describe('provenance', () => {
  it('marks a value that came from the uploaded file, and drops the mark once the Requestor changes it', async () => {
    const user = userEvent.setup();
    renderApp('/requests/BR-2026-0151/setup');
    expect(screen.getByTestId('field-targetMarket-provenance')).toHaveTextContent('From product-specification-sample.xlsx.');
    await user.click(within(editor()).getByRole('radio', { name: 'Region B' }));
    expect(screen.queryByTestId('field-targetMarket-provenance')).not.toBeInTheDocument();
    expect(fields('BR-2026-0151').targetMarket).toEqual({ value: 'Region B', provenance: 'user' });
  });
});

describe('narrow screens', () => {
  it('uses the same editor inside the collapsed layout', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      openEditor();
      expect(screen.getByRole('button', { name: /Request Items · / })).toHaveAttribute('aria-expanded', 'false');
      expect(box(/Source Material Identifier/)).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});
