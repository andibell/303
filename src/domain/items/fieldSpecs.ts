import type { BomRequest, FieldMap, ItemType, SourceRef } from '../types';
import type { ChoiceListId, LookupListId } from '../referenceTypes';
import { fieldRequirements, requestForm } from '../sources';

/*
 * Generic demo field definitions. One config drives validation and request forms.
 * `required` blocks submission when empty, `expected` displays a non-blocking warning, and
 * `optional` does not participate in completeness checks.
 */

export type FieldInput = 'text' | 'longText' | 'choice' | 'plantList' | 'plant' | 'materialRef' | 'unit';

export interface FieldSpec {
  id: string;
  label: string;
  section: string;
  input: FieldInput;
  requirement: 'required' | 'expected' | 'optional';
  /** When present and false, the requirement doesn't apply (conditional requirements). */
  appliesWhen?: (request: BomRequest) => boolean;
  /**
   * When present, the field is only relevant (and shown) when this holds for the other values in its group.
   * A hidden field keeps any value it already has.
   */
  shownWhen?: { test: (fields: FieldMap) => boolean; source: SourceRef };
  /** Guidance tied to one value of a choice field. */
  choiceNotes?: Record<string, { text: string; source: SourceRef }>;
  maxLength?: number;
  pattern?: { regex: RegExp; message: string };
  exactLength?: number;
  /** Enumerated values. A value outside the list is a blocking error. */
  choices?: ChoiceListId;
  lookup?: { list: LookupListId; severity: 'error' | 'warning' };
  /**
   * Where the value normally comes from (default 'request': entered or chosen by the Requestor).
   *   reference  chosen from the sample reference data
   *   generated  filled by the application from other request information; see `applyDerivations`
   * A concept template (domain/description) may also generate a field; that is declared on the template, not here,
   * so hypotheses stay separate from the field definitions.
   */
  origin?: 'request' | 'reference' | 'generated';
  /**
   * Execution destination. 'Execution' values are information for the execution process; 'ExecutionTeamOnly' values
   * are supporting information for the execution team.
   */
  route?: 'Execution' | 'ExecutionTeamOnly';
  helper?: string;
  source: SourceRef;
}

export type GroupId = 'main' | 'row' | 'header' | 'component';

export interface ItemDef {
  type: ItemType;
  label: string;
  /** The execution team records a system identifier before an item can complete. */
  requiresExecutionIdentifier: boolean;
  /**
   * What the recorded System identifier means for this item type, when the POC has an interpretation. The identifier
   * itself stays generic, so other item types can record different System identifiers later.
   */
  executionIdentifierLabel?: string;
  groups: Partial<Record<GroupId, FieldSpec[]>>;
}

const FINISHED_GOODS_CREATE_REQ = () => fieldRequirements('sample field');
const FINISHED_GOODS_EXTEND_REQ = () => fieldRequirements('sample field');
const PRODUCT_BOM_REQ = () => fieldRequirements('sample field');

const bomSetupRequested = (request: BomRequest): boolean => {
  const create = request.items.find((item) => item.type === 'finishedGoodsCreate');
  const answer = create?.type === 'finishedGoodsCreate' ? create.data.fields.finishedGoodsBomSetupNeeded?.value : undefined;
  return answer !== 'N';
};

/** Identifier entered by the requestor before execution creates the finished good. */
export const SOURCE_MATERIAL_IDENTIFIER_FIELD = 'externalMaterialId';

