import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fv } from '../../../domain/requests';
import { getRequestStatus } from '../../../domain/status';
import type { FertBomItem, FertCreateItem, ItemType } from '../../../domain/types';
import { STORAGE_KEY, useAppStore } from '../../../store/appStore';
import { renderApp } from '../../../test/utils';

const pathname = () => screen.getByTestId('pathname').textContent ?? '';
const req = (id: string) => useAppStore.getState().requests[id];
const itemId = (id: string, type: ItemType) => req(id).items.find((item) => item.type === type)!.id;
const bom = (id: string) => req(id).items.find((item) => item.type === 'finishedGoodsBom') as FertBomItem;
const chosen = (id: string) => bom(id).data.components.map((component) => component.fields.componentNumber?.value).filter(Boolean);

/** A golden-path draft made through the store, as Intake makes it. */
function goldenDraft() {
  const store = useAppStore.getState();
  const id = store.createRequest('Product Launch Alpha');
  store.updateRequestDetails(id, {
    businessNeed: 'newProduct',
    materialScenario: 'noNewMaterials',
    context: { businessJustification: fv('New sample product.') },
  });
  store.completeIntake(id);
  store.generateInitialItems(id);
  return id;
}

/** Create Finished Product complete, so the only thing left blocking submission is the Product BOM. */
function draftReadyExceptBom() {
  const id = goldenDraft();
  const create = req(id).items.find((item) => item.type === 'finishedGoodsCreate') as FertCreateItem;
  act(() => {
    useAppStore.getState().updateItem(id, create.id, {
      fields: {
        ...create.data.fields,
        externalMaterialId: fv('900001'),
        materialDescription: fv('TEST MODEL-B SIZE-B BOX 12PK'),
        itemCode: fv('10000000000017'),
        orderableBaseUom: fv('CS'),
        minShelfLife: fv('90'),
        totalShelfLife: fv('180'),
        temperatureCondition: fv('ambient'),
        targetMarket: fv('Region A'),
      },
    });
  });
  return id;
}

function openBom(id = draftReadyExceptBom()) {
  const user = userEvent.setup();
  renderApp(`/requests/${id}/setup/${itemId(id, 'finishedGoodsBom')}`);
  return { id, user };
}

const materialBoxes = () => screen.getAllByRole('combobox', { name: /^Material/ });
const quantityBoxes = () => screen.getAllByRole('textbox', { name: /^Quantity/ });
const unitBoxes = () => screen.getAllByRole('combobox', { name: /^Unit/ });

