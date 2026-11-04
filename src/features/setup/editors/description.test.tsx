import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fv } from '../../../domain/requests';
import type { FertCreateItem } from '../../../domain/types';
import { STORAGE_KEY, useAppStore } from '../../../store/appStore';
import { renderApp } from '../../../test/utils';
import editorSource from './FertCreateEditor.tsx?raw';
import generatedSource from './GeneratedDescription.tsx?raw';
import valueSource from '../../../components/provenance/GeneratedValue.tsx?raw';

const PHRASE = 'Fictional demo reference data · static sample · not connected to a live system';
const req = (id: string) => useAppStore.getState().requests[id];
const fields = (id: string) => (req(id).items.find((item) => item.type === 'finishedGoodsCreate') as FertCreateItem).data.fields;

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

function open(id = goldenDraft()) {
  const user = userEvent.setup();
  renderApp(`/requests/${id}/setup`);
  return { id, user };
}

type User = ReturnType<typeof userEvent.setup>;
const editor = () => screen.getByTestId('fert-create-editor');
const generated = () => screen.getByTestId('field-materialDescription');
const output = () => within(generated()).getByRole('status', { hidden: true });
const card = () => within(screen.getByRole('navigation', { name: 'Request Items' })).getByRole('button', { name: /^Create Finished Product/ });

