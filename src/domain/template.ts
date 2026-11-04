import { isFunctionalPath, FUTURE_PHASE_MESSAGE } from './businessNeeds';
import type { BusinessNeedId, ItemType, MaterialScenarioId } from './types';

export interface TemplateItemSpec {
  type: ItemType;
  required: boolean;
}

export type TemplateResult =
  | { supported: true; items: readonly TemplateItemSpec[] }
  | { supported: false; reason: string };

/**
 * The recommended starting template for a new product request with no new materials:
 * Finished Product Create, Extend, Product Bill of Materials. A recommended template is a starting point, not an immutable workflow:
 * every item may be removed from a draft. Any other combination returns no template.
 */
const GOLDEN_PATH: readonly TemplateItemSpec[] = [
  { type: 'finishedGoodsCreate', required: true },
  { type: 'extend', required: true },
  { type: 'finishedGoodsBom', required: true },
];

/** The item types the recommended template starts a request with. */
export const RECOMMENDED_ITEM_TYPES: readonly ItemType[] = GOLDEN_PATH.map((spec) => spec.type);

export function generateTemplate(
  businessNeed: BusinessNeedId | null,
  materialScenario: MaterialScenarioId | null,
): TemplateResult {
  if (!isFunctionalPath(businessNeed, materialScenario)) {
    return { supported: false, reason: FUTURE_PHASE_MESSAGE };
  }
  return { supported: true, items: GOLDEN_PATH };
}