const finishedGoodsCreate: FieldSpec[] = [
  {
    id: SOURCE_MATERIAL_IDENTIFIER_FIELD,
    label: 'Source Material Identifier',
    section: 'Material',
    input: 'text',
    requirement: 'required',
    // External request information, entered by the requestor.
    origin: 'request',
    route: 'Execution',
    helper: 'External code used to identify the material before creation.',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'materialDescription',
    label: 'Material Description',
    section: 'Material',
    input: 'text',
    requirement: 'required',
    maxLength: 80,
    route: 'Execution',
    helper: 'Maximum 80 characters, including spaces.',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'itemCode',
    label: "Orderable Unit's Product Code",
    section: 'Units and packaging',
    input: 'text',
    requirement: 'required',
    pattern: { regex: /^[A-Za-z0-9-]{3,24}$/, message: 'Enter a 3- to 24-character product code using letters, numbers, or hyphens.' },
    route: 'Execution',
    helper: 'Use letters, numbers, or hyphens.',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'orderableBaseUom',
    label: 'Orderable Unit/Base Unit of Measure',
    section: 'Units and packaging',
    input: 'choice',
    origin: 'reference',
    requirement: 'required',
    choices: 'orderableUoms',
    route: 'Execution',
    helper: 'EA, PK, CS or PAL.',
    choiceNotes: {
      PAL: {
        text: 'Some unit selections may require additional setup.',
        source: requestForm('Public demo', 'sample field'),
      },
    },
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'netWeight',
    label: 'Net Weight',
    section: 'Units and packaging',
    input: 'text',
    requirement: 'optional',
 
    route: 'Execution',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'grossWeight',
    label: 'Gross Weight',
    section: 'Units and packaging',
    input: 'text',
    requirement: 'optional',
 
    route: 'Execution',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'weightUnit',
    label: 'Weight Unit',
    section: 'Units and packaging',
    input: 'unit',
    origin: 'reference',
    requirement: 'optional',
    helper: 'Choose a suggested unit or enter another. No unit list is documented.',
 
    route: 'Execution',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'minShelfLife',
    label: 'Minimum Shelf Life',
    section: 'Shelf life and storage',
    input: 'text',
    requirement: 'required',
    pattern: { regex: /^\d+$/, message: 'Enter the shelf life as a whole number of days.' },
 
    route: 'Execution',
    helper: 'Enter days.',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'totalShelfLife',
    label: 'Total Shelf Life',
    section: 'Shelf life and storage',
    input: 'text',
    requirement: 'required',
    pattern: { regex: /^\d+$/, message: 'Enter the shelf life as a whole number of days.' },
 
    route: 'Execution',
    helper: 'Enter days.',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'temperatureCondition',
    label: 'Temperature Condition',
    section: 'Shelf life and storage',
    input: 'choice',
    origin: 'reference',
    requirement: 'required',
    choices: 'temperatureConditions',
 
    route: 'Execution',
    helper: 'Ambient, chilled or frozen.',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'targetMarket',
    label: 'Target Market',
    section: 'Market and BOM setup',
    input: 'choice',
    requirement: 'required',
    choices: 'targetMarkets',
    route: 'ExecutionTeamOnly',
    helper: 'Choose a region for the request.',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'finishedGoodsBomSetupNeeded',
    label: 'Product Bill of Materials Setup Needed?',
    section: 'Market and BOM setup',
    input: 'choice',
    origin: 'generated',
    requirement: 'required',
    choices: 'yesNo',
    route: 'ExecutionTeamOnly',
    helper: 'If Yes, complete the Product Bill of Materials or provide the reference guide link.',
    source: FINISHED_GOODS_CREATE_REQ(),
  },
  {
    id: 'referenceGuideLink',
    label: 'Reference document link',
    section: 'Market and BOM setup',
    input: 'text',
    requirement: 'optional',
    helper: 'Optional link to supporting product information.',
    shownWhen: {
      test: (fields) => fields.finishedGoodsBomSetupNeeded?.value === 'Y',
      source: FINISHED_GOODS_CREATE_REQ(),
    },
    source: FINISHED_GOODS_CREATE_REQ(),
  },
];

const extendRow: FieldSpec[] = [
  {
    id: 'externalMaterialId',
    label: 'Existing Material Identifier',
    section: 'Material',
    input: 'materialRef',
    requirement: 'required',
 
    route: 'Execution',
    helper: 'Enter the existing material identifier.',
    source: FINISHED_GOODS_EXTEND_REQ(),
  },
  {
    id: 'plantToExtend',
    label: 'Plant to Extend',
    section: 'Plants',
    input: 'plantList',
    requirement: 'expected',
    lookup: { list: 'plants', severity: 'error' },
    route: 'ExecutionTeamOnly',
    helper: 'The target plant(s).',
    source: FINISHED_GOODS_EXTEND_REQ(),
  },
  {
    id: 'producingPlants',
    label: 'Producing Plants',
    section: 'Plants',
    input: 'plantList',
    requirement: 'expected',
    lookup: { list: 'plants', severity: 'error' },
    route: 'ExecutionTeamOnly',
    helper: 'Enter one or more manufacturing facility identifiers.',
    source: FINISHED_GOODS_EXTEND_REQ(),
  },
  {
    id: 'distributingPlants',
    label: 'Distributing Plants',
    section: 'Plants',
    input: 'plantList',
    requirement: 'expected',
    lookup: { list: 'plants', severity: 'error' },
    route: 'ExecutionTeamOnly',
    helper: 'Enter one or more distribution or storage facility identifiers.',
    source: FINISHED_GOODS_EXTEND_REQ(),
  },
  {
    id: 'sendingPlants',
    label: 'Sending Plants',
    section: 'Plants',
    input: 'plantList',
    requirement: 'expected',
    lookup: { list: 'plants', severity: 'error' },
    route: 'ExecutionTeamOnly',
    helper: 'Enter one or more manufacturing facility identifiers.',
    source: FINISHED_GOODS_EXTEND_REQ(),
  },
  {
    id: 'shippingCategory',
    label: 'Shipping Material Group',
    section: 'Plants',
    input: 'text',
    requirement: 'expected',
    pattern: {
      regex: /^[A-Za-z0-9-]{2,12}$/,
      message: 'Enter a 2- to 12-character shipping material group.',
    },
    route: 'Execution',
    helper: 'Use letters, numbers, or hyphens.',
    source: requestForm('Public demo', 'sample field'),
  },
  {
    id: 'purchasingGrp',
    label: 'Purchasing Grp',
    section: 'Plants',
    input: 'text',
    requirement: 'expected',
    maxLength: 12,
 
    route: 'Execution',
    helper: 'The relevant 3-character code.',
    source: FINISHED_GOODS_EXTEND_REQ(),
  },
];