async function choose(user: User, field: RegExp, option: string) {
  await user.click(within(editor()).getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
}

async function describe6(user: User, values: [string, string, string, string, string, string]) {
  const [brand, variant, model, size, container, pack] = values;
  await choose(user, /^Brand/, brand);
  await choose(user, /^Variant/, variant);
  await choose(user, /^Model/, model);
  await choose(user, /^Package size/, size);
  await choose(user, /^Container type/, container);
  await choose(user, /^Pack configuration/, pack);
}

const SAMPLE_DESCRIPTION: [string, string, string, string, string, string] = ['Brand Alpha', 'Standard', 'Model A', 'Size B', 'Box', '12-pack'];

describe('generated Material Description', () => {
  it('starts in a neutral pending state, not as an empty invalid field', () => {
    open();
    expect(within(generated()).getByText('Material Description')).toBeInTheDocument();
    expect(output()).toHaveTextContent('Complete the product information below to generate the description.');
    expect(within(editor()).queryByRole('textbox', { name: /Material Description/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-materialDescription-error')).not.toBeInTheDocument();
    expect(within(generated()).queryByText(/characters/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Material Description is required/)).not.toBeInTheDocument();
  });

  it('shows the description builder concept note, restrained and not as an error', () => {
    open();
    const note = screen.getByTestId('field-materialDescription-concept');
    expect(note).toHaveTextContent('Description builder concept · format requires business validation');
    expect(note.closest('[role="alert"]')).toBeNull();
  });

  it('previews what remains as attributes are chosen', async () => {
    const { user } = open();
    await choose(user, /^Brand/, 'Brand Alpha');
    expect(screen.getByTestId('field-materialDescription-preview')).toHaveTextContent(
      'ALPH [Model] [Package size] [Container type] [Pack configuration]',
    );
    await choose(user, /^Model/, 'Model A');
    expect(screen.getByTestId('field-materialDescription-preview')).toHaveTextContent('ALPH MODEL-A [Package size]');
  });

  it('generates live from the structured attributes, with its count and generated source', async () => {
    const { id, user } = open();
    await describe6(user, SAMPLE_DESCRIPTION);
    expect(output()).toHaveTextContent('ALPH STD MODEL-A SIZE-B BOX 12PK');
    expect(within(generated()).getByText('32 / 80 characters')).toBeInTheDocument();
    expect(screen.getByTestId('field-materialDescription-provenance')).toHaveTextContent('Generated from the structured product information below.');
    expect(screen.getByTestId('field-materialDescription-provenance')).toHaveAttribute('data-source', 'generated');
    expect(fields(id).materialDescription).toMatchObject({ value: 'ALPH STD MODEL-A SIZE-B BOX 12PK', provenance: 'derived' });

    await choose(user, /^Model/, 'Model B');
    expect(output()).toHaveTextContent('ALPH STD MODEL-B SIZE-B BOX 12PK');
    expect(within(generated()).getByText('32 / 80 characters')).toBeInTheDocument();
  });

  it('is read-only: there is nothing to type into and no override', async () => {
    const { user } = open();
    await describe6(user, SAMPLE_DESCRIPTION);
    expect(output().tagName).toBe('OUTPUT');
    expect(within(generated()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(generated()).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit description|override/i })).not.toBeInTheDocument();
  });

  it('shows the full generated result without truncation', async () => {
    const { id, user } = open();
    await describe6(user, ['Brand Beta', 'Standard', 'Model J', 'Size C', 'Bag', '24-pack']);
    expect(output()).toHaveTextContent('BETA STD MODEL-J SIZE-C BAG 24PK');
    expect(within(generated()).getByText('32 / 80 characters')).toBeInTheDocument();
    expect(screen.queryByTestId('field-materialDescription-error')).not.toBeInTheDocument();
    expect(String(fields(id).materialDescription?.value)).toHaveLength(32);
    expect(card()).toHaveTextContent('In progress');
  });

  it('leaves Request Name and the Source Material Identifier unchanged', async () => {
    const { id, user } = open();
    await user.type(within(editor()).getByRole('textbox', { name: /Source Material Identifier/ }), '900123');
    await describe6(user, SAMPLE_DESCRIPTION);
    expect(req(id).name).toBe('Product Launch Alpha');
    expect(screen.getByRole('heading', { level: 1, name: 'Product Launch Alpha' })).toBeInTheDocument();
    expect(fields(id).externalMaterialId).toEqual({ value: '900123', provenance: 'user' });
  });

  it('keeps the attribute choices and the generated value across navigation and a reload', async () => {
    const { id, user } = open();
    await describe6(user, SAMPLE_DESCRIPTION);
    await user.click(within(screen.getByRole('navigation', { name: 'Request Items' })).getByRole('button', { name: /^Set Up Plant Availability/ }));
    await user.click(card());
    expect(output()).toHaveTextContent('ALPH STD MODEL-A SIZE-B BOX 12PK');

    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    act(() => useAppStore.setState({ requests: {} }));
    localStorage.setItem(STORAGE_KEY, saved);
    await act(async () => useAppStore.persist.rehydrate());
    document.body.innerHTML = '';
    renderApp(`/requests/${id}/setup`);
    expect(output()).toHaveTextContent('ALPH STD MODEL-A SIZE-B BOX 12PK');
    expect(within(editor()).getByRole('combobox', { name: /^Model/ })).toHaveTextContent('Model A');
  });

  it('places the attributes in a Product information section and keeps the item in progress, not invalid', async () => {
    const { user } = open();
    const section = screen.getByRole('region', { name: 'Product information' });
    expect(within(section).getAllByRole('combobox')).toHaveLength(6);
    expect(within(section).getByText('Optional.')).toBeInTheDocument(); // Variant
    await choose(user, /^Brand/, 'Brand Alpha');
    expect(card()).toHaveTextContent('In progress');
  });

  it('keeps concatenation out of React: components display the domain result only', () => {
    for (const source of [editorSource, generatedSource, valueSource]) {
      expect(source).not.toMatch(/\.join\(/);
      expect(source).not.toMatch(/segments\.map\([^)]*\)\s*\.join/);
    }
    expect(generatedSource).toMatch(/composeDescription\(/);
  });
});

describe('provenance treatment', () => {
  it('puts no provenance mark on ordinary Requestor fields', () => {
    open();
    const number = within(editor()).getByRole('textbox', { name: /Source Material Identifier/ });
    const container = number.closest('.MuiFormControl-root') as HTMLElement;
    expect(container.querySelector('[data-source]')).toBeNull();
    expect(within(editor()).getByRole('textbox', { name: /Product Code/ }).closest('.MuiFormControl-root')?.querySelector('[data-source]')).toBeNull();
  });

  it('marks reference-backed fields with the reference indicator and its accessible explanation', () => {
    open();
    const unit = within(editor()).getByRole('combobox', { name: /Orderable Unit/ });
    expect(unit.closest('.MuiFormControl-root')?.querySelector('[data-source="reference"]')).not.toBeNull();
    const temperature = within(editor()).getByRole('group', { name: /Temperature Condition/ });
    expect(within(temperature).getByRole('radiogroup')).toHaveAccessibleDescription(new RegExp(PHRASE));
  });

  it('states the reference phrase once visibly, at form level', () => {
    open();
    expect(screen.getByTestId('reference-data-note')).toHaveTextContent(/fictional demo reference data · static sample · not connected to a live system/i);
    expect(screen.getByTestId('reference-data-note')).toHaveAttribute('data-source', 'reference');
  });

  it('uses business wording for generated values, never the raw derivation label', () => {
    open();
    expect(screen.getByTestId('field-finishedGoodsBomSetupNeeded-provenance')).toHaveTextContent('Generated because Build Product BOM is included in this request.');
    expect(screen.getByTestId('field-finishedGoodsBomSetupNeeded-provenance')).toHaveAttribute('data-source', 'generated');
    expect(document.body).not.toHaveTextContent('Product Bill of Materials item present');
    expect(document.body).not.toHaveTextContent('fert-description-concept');
  });

  it('does not show System destinations while authoring', () => {
    open();
    expect(document.body).not.toHaveTextContent(/MAKT\.MAKTX|MARA\.|MEAN\.|External write|Information for execution process/);
  });
});
