import type { ItemType } from '../types';
import { itemLabel } from './fieldSpecs';

/*
 * How each Request Item type is named to people. Business meaning leads and the technical Request Item
 * label (the System-facing term, from `itemLabel`) follows it. These are system-defined, not user-editable, and
 * apply to every place a Request Item is named. A future Business Need adds its own types here.
 */
export interface ItemPresentation {
  /** Business-friendly name, primary. */
  businessName: string;
  /** One plain-language sentence about the work. Shown in the selected item's workspace, not in navigation. */
  description: string;
}

export const ITEM_PRESENTATION: Record<ItemType, ItemPresentation> = {
  finishedGoodsCreate: {
    businessName: 'Create Finished Product',
    description: 'Set up the finished product material needed for this request.',
  },
  extend: {
    businessName: 'Set Up Plant Availability',
    description: 'Identify where the finished product needs to be produced or distributed.',
  },
  finishedGoodsBom: {
    businessName: 'Build Product BOM',
    description: 'Define the component structure for the finished product.',
  },
};

export const itemBusinessName = (type: ItemType): string => ITEM_PRESENTATION[type].businessName;
export const itemDescription = (type: ItemType): string => ITEM_PRESENTATION[type].description;
/** The technical Request Item label shown beneath the business name. */
export const itemTechnicalLabel = (type: ItemType): string => itemLabel(type);
