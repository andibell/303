import type { MaterialType } from './types';

/**
 * Shape of the representative reference data. Every instance is SYNTHETIC POC data, not connected to a live system.
 * Validation takes this as an argument so rules stay independent of where the data comes from.
 */
export interface Choice {
  id: string;
  label: string;
  /** Source code where the reference material shows one. Absent when none is documented. */
  code?: string;
  detail?: string;
}

export interface Plant {
  code: string;
  name: string;
  kind: 'manufacturing' | 'distribution' | 'coManufacturer';
}

export interface ReferenceMaterial {
  number: string;
  description: string;
  type: MaterialType;
  materialGroup: string;
  baseUom: string;
}

export interface ReferenceData {
  notice: string;
  plants: Plant[];
  materials: ReferenceMaterial[];
  materialTypes: Choice[];
  orderableUoms: Choice[];
  bomUoms: Choice[];
  weightUnits: Choice[];
  temperatureConditions: Choice[];
  targetMarkets: Choice[];
  yesNo: Choice[];
  purchasingGroups: Choice[];
}

/** Lists whose values are enforced as enumerations (when documented as such). */
export type ChoiceListId = 'orderableUoms' | 'temperatureConditions' | 'targetMarkets' | 'yesNo' | 'materialTypes';
/** Lists checked as lookups. */
export type LookupListId = 'plants' | 'materials' | 'bomUoms';

export const findPlant = (reference: ReferenceData, code: string) => reference.plants.find((p) => p.code === code);
export const findMaterial = (reference: ReferenceData, number: string) =>
  reference.materials.find((m) => m.number === number);