async function chooseMaterial(user: ReturnType<typeof userEvent.setup>, index: number, search: string, option: RegExp) {
  await user.click(materialBoxes()[index]);
  // Changing a material starts from an empty search, as a person would clear the field first.
  if ((materialBoxes()[index] as HTMLInputElement).value) await user.clear(materialBoxes()[index]);
  await user.type(materialBoxes()[index], search);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Build Product BOM editor', () => {
  it('replaces the placeholder with the component editor, named and labelled for the task', () => {
    openBom();
    const workspace = screen.getByRole('region', { name: 'Build Product BOM' });
    expect(within(workspace).getByTestId('bom-editor')).toBeInTheDocument();
    expect(workspace).not.toHaveTextContent('outside the current POC review scope');
    expect(within(workspace).getByRole('heading', { name: 'Component 1' })).toBeInTheDocument();
    expect(materialBoxes()).toHaveLength(1);
    expect(quantityBoxes()).toHaveLength(1);
    expect(unitBoxes()).toHaveLength(1);
    expect(within(workspace).getByRole('button', { name: 'Add component' })).toBeInTheDocument();
  });

  it('shows the derived product read-only, from Create Finished Product', () => {
    openBom();
    const product = screen.getByTestId('bom-product');
    expect(product).toHaveTextContent('900001');
    expect(product).toHaveTextContent('TEST MODEL-B SIZE-B BOX 12PK');
    expect(product).toHaveTextContent('Finished goods');
    expect(product).toHaveTextContent('From Create Finished Product.');
    expect(within(product).queryAllByRole('textbox')).toHaveLength(0);
  });

  it('points back to Create Finished Product when the product is not known yet', async () => {
    const id = goldenDraft();
    const { user } = openBom(id);
    expect(screen.getByTestId('bom-product')).toHaveTextContent('The finished product appears here once Create Finished Product');
    await user.click(screen.getByRole('link', { name: 'Go to Create Finished Product' }));
    expect(pathname()).toBe(`/requests/${id}/setup/${itemId(id, 'finishedGoodsCreate')}`);
  });

  it('finds an existing material by description and chooses it, filling in what the reference data knows', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    const [component] = bom(id).data.components;
    expect(component.fields.componentNumber?.value).toBe('MAT-001');
    expect(component.fields.componentDescription?.value).toBe('COMPONENT A');
    expect(component.fields.componentBaseUom).toMatchObject({ value: 'KG', provenance: 'reference' });
    expect(materialBoxes()[0]).toHaveValue('MAT-001 · COMPONENT A');
    expect(screen.getByText(/Intermediate goods · Group GRP-01/)).toBeInTheDocument();
    expect(unitBoxes()[0]).toHaveTextContent('KG - Kilogram');
  });

  it('finds a material by number as well', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'MAT-102', /MAT-102/);
    expect(chosen(id)).toEqual(['MAT-102']);
  });

  it('offers only existing materials, and says so when nothing matches', async () => {
    const { id, user } = openBom();
    await user.click(materialBoxes()[0]);
    await user.type(materialBoxes()[0], 'a brand new material');
    expect(await screen.findByText('No existing material matches. Only existing materials can be added.')).toBeInTheDocument();
    expect(chosen(id)).toEqual([]);
  });

  it('keeps the Unit disabled until a material is chosen', async () => {
    const { user } = openBom();
    expect(unitBoxes()[0]).toHaveAttribute('aria-disabled', 'true');
    await chooseMaterial(user, 0, 'INPUT A', /MAT-201/);
    expect(unitBoxes()[0]).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('saves the quantity to the draft as it is typed', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.type(quantityBoxes()[0], '18200');
    expect(bom(id).data.components[0].fields.componentQty?.value).toBe('18200');
  });

  it('shows a blocking, accessible error for an invalid quantity once the field is left', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.type(quantityBoxes()[0], '0');
    expect(screen.queryByText(/greater than zero/)).not.toBeInTheDocument();
    await user.tab();
    const message = screen.getByText(/Enter a quantity greater than zero/);
    expect(quantityBoxes()[0]).toBeInvalid();
    expect(quantityBoxes()[0]).toHaveAccessibleDescription(message.textContent ?? '');
    expect(bom(id).issues.some((issue) => issue.blocking && issue.fieldId === 'componentQty')).toBe(true);
    expect(within(screen.getByRole('region', { name: 'Build Product BOM' })).getByText('Needs attention')).toBeInTheDocument();
  });

  it('asks for a quantity after a material is chosen, once the quantity field is visited', async () => {
    const { user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.click(quantityBoxes()[0]);
    await user.tab();
    expect(screen.getByText('Enter a quantity for this component.')).toBeInTheDocument();
  });

  it('lets the Requestor change the unit, and keeps that unit when the material changes', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.click(unitBoxes()[0]);
    await user.click(await screen.findByRole('option', { name: 'LB - US Pound' }));
    expect(bom(id).data.components[0].fields.componentBaseUom).toMatchObject({ value: 'LB', provenance: 'user' });
    await chooseMaterial(user, 0, 'PACKAGE A', /MAT-101/);
    expect(chosen(id)).toEqual(['MAT-101']);
    expect(bom(id).data.components[0].fields.componentBaseUom?.value).toBe('LB');
  });

  it('adds another component, focuses it, and does not offer a material twice', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.click(screen.getByRole('button', { name: 'Add component' }));
    expect(bom(id).data.components).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Component 2' })).toBeInTheDocument();
    expect(document.activeElement).toBe(materialBoxes()[1]);
    await user.type(materialBoxes()[1], 'COMPONENT A');
    expect(await screen.findByRole('option', { name: /MAT-001/ })).toHaveAttribute('aria-disabled', 'true');
    await user.clear(materialBoxes()[1]);
    await user.type(materialBoxes()[1], 'PACKAGE A');
    await user.click(await screen.findByRole('option', { name: /MAT-101/ }));
    expect(chosen(id)).toEqual(['MAT-001', 'MAT-101']);
  });

  it('changes a chosen material without disturbing the other components or the quantity', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.type(quantityBoxes()[0], '250');
    await user.click(screen.getByRole('button', { name: 'Add component' }));
    await chooseMaterial(user, 1, 'PACKAGE A', /MAT-101/);
    await chooseMaterial(user, 0, 'COMPONENT B', /MAT-002/);
    expect(chosen(id)).toEqual(['MAT-002', 'MAT-101']);
    expect(bom(id).data.components[0].fields.componentQty?.value).toBe('250');
  });

  it('removes a component, names it for assistive technology, and announces the change', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.click(screen.getByRole('button', { name: 'Add component' }));
    await chooseMaterial(user, 1, 'PACKAGE A', /MAT-101/);
    await user.click(screen.getByRole('button', { name: 'Remove component 1, MAT-001 · COMPONENT A' }));
    expect(chosen(id)).toEqual(['MAT-101']);
    expect(bom(id).data.components).toHaveLength(1);
    expect(screen.getAllByRole('status').some((node) => node.textContent === 'Component removed.')).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add component' }));
  });

  it('starts over with one blank component when the last one is removed', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.click(screen.getByRole('button', { name: /^Remove component 1/ }));
    expect(bom(id).data.components).toHaveLength(1);
    expect(chosen(id)).toEqual([]);
    expect(materialBoxes()).toHaveLength(1);
  });

  it('keeps the Product BOM blocked until a material with a quantity is chosen, then unblocks it', async () => {
    const { id, user } = openBom();
    expect(req(id).validation.submittable).toBe(false);
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    expect(req(id).validation.submittable).toBe(false);
    await user.type(quantityBoxes()[0], '18200');
    expect(req(id).validation.blockingCount).toBe(0);
    expect(req(id).validation.submittable).toBe(true);
  });

  it('does not touch the derived header values or any other Request Item', async () => {
    const { id, user } = openBom();
    const headerBefore = bom(id).data.header;
    const createBefore = req(id).items.find((item) => item.type === 'finishedGoodsCreate');
    const extendBefore = req(id).items.find((item) => item.type === 'extend');
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.type(quantityBoxes()[0], '5');
    expect(bom(id).data.header).toEqual(headerBefore);
    expect(req(id).items.find((item) => item.type === 'finishedGoodsCreate')).toEqual(createBefore);
    expect(req(id).items.find((item) => item.type === 'extend')).toEqual(extendBefore);
  });

  it('keeps the components after a reload', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.type(quantityBoxes()[0], '18200');
    const saved = localStorage.getItem(STORAGE_KEY) ?? '';
    act(() => useAppStore.setState({ requests: {} }));
    localStorage.setItem(STORAGE_KEY, saved);
    await act(async () => useAppStore.persist.rehydrate());
    expect(chosen(id)).toEqual(['MAT-001']);
    expect(bom(id).data.components[0].fields.componentQty?.value).toBe('18200');
  });

  it('shows what was saved when the editor is opened again', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.type(quantityBoxes()[0], '18200');
    await user.click(screen.getByRole('button', { name: /^Create Finished Product/ }));
    expect(pathname()).toBe(`/requests/${id}/setup/${itemId(id, 'finishedGoodsCreate')}`);
    await user.click(screen.getByRole('button', { name: /^Build Product BOM/ }));
    expect(materialBoxes()[0]).toHaveValue('MAT-001 · COMPONENT A');
    expect(quantityBoxes()[0]).toHaveValue('18200');
  });
});

