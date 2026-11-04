import { ITEM_DEFS } from './items/fieldSpecs';
import { fv, updateItem } from './requests';
import type { FertCreateItem } from './types';
import { sectionCompleteness } from './validation/engine';
import { itemOf, must, templateDraft, validDraft } from '../test/fixtures';

const specs = ITEM_DEFS.finishedGoodsCreate.groups.main ?? [];

describe('section completeness', () => {
  it('uses the item states for each section, from the item’s own issues', () => {
    const { request, ctx } = templateDraft();
    const create = itemOf<FertCreateItem>(request, 'finishedGoodsCreate');
    expect(sectionCompleteness(create, 'Material')).toBe('notStarted');

    const started = must(updateItem(request, create.id, { fields: { ...create.data.fields, externalMaterialId: fv('900001') } }, ctx()));
    expect(sectionCompleteness(itemOf(started, 'finishedGoodsCreate'), 'Material')).toBe('inProgress');
    expect(sectionCompleteness(itemOf(started, 'finishedGoodsCreate'), 'Shelf life and storage')).toBe('notStarted');

    const bad = must(updateItem(request, create.id, { fields: { ...create.data.fields, itemCode: fv('A1') } }, ctx()));
    expect(sectionCompleteness(itemOf(bad, 'finishedGoodsCreate'), 'Units and packaging')).toBe('hasIssues');
  });

  it('is complete for every Finished Product Create section of a valid draft', () => {
    const create = itemOf(validDraft().request, 'finishedGoodsCreate');
    for (const section of new Set(specs.map((spec) => spec.section))) expect(sectionCompleteness(create, section)).toBe('complete');
  });

  it('ignores system-derived values when deciding whether a section has started', () => {
    const create = itemOf<FertCreateItem>(templateDraft().request, 'finishedGoodsCreate');
    expect(create.data.fields.finishedGoodsBomSetupNeeded?.provenance).toBe('derived');
    expect(sectionCompleteness(create, 'Market and BOM setup')).toBe('notStarted');
  });
});

describe('Finished Product Create presentation metadata in the field specs', () => {
  it('shows the reference guide link only when Product Bill of Materials setup is needed', () => {
    const link = specs.find((spec) => spec.id === 'referenceGuideLink');
    expect(link?.shownWhen?.test({ finishedGoodsBomSetupNeeded: fv('Y') })).toBe(true);
    expect(link?.shownWhen?.test({ finishedGoodsBomSetupNeeded: fv('N') })).toBe(false);
    expect(link?.shownWhen?.source.locator).toBe('sample field');
  });

  it('provides generic guidance for pallet-based requests', () => {
    const unit = specs.find((spec) => spec.id === 'orderableBaseUom');
    expect(Object.keys(unit?.choiceNotes ?? {})).toEqual(['PAL']);
    expect(unit?.choiceNotes?.PAL.text).toMatch(/additional setup/);
  });

  it('keeps every active field rule and source on the Finished Product Create specs', () => {
    expect(specs.map((spec) => spec.id)).toEqual([
      'externalMaterialId',
      'materialDescription',
      'itemCode',
      'orderableBaseUom',
      'netWeight',
      'grossWeight',
      'weightUnit',
      'minShelfLife',
      'totalShelfLife',
      'temperatureCondition',
      'targetMarket',
      'finishedGoodsBomSetupNeeded',
      'referenceGuideLink',
    ]);
    for (const spec of specs) expect(spec.source.document).toBeTruthy();
  });
});
