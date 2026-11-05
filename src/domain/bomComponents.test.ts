import { REFERENCE_DATA } from '../data/reference';
import { selectComponentMaterial } from './items/bom';
import { findMaterial } from './referenceTypes';
import { fv, previewSubmission, submitRequest, updateItem } from './requests';
import type { BomRequest, FertBomItem, FertCreateItem } from './types';
import { isReadyForReview } from './validation/engine';
import { itemOf, makeCtx, must, templateDraft } from '../test/fixtures';

const material = (number: string) => {
  const found = findMaterial(REFERENCE_DATA, number);
  if (!found) throw new Error(`no reference material ${number}`);
  return found;
};

const bomIssues = (request: BomRequest, ruleSuffix: string) =>
  itemOf<FertBomItem>(request, 'finishedGoodsBom').issues.filter((issue) => issue.ruleId.endsWith(ruleSuffix));

/** Replaces the BOM's components, as the editor does: the whole data goes through the domain's updateItem. */
function withComponents(request: BomRequest, ctx: ReturnType<typeof makeCtx>, build: (components: FertBomItem['data']['components']) => FertBomItem['data']['components']) {
  const bom = itemOf<FertBomItem>(request, 'finishedGoodsBom');
  return must(updateItem(request, bom.id, { header: bom.data.header, components: build(bom.data.components) }, ctx()));
}

describe('Product BOM components: what blocks submission', () => {
  it('blocks a Product BOM that has no component material, once its template exists', () => {
    const { request } = templateDraft();
    const [issue] = bomIssues(request, 'components.required');
    expect(issue).toMatchObject({ severity: 'error', blocking: true, category: 'consistency', message: 'Add at least one component material.' });
    expect(request.validation.submittable).toBe(false);
  });

  it('is satisfied by one existing material with a quantity', () => {
    const { request, ctx } = templateDraft();
    const next = withComponents(request, ctx, ([first]) => [{ ...selectComponentMaterial(first, material('MAT-001')), fields: { ...selectComponentMaterial(first, material('MAT-001')).fields, componentQty: fv('18200') } }]);
    const blocking = itemOf<FertBomItem>(next, 'finishedGoodsBom').issues.filter((issue) => issue.blocking);
    expect(blocking).toEqual([]);
  });

  it('asks for a quantity once a material is chosen', () => {
    const { request, ctx } = templateDraft();
    const next = withComponents(request, ctx, ([first]) => [selectComponentMaterial(first, material('MAT-101'))]);
    expect(bomIssues(next, 'components.required')).toHaveLength(0);
    const [issue] = bomIssues(next, 'componentQty.requiredWhenMaterialChosen');
    expect(issue).toMatchObject({ blocking: true, fieldId: 'componentQty', message: 'Enter a quantity for this component.' });
  });

  it('asks for a material when only a quantity was entered', () => {
    const { request, ctx } = templateDraft();
    const next = withComponents(request, ctx, ([first]) => [{ ...first, fields: { componentQty: fv('5') } }]);
    const [issue] = bomIssues(next, 'componentNumber.requiredWhenQuantityEntered');
    expect(issue).toMatchObject({ blocking: true, fieldId: 'componentNumber', message: 'Choose a material for this component.' });
    expect(bomIssues(next, 'components.required')).toHaveLength(1);
  });

  it('does not ask for components when Create Finished Product says no BOM setup is needed', () => {
    const { request, ctx } = templateDraft();
    const create = itemOf<FertCreateItem>(request, 'finishedGoodsCreate');
    const declined = must(updateItem(request, create.id, { fields: { ...create.data.fields, finishedGoodsBomSetupNeeded: fv('N') } }, ctx()));
    expect(bomIssues(declined, 'components.required')).toHaveLength(0);
  });

  it.each(['0', '0.0', '-3', 'abc', '1,000', '12.3456', '1e5', ' '])('rejects the quantity %j', (quantity) => {
    const { request, ctx } = templateDraft();
    const next = withComponents(request, ctx, ([first]) => [{ ...selectComponentMaterial(first, material('MAT-001')), fields: { ...selectComponentMaterial(first, material('MAT-001')).fields, componentQty: fv(quantity) } }]);
    const format = bomIssues(next, 'componentQty.format');
    // A blank quantity is "required", not "invalid"; everything else is an invalid format.
    if (quantity.trim() === '') expect(format).toHaveLength(0);
    else expect(format[0]).toMatchObject({ blocking: true, category: 'invalid' });
  });

  it.each(['1', '18200', '2.5', '0.5', '120000', '0.125'])('accepts the quantity %j', (quantity) => {
    const { request, ctx } = templateDraft();
    const next = withComponents(request, ctx, ([first]) => [{ ...selectComponentMaterial(first, material('MAT-001')), fields: { ...selectComponentMaterial(first, material('MAT-001')).fields, componentQty: fv(quantity) } }]);
    expect(bomIssues(next, 'componentQty.format')).toHaveLength(0);
  });

  it('still rejects a material that is not in the existing reference list', () => {
    const { request, ctx } = templateDraft();
    const next = withComponents(request, ctx, ([first]) => [{ ...first, fields: { componentNumber: fv('NEW-999'), componentQty: fv('1'), componentBaseUom: fv('EA') } }]);
    expect(bomIssues(next, 'componentNumber.lookup')[0].message).toMatch(/only use existing materials/);
  });
});

