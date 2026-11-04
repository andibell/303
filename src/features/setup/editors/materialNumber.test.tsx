import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildSeedRequests } from '../../../data/seed';
import { SOURCE_MATERIAL_IDENTIFIER_FIELD, ITEM_DEFS } from '../../../domain/items/fieldSpecs';
import { completeItem, fv, startExecution, submitRequest } from '../../../domain/requests';
import type { FertCreateItem } from '../../../domain/types';
import { useAppStore } from '../../../store/appStore';
import { EXECUTOR, itemOf, must, validDraft } from '../../../test/fixtures';
import { renderApp } from '../../../test/utils';

const req = (id: string) => useAppStore.getState().requests[id];
const create = (id: string) => req(id).items.find((item) => item.type === 'finishedGoodsCreate') as FertCreateItem;

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

const editor = () => screen.getByTestId('fert-create-editor');

describe('Finished Product Create material identifiers', () => {
  it('asks the Requestor for the Source Material Identifier, not the final Execution Identifier', () => {
    renderApp(`/requests/${goldenDraft()}/setup`);
    const source = within(editor()).getByRole('textbox', { name: /Source Material Identifier/ });
    expect(source).toBeRequired();
    expect(source).toHaveAccessibleDescription(/External code used to identify the material before creation\./);
    expect(within(editor()).queryByRole('textbox', { name: /Execution Identifier/ })).not.toBeInTheDocument();
  });

  it('shows the final Execution Identifier read-only as an execution outcome, never as missing input', () => {
    renderApp(`/requests/${goldenDraft()}/setup`);
    const outcome = screen.getByTestId('execution-outcome');
    expect(outcome).toHaveTextContent('Execution Identifier');
    expect(outcome).toHaveTextContent('Assigned during execution process');
    expect(outcome).toHaveAttribute('data-source', 'execution');
    expect(within(outcome).queryByRole('textbox')).not.toBeInTheDocument();
    expect(outcome).not.toHaveTextContent(/required|missing/i);
    expect(outcome.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it('does not require an Execution Identifier for authoring completeness, and never fabricates one', async () => {
    const id = goldenDraft();
    const user = userEvent.setup();
    renderApp(`/requests/${id}/setup`);
    const choose = async (field: RegExp, option: string) => {
      await user.click(within(editor()).getByRole('combobox', { name: field }));
      await user.click(await screen.findByRole('option', { name: option }));
    };
    await user.type(within(editor()).getByRole('textbox', { name: /Source Material Identifier/ }), 'SRC-999');
    for (const [field, option] of [
      [/^Brand/, 'Brand Alpha'],
      [/^Model/, 'Model A'],
      [/^Package size/, 'Size B'],
      [/^Container type/, 'Box'],
      [/^Pack configuration/, '12-pack'],
      [/Orderable Unit/, 'CS - Case'],
    ] as const)
      await choose(field, option);
    await user.type(within(editor()).getByRole('textbox', { name: /Product Code/ }), '10049000123456');
    await user.type(within(editor()).getByRole('textbox', { name: /Minimum Shelf Life/ }), '90');
    await user.type(within(editor()).getByRole('textbox', { name: /Total Shelf Life/ }), '270');
    await user.click(within(editor()).getByRole('radio', { name: /Ambient/ }));
    await user.click(within(editor()).getByRole('radio', { name: 'Region A' }));

    expect(create(id).completeness).toBe('complete');
    expect(create(id).executionIdentifier).toBeUndefined();
    expect(screen.getByTestId('execution-outcome')).toHaveTextContent('Assigned during execution process');
    expect(create(id).data.fields.materialDescription?.value).toBe('ALPH MODEL-A SIZE-B BOX 12PK');
    expect(create(id).data.fields[SOURCE_MATERIAL_IDENTIFIER_FIELD]).toEqual({ value: 'SRC-999', provenance: 'user' });
    expect(req(id).name).toBe('Product Launch Alpha');
    expect(Object.keys(create(id).data.fields).some((key) => /executionIdentifier|finalSystem/i.test(key))).toBe(false);
  });

  it('shows a recorded Execution Identifier once execution has provided one', () => {
    const id = goldenDraft();
    act(() =>
      useAppStore.setState((state) => ({
        requests: { ...state.requests, [id]: { ...req(id), items: req(id).items.map((item) => (item.type === 'finishedGoodsCreate' ? { ...item, executionIdentifier: '4000123456' } : item)) } },
      })),
    );
    renderApp(`/requests/${id}/setup`);
    expect(screen.getByTestId('execution-outcome')).toHaveTextContent('4000123456');
    expect(screen.getByTestId('execution-outcome')).toHaveTextContent('Recorded by the Execution Specialist after execution process.');
  });
});

describe('downstream completion', () => {
  it('still records the resulting System identifier generically, interpreted for Finished Product Create as the Execution Identifier', () => {
    const { request, ctx } = validDraft();
    let r = must(submitRequest(request, ctx()));
    r = must(startExecution(r, ctx(EXECUTOR)));
    const created = itemOf(r, 'finishedGoodsCreate');
    const refused = completeItem(r, created.id, ctx(EXECUTOR));
    expect(refused.ok).toBe(false); // the identifier is still required to complete
    r = must(completeItem(r, created.id, ctx(EXECUTOR), { executionIdentifier: '4000999001' }));
    expect(itemOf(r, 'finishedGoodsCreate')).toMatchObject({ executionIdentifier: '4000999001', execution: 'completed' });
    expect(ITEM_DEFS.finishedGoodsCreate.executionIdentifierLabel).toBe('Execution Identifier');
    expect(ITEM_DEFS.extend.executionIdentifierLabel).toBeUndefined(); // other items keep the generic identifier
  });

  it('keeps seeded Source identifiers distinct from the Execution Identifiers recorded at execution', () => {
    for (const request of Object.values(buildSeedRequests())) {
      const item = request.items.find((entry) => entry.type === 'finishedGoodsCreate') as FertCreateItem | undefined;
      if (!item) continue;
      const source = item.data.fields[SOURCE_MATERIAL_IDENTIFIER_FIELD]?.value;
      if (!request.submittedAt) expect(item.executionIdentifier).toBeUndefined();
      if (item.executionIdentifier) expect(item.executionIdentifier).not.toBe(source);
    }
  });
});