describe('from the BOM editor through Review to a submitted request', () => {
  it('reviews the chosen components accurately and submits the valid request', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.type(quantityBoxes()[0], '18200');
    await user.click(screen.getByRole('button', { name: 'Add component' }));
    await chooseMaterial(user, 1, 'PACKAGE A', /MAT-101/);
    await user.type(quantityBoxes()[1], '120000');

    await user.click(screen.getByRole('link', { name: 'Continue to Review & Submit' }));
    expect(pathname()).toBe(`/requests/${id}/review`);
    expect(await screen.findByRole('heading', { name: 'Ready to submit' })).toBeInTheDocument();

    // On a wide screen the items start expanded, so the components are already visible.
    const section = screen.getByRole('region', { name: 'Build Product BOM' });
    const first = within(section).getByRole('heading', { name: 'Component 1' }).parentElement!;
    expect(first).toHaveTextContent('MAT-001 · COMPONENT A');
    expect(first).toHaveTextContent('18200 KG');
    expect(first).toHaveTextContent('Intermediate goods');
    const second = within(section).getByRole('heading', { name: 'Component 2' }).parentElement!;
    expect(second).toHaveTextContent('MAT-101 · PACKAGE A');
    expect(second).toHaveTextContent('120000 EA');
    expect(section).toHaveTextContent('Finished product');
    expect(section).not.toHaveTextContent(/Matl|U of M|Component Qty/);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Request submitted' })).toBeInTheDocument();
    expect(getRequestStatus(req(id))).toBe('readyForExecution');
    expect(chosen(id)).toEqual(['MAT-001', 'MAT-101']);
    // The submitted record keeps the components exactly as they were chosen.
    const submitted = req(id).submissions[0].items.find((item) => item.type === 'finishedGoodsBom') as FertBomItem;
    expect(submitted.data.components.map((component) => component.fields.componentQty?.value)).toEqual(['18200', '120000']);
  });

  it('blocks Review until a component is chosen, and leads back to the editor', async () => {
    const id = draftReadyExceptBom();
    const user = userEvent.setup();
    renderApp(`/requests/${id}/review`);
    const summary = await screen.findByTestId('validation-summary');
    expect(within(summary).getByRole('heading', { name: 'Unable to submit' })).toBeInTheDocument();
    expect(summary).toHaveTextContent('Add at least one component material.');
    await user.click(within(summary).getByRole('link', { name: 'Edit Build Product BOM' }));
    expect(pathname()).toBe(`/requests/${id}/setup/${itemId(id, 'finishedGoodsBom')}`);
    expect(screen.getByTestId('bom-editor')).toBeInTheDocument();
  });

  it('does not submit while a component has no quantity', async () => {
    const { id, user } = openBom();
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.click(screen.getByRole('link', { name: 'Continue to Review & Submit' }));
    expect(await screen.findByRole('heading', { name: 'Unable to submit' })).toBeInTheDocument();
    expect(screen.getByTestId('validation-summary')).toHaveTextContent('Enter a quantity for this component.');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(req(id).submittedAt).toBeUndefined();
  });
});

