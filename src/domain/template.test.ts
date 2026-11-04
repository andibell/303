import { BUSINESS_NEEDS, MATERIAL_SCENARIOS, isFunctionalPath } from './businessNeeds';
import { generateTemplate, RECOMMENDED_ITEM_TYPES } from './template';
import type { BusinessNeedId, MaterialScenarioId } from './types';

describe('golden-path template', () => {
  it('generates Finished Product Create, Extend and Product Bill of Materials for New Product + No New Materials', () => {
    const result = generateTemplate('newProduct', 'noNewMaterials');
    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.items.map((item) => item.type)).toEqual(['finishedGoodsCreate', 'extend', 'finishedGoodsBom']);
  });

  it('marks all three items as required parts of a recommended starting point, not a fixed workflow', () => {
    const result = generateTemplate('newProduct', 'noNewMaterials');
    if (!result.supported) throw new Error('expected a template');
    expect(result.items.every((item) => item.required)).toBe(true);
    expect(RECOMMENDED_ITEM_TYPES).toEqual(['finishedGoodsCreate', 'extend', 'finishedGoodsBom']);
  });

  it('is deterministic', () => {
    expect(generateTemplate('newProduct', 'noNewMaterials')).toEqual(generateTemplate('newProduct', 'noNewMaterials'));
  });

  it.each(BUSINESS_NEEDS.filter((need) => !need.functional).map((need) => need.id))(
    'generates nothing for the unsupported Business Need %s',
    (need) => {
      const result = generateTemplate(need, 'noNewMaterials');
      expect(result.supported).toBe(false);
      if (!result.supported) expect(result.reason).toMatch(/future phase/i);
    },
  );

  it.each(MATERIAL_SCENARIOS.filter((scenario) => !scenario.functional).map((scenario) => scenario.id))(
    'generates nothing for the unsupported material scenario %s',
    (scenario) => {
      expect(generateTemplate('newProduct', scenario).supported).toBe(false);
    },
  );

  it('generates nothing until both choices are made', () => {
    expect(generateTemplate(null, null).supported).toBe(false);
    expect(generateTemplate('newProduct', null).supported).toBe(false);
  });

  it('represents all six Business Needs and four material scenarios, with exactly one functional path', () => {
    expect(BUSINESS_NEEDS).toHaveLength(6);
    expect(MATERIAL_SCENARIOS.map((scenario) => scenario.id)).toEqual(['noNewMaterials', 'someNewMaterials', 'allNewMaterials', 'notSure']);
    const functional = BUSINESS_NEEDS.flatMap((need) =>
      MATERIAL_SCENARIOS.filter((scenario) => isFunctionalPath(need.id as BusinessNeedId, scenario.id as MaterialScenarioId)),
    );
    expect(functional).toHaveLength(1);
  });
});