describe('selectComponentMaterial', () => {
  const blank = { id: 'cmp_1', fields: {} };

  it('fills description, type, group and the material’s own unit from the reference data', () => {
    const { fields } = selectComponentMaterial(blank, material('MAT-001'));
    expect(fields.componentNumber?.value).toBe('MAT-001');
    expect(fields.componentDescription).toMatchObject({ value: 'COMPONENT A', provenance: 'reference' });
    expect(fields.componentMatlType?.value).toBe('semiFinished');
    expect(fields.componentMatlGrp?.value).toBe('GRP-01');
    expect(fields.componentBaseUom).toMatchObject({ value: 'KG', provenance: 'reference' });
  });

  it('leaves the quantity blank until the user enters one', () => {
    expect(selectComponentMaterial(blank, material('MAT-001')).fields.componentQty).toBeUndefined();
  });

  it('keeps the quantity when the material changes', () => {
    const first = selectComponentMaterial({ ...blank, fields: { componentQty: fv('250') } }, material('MAT-001'));
    const second = selectComponentMaterial(first, material('MAT-101'));
    expect(second.fields.componentNumber?.value).toBe('MAT-101');
    expect(second.fields.componentQty?.value).toBe('250');
    expect(second.fields.componentBaseUom?.value).toBe('EA');
  });

  it('keeps a unit the user chose, and follows the new material when the unit was only defaulted', () => {
    const chosen = selectComponentMaterial(blank, material('MAT-001'));
    const userUnit = { ...chosen, fields: { ...chosen.fields, componentBaseUom: fv('LB') } };
    expect(selectComponentMaterial(userUnit, material('MAT-101')).fields.componentBaseUom?.value).toBe('LB');
    expect(selectComponentMaterial(chosen, material('MAT-101')).fields.componentBaseUom?.value).toBe('EA');
  });

  it('clearing the material drops what came from it but keeps the quantity', () => {
    const chosen = selectComponentMaterial({ ...blank, fields: { componentQty: fv('9') } }, material('MAT-001'));
    const cleared = selectComponentMaterial(chosen, null);
    expect(Object.keys(cleared.fields)).toEqual(['componentQty']);
  });

  it('clearing the material also keeps a unit the user chose, but not a defaulted one', () => {
    const chosen = selectComponentMaterial(blank, material('MAT-001'));
    const userUnit = { ...chosen, fields: { ...chosen.fields, componentBaseUom: fv('LB') } };
    expect(selectComponentMaterial(userUnit, null).fields.componentBaseUom?.value).toBe('LB');
    expect(selectComponentMaterial(chosen, null).fields.componentBaseUom).toBeUndefined();
  });

  it('does not change the component it was given', () => {
    const original = Object.freeze({ id: 'cmp_1', fields: Object.freeze({ componentQty: fv('3') }) });
    expect(() => selectComponentMaterial(original, material('MAT-002'))).not.toThrow();
  });
});


/** Create Finished Product filled in, the way the editor leaves it. */
function withCreateFilled(request: BomRequest, ctx: ReturnType<typeof makeCtx>): BomRequest {
  const create = itemOf<FertCreateItem>(request, 'finishedGoodsCreate');
  return must(
    updateItem(
      request,
      create.id,
      {
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
      },
      ctx(),
    ),
  );
}