describe('Request Setup and Review agree about readiness', () => {
  const nav = () => screen.getByRole('navigation', { name: 'Request Items' });
  const cardOf = (name: RegExp) => within(nav()).getByRole('button', { name });
  const setupReadiness = () => screen.getByTestId('review-readiness');

  async function fillValidComponent(user: ReturnType<typeof userEvent.setup>) {
    await chooseMaterial(user, 0, 'COMPONENT A', /MAT-001/);
    await user.type(quantityBoxes()[0], '18200');
  }

  it('starts blocked: Setup counts nothing ready and says what is outstanding', () => {
    openBom();
    expect(screen.getByTestId('item-progress')).not.toHaveTextContent('Ready to submit');
    expect(setupReadiness()).not.toHaveTextContent('Ready to submit');
    expect(setupReadiness()).not.toHaveTextContent('Nothing blocks submission');
  });

  it('happy path: a valid component makes Setup ready, the BOM Complete, and Plant Availability does not hold it back', async () => {
    const { id, user } = openBom();
    await fillValidComponent(user);

    expect(cardOf(/^Build Product BOM/)).toHaveTextContent('Complete');
    expect(cardOf(/^Set Up Plant Availability/)).toHaveTextContent('Not started');
    expect(screen.getByTestId('item-progress')).toHaveTextContent('Ready to submit');
    expect(setupReadiness()).toHaveTextContent('Ready to submit');
    expect(setupReadiness()).toHaveTextContent('Nothing blocks submission.');
    expect(setupReadiness()).not.toHaveTextContent(/need attention|to resolve/);
    // The legitimate non-blocking warnings are still shown on the item, and say they won't block.
    expect(screen.getByTestId('item-issues')).toHaveTextContent(/warnings? \(won’t block submission\)/);
    expect(req(id).validation.submittable).toBe(true);

    await user.click(screen.getByRole('link', { name: 'Continue to Review & Submit' }));
    expect(await screen.findByRole('heading', { name: 'Ready to submit' })).toBeInTheDocument();
    expect(screen.getByTestId('submit-readiness')).toHaveTextContent('Ready to submit');

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Request submitted' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'View in BOM Work' }));
    expect(await screen.findByRole('link', { name: 'Product Launch Alpha' })).toBeInTheDocument();
    expect(getRequestStatus(req(id))).toBe('readyForExecution');
  });

  it('shows the same readiness for the same request on BOM Work as on Setup and Review', async () => {
    const { user } = openBom();
    await fillValidComponent(user);
    await user.click(screen.getByRole('link', { name: 'Back to BOM Work' }));
    expect(await screen.findByText('Ready to review')).toBeInTheDocument();
  });

  it('invalid path: clearing a required quantity makes the BOM Needs attention, blocks Review and blocks Submit', async () => {
    const { id, user } = openBom();
    await fillValidComponent(user);
    expect(setupReadiness()).toHaveTextContent('Ready to submit');

    await user.clear(quantityBoxes()[0]);
    expect(cardOf(/^Build Product BOM/)).toHaveTextContent('Needs attention');
    expect(screen.getByTestId('item-progress')).toHaveTextContent('1 needs attention');
    expect(screen.getByTestId('item-progress')).not.toHaveTextContent('Ready to submit');
    expect(setupReadiness()).not.toHaveTextContent('Ready to submit');
    expect(setupReadiness()).toHaveTextContent(/need attention/);
    expect(req(id).validation.submittable).toBe(false);

    await user.click(screen.getByRole('link', { name: 'Continue to Review & Submit' }));
    const summary = await screen.findByTestId('validation-summary');
    expect(within(summary).getByRole('heading', { name: 'Unable to submit' })).toBeInTheDocument();
    expect(summary).toHaveTextContent('Build Product BOM');
    expect(summary).toHaveTextContent('Enter a quantity for this component.');

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(req(id).submittedAt).toBeUndefined();
    expect(getRequestStatus(req(id))).toBe('draft');
    expect(pathname()).toBe(`/requests/${id}/review`);
  });

  it('invalid path: clearing the material leaves a quantity with no material, which also needs attention and blocks', async () => {
    const { id, user } = openBom();
    await fillValidComponent(user);
    await user.clear(materialBoxes()[0]);
    expect(cardOf(/^Build Product BOM/)).toHaveTextContent('Needs attention');
    expect(setupReadiness()).not.toHaveTextContent('Ready to submit');
    expect(req(id).validation.submittable).toBe(false);
  });

  it('invalid path: removing the only component brings the blocker back, as Needs attention', async () => {
    const { id, user } = openBom();
    await fillValidComponent(user);
    await user.click(screen.getByRole('button', { name: /^Remove component 1/ }));
    expect(cardOf(/^Build Product BOM/)).toHaveTextContent('Needs attention');
    expect(screen.getByTestId('item-progress')).toHaveTextContent('1 needs attention');
    expect(setupReadiness()).not.toHaveTextContent('Ready to submit');

    await user.click(screen.getByRole('link', { name: 'Continue to Review & Submit' }));
    expect(await screen.findByTestId('validation-summary')).toHaveTextContent('Add at least one component material.');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(req(id).submittedAt).toBeUndefined();
  });

  it('recovers: fixing the invalid data makes Setup and Review ready again', async () => {
    const { user } = openBom();
    await fillValidComponent(user);
    await user.clear(quantityBoxes()[0]);
    expect(setupReadiness()).not.toHaveTextContent('Ready to submit');
    await user.type(quantityBoxes()[0], '250');
    expect(cardOf(/^Build Product BOM/)).toHaveTextContent('Complete');
    expect(setupReadiness()).toHaveTextContent('Ready to submit');
    await user.click(screen.getByRole('link', { name: 'Continue to Review & Submit' }));
    expect(await screen.findByRole('heading', { name: 'Ready to submit' })).toBeInTheDocument();
  });
});
