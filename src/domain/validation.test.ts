import { REFERENCE_DATA } from '../data/reference';
import { fieldGroups } from './items/accessors';
import { fv, updateItem } from './requests';
import type { BomRequest, ExtendItem, FertBomItem, FertCreateItem, ValidationIssue } from './types';
import { RULES } from './validation/rules';
import { evaluateRequest, validateRequest } from './validation/engine';
import { itemOf, makeCtx, must, templateDraft, validDraft } from '../test/fixtures';

const issuesFor = (request: BomRequest, ruleId: string, phase: 'authoring' | 'submission' = 'submission'): ValidationIssue[] =>
  validateRequest(request, REFERENCE_DATA, phase).filter((issue) => issue.ruleId === ruleId);

function withCreate(request: BomRequest, ctx: ReturnType<typeof makeCtx>, fields: Record<string, ReturnType<typeof fv> | undefined>) {
  const create = itemOf<FertCreateItem>(request, 'finishedGoodsCreate');
  return must(updateItem(request, create.id, { fields: { ...create.data.fields, ...fields } }, ctx()));
}

describe('validation architecture', () => {
  it('gives every rule a source citation, an id and a description', () => {
    expect(RULES.length).toBeGreaterThan(30);
    for (const rule of RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(rule.source.document).toBeTruthy();
      expect(rule.source.locator).toBeTruthy();
    }
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(RULES.length);
  });

  it('does not activate the unsupported hypothesis rules', () => {
    const text = RULES.map((rule) => `${rule.id} ${rule.description}`).join(' ').toLowerCase();
    expect(text).not.toMatch(/check.?digit|gs1/);
    expect(text).not.toMatch(/gross weight.*net weight|net weight.*gross weight/);
    expect(text).not.toMatch(/shelf life.*(<=|less|greater|exceed)/);
    expect(RULES.some((rule) => rule.id.includes('producingPlants') && rule.id.startsWith('finishedGoodsBom'))).toBe(false);
  });

  it('reports no issues on a fully valid draft', () => {
    const { request } = validDraft();
    expect(validateRequest(request, REFERENCE_DATA, 'submission')).toEqual([]);
  });

  it('carries severity, message, item, field, rule id and blocking on every issue', () => {
    const { request } = templateDraft();
    const issue = issuesFor(request, 'finishedGoodsCreate.materialDescription.required')[0];
    expect(issue).toMatchObject({
      severity: 'error',
      blocking: true,
      category: 'missing',
      itemType: 'finishedGoodsCreate',
      fieldId: 'materialDescription',
      section: 'Material',
      message: 'Material Description is required.',
    });
    expect(issue.itemId).toBe(itemOf(request, 'finishedGoodsCreate').id);
    expect(issue.source.document).toContain('not included in this public demo');
  });

  it('applies the BOM setup rule at submission, not while authoring', () => {
    const { request, ctx } = validDraft();
    const withoutBom = { ...request, items: request.items.filter((item) => item.type !== 'finishedGoodsBom') };
    const missingSetup = withCreate(withoutBom, ctx, {
      finishedGoodsBomSetupNeeded: fv('Y'),
      referenceGuideLink: fv(''),
    });
    expect(issuesFor(missingSetup, 'finishedGoodsCreate.bomSetup.consistency', 'authoring')).toHaveLength(0);
    expect(issuesFor(missingSetup, 'finishedGoodsCreate.bomSetup.consistency', 'submission')).toHaveLength(1);
  });
});

describe('blocking errors versus nonblocking warnings', () => {
  it('marks errors as blocking and warnings as nonblocking', () => {
    const { request } = templateDraft();
    const issues = validateRequest(request, REFERENCE_DATA);
    expect(issues.filter((i) => i.severity === 'error').every((i) => i.blocking)).toBe(true);
    expect(issues.filter((i) => i.severity === 'warning').every((i) => !i.blocking)).toBe(true);
    expect(issues.some((i) => i.severity === 'warning')).toBe(true);
  });

  it('treats ambiguous Extend and BOM fields as warnings, never blocking', () => {
    const { request } = templateDraft();
    const extend = issuesFor(request, 'extend.producingPlants.expected');
    const bom = issuesFor(request, 'finishedGoodsBom.componentNumber.expected');
    expect(extend[0]).toMatchObject({ severity: 'warning', blocking: false });
    expect(bom[0]).toMatchObject({ severity: 'warning', blocking: false });
  });

  it('only blocks submission on errors', () => {
    const { request, ctx } = validDraft();
    // A unit outside the (incomplete) representative list is only a warning.
    const bom = itemOf<FertBomItem>(request, 'finishedGoodsBom');
    const edited = must(
      updateItem(request, bom.id, { ...bom.data, header: { ...bom.data.header, headerBaseUom: fv('XYZ') } }, ctx()),
    );
    expect(edited.validation.warningCount).toBeGreaterThan(0);
    expect(edited.validation.blockingCount).toBe(0);
    expect(edited.validation.submittable).toBe(true);
  });

  it('marks a request not submittable when an error remains', () => {
    const { request } = templateDraft();
    expect(request.validation.submittable).toBe(false);
    expect(request.validation.blockingCount).toBeGreaterThan(0);
  });
});