const bomApplies = { appliesWhen: bomSetupRequested } as const;

const bomHeader: FieldSpec[] = [
  {
    id: 'plant',
    label: 'Plant',
    section: 'BOM header',
    input: 'plant',
    requirement: 'expected',
    ...bomApplies,
    lookup: { list: 'plants', severity: 'error' },
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'p40Fert',
    label: 'Finished Product Group',
    section: 'BOM header',
    input: 'materialRef',
    requirement: 'expected',
    ...bomApplies,
 
    route: 'Execution',
    helper: 'The finished product created by this request.',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'headerDescription',
    label: 'Header Description',
    section: 'BOM header',
    input: 'text',
    requirement: 'expected',
    ...bomApplies,
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'headerMatlGrp',
    label: 'Header Matl Grp',
    section: 'BOM header',
    input: 'text',
    requirement: 'expected',
    ...bomApplies,
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'headerMatlType',
    label: 'Header Matl Type',
    section: 'BOM header',
    input: 'choice',
    requirement: 'expected',
    ...bomApplies,
    choices: 'materialTypes',
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'headerBaseUom',
    label: 'Header Base UoM',
    section: 'BOM header',
    input: 'unit',
    requirement: 'expected',
    ...bomApplies,
    lookup: { list: 'bomUoms', severity: 'warning' },
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'headerQuantity',
    label: 'Header Quantity',
    section: 'BOM header',
    input: 'text',
    requirement: 'expected',
    ...bomApplies,
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
];

const bomComponent: FieldSpec[] = [
  {
    id: 'componentNumber',
    label: 'Component Number',
    section: 'Components',
    input: 'materialRef',
    requirement: 'expected',
    ...bomApplies,
    lookup: { list: 'materials', severity: 'error' },
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'componentDescription',
    label: 'Component Description',
    section: 'Components',
    input: 'text',
    requirement: 'expected',
    ...bomApplies,
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'componentMatlType',
    label: 'Component Matl Type',
    section: 'Components',
    input: 'choice',
    requirement: 'expected',
    ...bomApplies,
    choices: 'materialTypes',
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'componentMatlGrp',
    label: 'Component Matl Grp',
    section: 'Components',
    input: 'text',
    requirement: 'expected',
    ...bomApplies,
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'componentQty',
    label: 'Component Qty',
    section: 'Components',
    input: 'text',
    requirement: 'expected',
    ...bomApplies,
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'componentBaseUom',
    label: 'Component Base U of M',
    section: 'Components',
    input: 'unit',
    requirement: 'expected',
    ...bomApplies,
    lookup: { list: 'bomUoms', severity: 'warning' },
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
  {
    id: 'priority',
    label: 'Priority',
    section: 'Components',
    input: 'text',
    requirement: 'expected',
    ...bomApplies,
 
    route: 'Execution',
    source: PRODUCT_BOM_REQ(),
  },
];

export const ITEM_DEFS: Record<ItemType, ItemDef> = {
  finishedGoodsCreate: {
    type: 'finishedGoodsCreate',
    label: 'Finished Product Create',
    requiresExecutionIdentifier: true,
    // POC interpretation: execution creates the material, and its new Execution Identifier is the recorded identifier.
    executionIdentifierLabel: 'Execution Identifier',
    groups: { main: finishedGoodsCreate },
  },
  extend: { type: 'extend', label: 'Finished Product Extend', requiresExecutionIdentifier: true, groups: { row: extendRow } },
  finishedGoodsBom: {
    type: 'finishedGoodsBom',
    label: 'Product Bill of Materials',
    requiresExecutionIdentifier: true,
    groups: { header: bomHeader, component: bomComponent },
  },
};

export const itemLabel = (type: ItemType): string => ITEM_DEFS[type].label;
