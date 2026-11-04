import type { BusinessNeedId, MaterialScenarioId } from './types';

/** Business needs and material scenarios for the demo. Only the first of each is functional. */
export interface BusinessNeedOption {
  id: BusinessNeedId;
  label: string;
  functional: boolean;
}

export const BUSINESS_NEEDS: readonly BusinessNeedOption[] = [
  { id: 'newProduct', label: 'New Product / Innovation', functional: true },
  { id: 'lineExtension', label: 'Line Extension / New Size or Configuration', functional: false },
  { id: 'packagingGraphics', label: 'Packaging or Graphics Change', functional: false },
  { id: 'reformulation', label: 'Reformulation / Ingredient Change', functional: false },
  { id: 'plantComan', label: 'Plant or Co-man Setup', functional: false },
  { id: 'marketUom', label: 'Market or Unit-of-Measure Setup', functional: false },
];

export interface MaterialScenarioOption {
  id: MaterialScenarioId;
  label: string;
  functional: boolean;
}

export const MATERIAL_SCENARIOS: readonly MaterialScenarioOption[] = [
  { id: 'noNewMaterials', label: 'No New Materials', functional: true },
  { id: 'someNewMaterials', label: 'Some New Materials', functional: false },
  { id: 'allNewMaterials', label: 'All New Materials', functional: false },
  { id: 'notSure', label: 'Not Sure', functional: false },
];

export const FUTURE_PHASE_MESSAGE =
  'This scenario is planned for a future phase of the pilot. In this proof of concept only New Product / Innovation with No New Materials is functional end to end.';

export const businessNeedLabel = (id: BusinessNeedId) => BUSINESS_NEEDS.find((n) => n.id === id)?.label ?? id;
export const materialScenarioLabel = (id: MaterialScenarioId) =>
  MATERIAL_SCENARIOS.find((s) => s.id === id)?.label ?? id;

/** The one functional POC path: New Product / Innovation + No New Materials. */
export function isFunctionalPath(
  businessNeed: BusinessNeedId | null,
  materialScenario: MaterialScenarioId | null,
): boolean {
  return businessNeed === 'newProduct' && materialScenario === 'noNewMaterials';
}
