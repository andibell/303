import { ITEM_DEFS } from './fieldSpecs';
import { ITEM_PRESENTATION, itemBusinessName, itemDescription, itemTechnicalLabel } from './itemNames';
import type { ItemType } from '../types';

describe('Request Item naming', () => {
  it('maps each business-friendly name to its technical Request Item', () => {
    expect(itemBusinessName('finishedGoodsCreate')).toBe('Create Finished Product');
    expect(itemTechnicalLabel('finishedGoodsCreate')).toBe('Finished Product Create');
    expect(itemBusinessName('extend')).toBe('Set Up Plant Availability');
    expect(itemTechnicalLabel('extend')).toBe('Finished Product Extend');
    expect(itemBusinessName('finishedGoodsBom')).toBe('Build Product BOM');
    expect(itemTechnicalLabel('finishedGoodsBom')).toBe('Product Bill of Materials');
  });

  it('leaves the Request Item type identifiers unchanged and covers every one of them', () => {
    const types: ItemType[] = ['finishedGoodsCreate', 'extend', 'finishedGoodsBom'];
    expect(Object.keys(ITEM_DEFS)).toEqual(types);
    expect(Object.keys(ITEM_PRESENTATION)).toEqual(types);
    for (const type of types) expect(ITEM_DEFS[type].type).toBe(type);
  });

  it('is one central configuration: technical labels come from the item definitions, descriptions from the same place', () => {
    for (const type of Object.keys(ITEM_DEFS) as ItemType[]) {
      expect(itemTechnicalLabel(type)).toBe(ITEM_DEFS[type].label);
      expect(itemDescription(type)).toBe(ITEM_PRESENTATION[type].description);
      expect(itemBusinessName(type)).not.toBe(itemTechnicalLabel(type));
    }
    expect(itemDescription('finishedGoodsBom')).toBe('Define the component structure for the finished product.');
  });
});
