import { ITEM_DEFS } from '../items/fieldSpecs';
import type { Choice } from '../referenceTypes';
import { requestForm } from '../sources';
import type { MaterialType, SourceRef } from '../types';

/*
 * Demo templates generate a product description from structured attributes. These templates are illustrative;
 * they are not intended to define a production naming standard.
 */

export interface DescriptionSegment {
  id: string;
  /** Business label of the structured attribute. */
  label: string;
  /** Where the attribute is stored in the item's fields. */
  fieldId: string;
  /** A required segment must be chosen before the description can be generated. */
  required: boolean;
  /** Allowed values. Each `code` is the token written into the description. */
  options: readonly Choice[];
}

export interface DescriptionTemplate {
  id: string;
  materialType: MaterialType;
  /** Templates are illustrative until a product naming standard is configured. */
  status: 'hypothesis' | 'validated';
  source: SourceRef;
  /** The item field the generated value fills. */
  targetFieldId: string;
  /** Maximum length comes from the target field specification. */
  maxLength: number;
  separator: string;
  transform: 'upper' | 'none';
  /** In output order. */
  segments: readonly DescriptionSegment[];
  /** Abbreviations are not applied by this demo. */
  abbreviations: null;
  /** Overlong results are reported, never shortened. */
  overflow: 'report';
  /** Requestors cannot override generated values in this demo. */
  override: 'none';
}

const FINISHED_GOODS_DESCRIPTION_MAX = ITEM_DEFS.finishedGoodsCreate.groups.main?.find((spec) => spec.id === 'materialDescription')?.maxLength ?? 80;

/* Fictional options for the product description builder. */
const option = (code: string, label: string): Choice => ({ id: code, label, code });
export const FINISHED_GOODS_CONCEPT_OPTIONS = {
  brands: [option('ALPH', 'Brand Alpha'), option('BETA', 'Brand Beta'), option('GAMM', 'Brand Gamma'), option('DELT', 'Brand Delta')],
  variants: [option('STD', 'Standard'), option('ADV', 'Premium')],
  models: [
    option('MODEL-A', 'Model A'),
    option('MODEL-B', 'Model B'),
    option('MODEL-C', 'Model C'),
    option('MODEL-D', 'Model D'),
    option('MODEL-E', 'Model E'),
    option('MODEL-F', 'Model F'),
    option('MODEL-G', 'Model G'),
    option('MODEL-H', 'Model H'),
    option('MODEL-I', 'Model I'),
    option('MODEL-J', 'Model J'),
  ],
  packageSizes: [option('SIZE-A', 'Size A'), option('SIZE-B', 'Size B'), option('SIZE-C', 'Size C'), option('SIZE-D', 'Size D')],
  containers: [option('BOX', 'Box'), option('SMALL BOX', 'Small box'), option('BAG', 'Bag'), option('CRATE', 'Crate')],
  packs: [option('6PK', '6-pack'), option('8PK', '8-pack'), option('10PK', '10-pack'), option('12PK', '12-pack'), option('24PK', '24-pack')],
} as const;

/** Generic example of a description assembled from product attributes. */
export const FINISHED_GOODS_DESCRIPTION_CONCEPT: DescriptionTemplate = {
  id: 'fert-description-concept',
  materialType: 'finishedGoods',
  status: 'hypothesis',
  source: requestForm('Public demo', 'sample field'),
  targetFieldId: 'materialDescription',
  maxLength: FINISHED_GOODS_DESCRIPTION_MAX,
  separator: ' ',
  transform: 'upper',
  segments: [
    { id: 'brand', label: 'Brand', fieldId: 'conceptBrand', required: true, options: FINISHED_GOODS_CONCEPT_OPTIONS.brands },
    { id: 'variant', label: 'Variant', fieldId: 'conceptVariant', required: false, options: FINISHED_GOODS_CONCEPT_OPTIONS.variants },
    { id: 'model', label: 'Model', fieldId: 'conceptModel', required: true, options: FINISHED_GOODS_CONCEPT_OPTIONS.models },
    { id: 'packageSize', label: 'Package size', fieldId: 'conceptPackageSize', required: true, options: FINISHED_GOODS_CONCEPT_OPTIONS.packageSizes },
    { id: 'container', label: 'Container type', fieldId: 'conceptContainer', required: true, options: FINISHED_GOODS_CONCEPT_OPTIONS.containers },
    { id: 'pack', label: 'Pack configuration', fieldId: 'conceptPackConfiguration', required: true, options: FINISHED_GOODS_CONCEPT_OPTIONS.packs },
  ],
  abbreviations: null,
  overflow: 'report',
  override: 'none',
};

/** The description template for each material type, where one exists. */
export const DESCRIPTION_TEMPLATES: Partial<Record<MaterialType, DescriptionTemplate>> = {
  finishedGoods: FINISHED_GOODS_DESCRIPTION_CONCEPT,
};