const withValidComponent = (request: BomRequest, ctx: ReturnType<typeof makeCtx>, quantity = '18200') =>
  withComponents(request, ctx, ([first]) => {
    const chosen = selectComponentMaterial(first, material('MAT-001'));
    return [{ ...chosen, fields: { ...chosen.fields, componentQty: fv(quantity) } }];
  });

/** The focused P303 request: Create and the BOM done, Set Up Plant Availability never opened. */
function supportedRequest() {
  const { request, ctx } = templateDraft();
  return { request: withValidComponent(withCreateFilled(request, ctx), ctx), ctx };
}

describe('Build Product BOM completeness', () => {
  const bomOf = (request: BomRequest) => itemOf<FertBomItem>(request, 'finishedGoodsBom');

  it('is Not started until the user has done something, even though it already blocks submission', () => {
    const { request } = templateDraft();
    expect(bomOf(request).completeness).toBe('notStarted');
    expect(request.validation.submittable).toBe(false);
  });

  it('is Complete once its components are valid, even with non-blocking header warnings left', () => {
    const { request } = supportedRequest();
    const bom = bomOf(request);
    expect(bom.issues.some((issue) => issue.blocking)).toBe(false);
    expect(bom.issues.some((issue) => !issue.blocking)).toBe(true);
    expect(bom.completeness).toBe('complete');
  });

  it('needs attention when a chosen material has no quantity', () => {
    const { request, ctx } = supportedRequest();
    const next = withComponents(request, ctx, ([first]) => [{ ...first, fields: { ...first.fields, componentQty: undefined } }]);
    expect(bomOf(next).completeness).toBe('hasIssues');
    expect(next.validation.submittable).toBe(false);
  });

  it('needs attention when a quantity has no material', () => {
    const { request, ctx } = supportedRequest();
    const next = withComponents(request, ctx, ([first]) => [{ ...first, fields: { componentQty: first.fields.componentQty } }]);
    expect(bomOf(next).completeness).toBe('hasIssues');
    expect(next.validation.submittable).toBe(false);
  });

  it('needs attention for an invalid quantity', () => {
    const { request, ctx } = supportedRequest();
    const next = withValidComponent(request, ctx, '0');
    expect(bomOf(next).completeness).toBe('hasIssues');
  });

  it('needs attention when every component is removed after the user started, but not before', () => {
    const { request, ctx } = supportedRequest();
    const emptied = withComponents(request, ctx, ([first]) => [{ id: first.id, fields: {} }]);
    expect(bomOf(emptied).completeness).toBe('hasIssues');
    expect(emptied.validation.submittable).toBe(false);
    expect(bomOf(templateDraft().request).completeness).toBe('notStarted');
  });
});

describe('one readiness answer for the whole request', () => {
  it('treats the supported request as ready when only the untouched Plant Availability item is left', () => {
    const { request, ctx } = supportedRequest();
    const extend = itemOf(request, 'extend');
    expect(extend.completeness).toBe('notStarted');
    expect(extend.issues.some((issue) => !issue.blocking)).toBe(true);
    expect(extend.issues.some((issue) => issue.blocking)).toBe(false);
    expect(isReadyForReview(request, REFERENCE_DATA)).toBe(true);
    expect(submitRequest(request, ctx()).ok).toBe(true);
  });

  it('is not ready while the BOM has no component, whatever the other items say', () => {
    const { request, ctx } = templateDraft();
    const almost = withCreateFilled(request, ctx);
    expect(isReadyForReview(almost, REFERENCE_DATA)).toBe(false);
    expect(submitRequest(almost, ctx()).ok).toBe(false);
  });

  it('is not ready with no Request Items at all', () => {
    const { request } = templateDraft();
    expect(isReadyForReview({ ...request, items: [] }, REFERENCE_DATA)).toBe(false);
  });

  it('matches what the submission review finds, in every state', () => {
    const { request: template, ctx } = templateDraft();
    const created = withCreateFilled(template, ctx);
    const valid = withValidComponent(created, ctx);
    const states = [
      template,
      created,
      valid,
      withValidComponent(created, ctx, '0'),
      withComponents(valid, ctx, ([first]) => [{ id: first.id, fields: {} }]),
      { ...valid, items: valid.items.filter((item) => item.type !== 'finishedGoodsBom') },
    ];
    for (const state of states) {
      expect(isReadyForReview(state, REFERENCE_DATA)).toBe(previewSubmission(state, ctx()).submittable);
    }
  });
});