describe('evidence-backed rules', () => {
  it('limits the Material Description to 80 characters including spaces', () => {
    const { request, ctx } = validDraft();
    const exactly80 = 'X'.repeat(80);
    const tooLong = 'X'.repeat(81);
    expect(issuesFor(withCreate(request, ctx, { materialDescription: fv(exactly80) }), 'finishedGoodsCreate.materialDescription.maxLength')).toHaveLength(0);
    const issue = issuesFor(withCreate(request, ctx, { materialDescription: fv(tooLong) }), 'finishedGoodsCreate.materialDescription.maxLength')[0];
    expect(issue.message).toContain('80');
    expect(issue.blocking).toBe(true);
  });

  it('accepts a generic product code and rejects invalid values', () => {
    const { request, ctx } = validDraft();
    for (const bad of ['A1', 'invalid code', 'X'.repeat(25)]) {
      expect(issuesFor(withCreate(request, ctx, { itemCode: fv(bad) }), 'finishedGoodsCreate.itemCode.format')).toHaveLength(1);
    }
    expect(issuesFor(withCreate(request, ctx, { itemCode: fv('SKU-ABC-01') }), 'finishedGoodsCreate.itemCode.format')).toHaveLength(0);
  });

  it('accepts only the documented orderable units: EA, PK, CS, PAL', () => {
    const { request, ctx } = validDraft();
    for (const good of ['EA', 'PK', 'CS', 'PAL']) {
      expect(issuesFor(withCreate(request, ctx, { orderableBaseUom: fv(good) }), 'finishedGoodsCreate.orderableBaseUom.allowedValues')).toHaveLength(0);
    }
    expect(issuesFor(withCreate(request, ctx, { orderableBaseUom: fv('GLL') }), 'finishedGoodsCreate.orderableBaseUom.allowedValues')).toHaveLength(1);
  });

  it('accepts only the documented temperature conditions and target markets', () => {
    const { request, ctx } = validDraft();
    expect(issuesFor(withCreate(request, ctx, { temperatureCondition: fv('warm') }), 'finishedGoodsCreate.temperatureCondition.allowedValues')).toHaveLength(1);
    expect(issuesFor(withCreate(request, ctx, { targetMarket: fv('Mars') }), 'finishedGoodsCreate.targetMarket.allowedValues')).toHaveLength(1);
    for (const market of ['Region A', 'Region B', 'Region C']) {
      expect(issuesFor(withCreate(request, ctx, { targetMarket: fv(market) }), 'finishedGoodsCreate.targetMarket.allowedValues')).toHaveLength(0);
    }
  });

  it('requires shelf lives to be whole days', () => {
    const { request, ctx } = validDraft();
    expect(issuesFor(withCreate(request, ctx, { minShelfLife: fv('9.5') }), 'finishedGoodsCreate.minShelfLife.format')).toHaveLength(1);
    expect(issuesFor(withCreate(request, ctx, { totalShelfLife: fv('six months') }), 'finishedGoodsCreate.totalShelfLife.format')).toHaveLength(1);
    expect(issuesFor(withCreate(request, ctx, { totalShelfLife: fv('180') }), 'finishedGoodsCreate.totalShelfLife.format')).toHaveLength(0);
  });

  it('does NOT compare minimum and total shelf life or gross and net weight', () => {
    const { request, ctx } = validDraft();
    const odd = withCreate(request, ctx, {
      minShelfLife: fv('365'),
      totalShelfLife: fv('30'),
      netWeight: fv('50'),
      grossWeight: fv('10'),
      weightUnit: fv('LB'),
    });
    expect(odd.validation.issues).toEqual([]);
  });

  it('checks plant codes for structure and against the reference list', () => {
    const { request, ctx } = validDraft();
    const extend = itemOf<ExtendItem>(request, 'extend');
    const setPlants = (plants: string[]) =>
      must(
        updateItem(request, extend.id, { rows: extend.data.rows.map((row) => ({ ...row, fields: { ...row.fields, producingPlants: fv(plants) } })) }, ctx()),
      );
    expect(issuesFor(setPlants(['X']), 'extend.producingPlants.format')).toHaveLength(1);
    expect(issuesFor(setPlants(['9999']), 'extend.producingPlants.lookup')[0].message).toContain('9999');
    expect(issuesFor(setPlants(['FAC-01', 'FAC-02']), 'extend.producingPlants.lookup')).toHaveLength(0);
  });

  it('checks the generic shipping category format without assuming a business mapping', () => {
    const { request, ctx } = validDraft();
    const extend = itemOf<ExtendItem>(request, 'extend');
    const setShip = (r: BomRequest, value: string) =>
      must(updateItem(r, extend.id, { rows: extend.data.rows.map((row) => ({ ...row, fields: { ...row.fields, shippingCategory: fv(value) } })) }, ctx()));
    expect(issuesFor(setShip(request, 'A'), 'extend.shippingCategory.format')).toHaveLength(1);
    expect(issuesFor(setShip(request, 'C'), 'extend.shippingCategory.format')).toHaveLength(1);
    expect(issuesFor(setShip(request, 'SHIP-01'), 'extend.shippingCategory.format')).toHaveLength(0);

  });

  it('requires a unit of measure whenever a BOM quantity is entered', () => {
    const { request, ctx } = validDraft();
    const bom = itemOf<FertBomItem>(request, 'finishedGoodsBom');
    const noUnit = must(
      updateItem(
        request,
        bom.id,
        {
          header: { ...bom.data.header, headerBaseUom: undefined },
          components: bom.data.components.map((c, i) => (i === 0 ? { ...c, fields: { ...c.fields, componentBaseUom: undefined } } : c)),
        },
        ctx(),
      ),
    );
    expect(issuesFor(noUnit, 'finishedGoodsBom.headerQuantity.requiresUnit')).toHaveLength(1);
    const component = issuesFor(noUnit, 'finishedGoodsBom.componentQty.requiresUnit');
    expect(component).toHaveLength(1);
    expect(component[0].rowId).toBe(bom.data.components[0].id);
  });

  it('requires every BOM component to exist in the reference materials (No New Materials)', () => {
    const { request, ctx } = validDraft();
    const bom = itemOf<FertBomItem>(request, 'finishedGoodsBom');
    const unknown = must(
      updateItem(
        request,
        bom.id,
        { ...bom.data, components: [{ id: 'c1', fields: { componentNumber: fv('9999999'), componentQty: fv('1'), componentBaseUom: fv('EA') } }] },
        ctx(),
      ),
    );
    const issue = issuesFor(unknown, 'finishedGoodsBom.componentNumber.lookup')[0];
    expect(issue).toMatchObject({ severity: 'error', blocking: true, rowId: 'c1' });
  });

  it('does NOT cross-check the BOM plant against the Extend producing plants', () => {
    const { request, ctx } = validDraft();
    const bom = itemOf<FertBomItem>(request, 'finishedGoodsBom');
    const other = must(updateItem(request, bom.id, { ...bom.data, header: { ...bom.data.header, plant: fv('FAC-12') } }, ctx()));
    expect(other.validation.issues).toEqual([]);
  });

  it('requires Product Bill of Materials setup to be satisfied by a BOM item or an reference guide link', () => {
    const { request, ctx } = validDraft();
    const bom = itemOf<FertBomItem>(request, 'finishedGoodsBom');
    const sansBom = must({ ok: true, request: { ...request, items: request.items.filter((i) => i.id !== bom.id) } });
    const create = itemOf<FertCreateItem>(sansBom, 'finishedGoodsCreate');
    const needsBom = withCreate(sansBom, ctx, { finishedGoodsBomSetupNeeded: fv('Y') });
    expect(issuesFor(needsBom, 'finishedGoodsCreate.bomSetup.consistency')).toHaveLength(1);
    expect(create.id).toBeTruthy();
    const linked = withCreate(needsBom, ctx, { referenceGuideLink: fv('https://example.test/factsheet') });
    expect(issuesFor(linked, 'finishedGoodsCreate.bomSetup.consistency')).toHaveLength(0);
  });

  it('requires the shared business justification and a supported path', () => {
    const { request } = validDraft();
    expect(issuesFor({ ...request, context: {} }, 'request.businessJustification.required')).toHaveLength(1);
    expect(issuesFor({ ...request, materialScenario: 'someNewMaterials' }, 'request.supportedPath')).toHaveLength(1);
    expect(issuesFor({ ...request, businessNeed: null }, 'request.businessNeed.selected')).toHaveLength(1);
  });

  it('has no item-level business justification field', () => {
    const { request } = validDraft();
    for (const item of request.items) {
      for (const group of fieldGroups(item)) {
        expect(group.specs.map((spec) => spec.id)).not.toContain('businessJustification');
      }
    }
  });
});

describe('completeness', () => {
  it('moves an item from not started to in progress to complete', () => {
    const { request: blank } = templateDraft();
    expect(itemOf(blank, 'finishedGoodsCreate').completeness).toBe('notStarted');
    const { request: filled } = validDraft();
    expect(filled.items.map((item) => item.completeness)).toEqual(['complete', 'complete', 'complete']);
  });

  it('flags a broken value as blocked by validation and a gap as in progress', () => {
    const { request, ctx } = validDraft();
    const broken = withCreate(request, ctx, { itemCode: fv('A1') });
    expect(itemOf(broken, 'finishedGoodsCreate').completeness).toBe('hasIssues');
    const gap = withCreate(request, ctx, { itemCode: undefined });
    expect(itemOf(gap, 'finishedGoodsCreate').completeness).toBe('inProgress');
  });

  it('re-evaluating is idempotent', () => {
    const { request, ctx } = validDraft();
    const again = evaluateRequest(request, REFERENCE_DATA, ctx().now);
    expect(again.items.map((i) => i.completeness)).toEqual(request.items.map((i) => i.completeness));
    expect(again.validation.issues).toEqual(request.validation.issues);
  });
});
