import { personaActor } from './personas';
import { REFERENCE_DATA } from './reference';
import type { DomainContext } from '../domain/history';
import { componentFieldsFromReference } from '../domain/items/bom';
import { findMaterial, type ReferenceData } from '../domain/referenceTypes';
import {
  addReturn,
  addUpload,
  completeItem,
  createRequest,
  completeIntake,
  fv,
  generateInitialItems,
  recordCorrection,
  resubmitRequest,
  saveDraft,
  startExecution,
  submitRequest,
  updateItem,
  updateRequestDetails,
  type OpResult,
  type ReturnInput,
} from '../domain/requests';
import type { Actor, BomRequest, ExtendItem, FertBomItem, FertCreateItem, FieldMap, ItemType, RequestItem } from '../domain/types';

/*
 * Synthetic demo records. Every name, product, material number, Product Code and Execution Identifier is invented.
 * The records are built by running the real domain operations on a fixed clock, so statuses, items and
 * history are consistent with the rules rather than hand-assembled.
 */

const DEMO_REQUESTOR_ACTOR = personaActor('requestor');
const DEMO_EXECUTOR_ACTOR = personaActor('executionSpecialist');
const DEMO_REQUESTOR: Actor = { id: 'seed-requestor', name: 'Demo Requestor', role: 'requestor' };
const DEMO_EXECUTOR: Actor = { id: 'seed-executor', name: 'Demo Executor', role: 'executionSpecialist' };

/** Concept description attributes (option codes from FINISHED_GOODS_CONCEPT_OPTIONS). The description is generated from them. */
interface Concept {
  brand: string;
  variant?: string;
  model: string;
  size: string;
  container: string;
  pack: string;
}

interface Product {
  /**
   * A fictional upstream identifier entered at authoring.
   * It is not the Execution Identifier: that is assigned during execution and recorded as the product execution
   * identifier (see `executionId` below), so seeded drafts never know it in advance.
   */
  sourceIdentifier: string;
  concept: Concept;
  itemCode: string;
  uom: string;
  net: string;
  gross: string;
  weightUnit: string;
  minShelf: string;
  totalShelf: string;
  temperature: string;
  market: string;
  plantToExtend: string[];
  producing: string[];
  distributing: string[];
  sending: string[];
  shipMtl: string;
  purchasing: string;
  bomPlant: string;
  bomHeaderUom: string;
  bomQty: string;
  components: [number: string, quantity: string][];
  justification: string;
}

const product = (overrides: Partial<Product> & Pick<Product, 'sourceIdentifier' | 'concept' | 'itemCode' | 'justification' | 'components'>): Product => ({
  uom: 'CS',
  net: '',
  gross: '',
  weightUnit: '',
  minShelf: '90',
  totalShelf: '180',
  temperature: 'ambient',
  market: 'Region A',
  plantToExtend: ['FAC-04'],
  producing: ['FAC-01'],
  distributing: ['FAC-04'],
  sending: ['FAC-01'],
  shipMtl: 'SHIP-01',
  purchasing: 'BUY-01',
  bomPlant: 'FAC-01',
  bomHeaderUom: 'CAS',
  bomQty: '10000',
  ...overrides,
});

const PRODUCTS = {
  alpha: product({
    sourceIdentifier: 'SRC-001',
    concept: { brand: 'ALPH', variant: 'STD', model: 'MODEL-B', size: 'SIZE-B', container: 'BOX', pack: '12PK' },
    itemCode: 'SKU-A01',
    components: [['MAT-001', '18200'], ['MAT-101', '120000'], ['MAT-102', '120000'], ['MAT-110', '10000']],
    justification: 'Create a sample product with Model B and standard packaging. All components are existing.',
  }),
  beta: product({
    sourceIdentifier: 'SRC-002',
    concept: { brand: 'BETA', variant: 'STD', model: 'MODEL-G', size: 'SIZE-C', container: 'BAG', pack: '24PK' },
    itemCode: 'SKU-A02',
    uom: 'CS',
    bomHeaderUom: 'CS',
    components: [['MAT-008', '21400'], ['MAT-105', '240000'], ['MAT-106', '240000'], ['MAT-114', '10000']],
    justification: 'Create a sample product with Model G and alternate packaging for Region A. All components are existing.',
  }),
  gamma: product({
    sourceIdentifier: 'SRC-003',
    concept: { brand: 'ALPH', model: 'MODEL-C', size: 'SIZE-B', container: 'BOX', pack: '12PK' },
    itemCode: 'SKU-A03',
    components: [['MAT-002', '18200'], ['MAT-101', '120000'], ['MAT-102', '120000'], ['MAT-110', '10000']],
    justification: 'Create a seasonal product variant with Model C. Uses existing components.',
  }),
  delta: product({
    sourceIdentifier: 'SRC-004',
    concept: { brand: 'GAMM', variant: 'STD', model: 'MODEL-D', size: 'SIZE-A', container: 'SMALL BOX', pack: '10PK' },
    itemCode: 'SKU-A04',
    totalShelf: '270',
    minShelf: '120',
    plantToExtend: ['FAC-05', 'FAC-11'],
    producing: ['FAC-03'],
    distributing: ['FAC-05', 'FAC-11'],
    sending: ['FAC-03'],
    shipMtl: 'SHIP-02',
    purchasing: 'BUY-02',
    bomPlant: 'FAC-03',
    components: [['MAT-003', '9600'], ['MAT-103', '100000'], ['MAT-102', '100000'], ['MAT-113', '10000']],
    justification: 'Create a small-format product variant with Model D. Reuses existing components.',
  }),
  epsilon: product({
    sourceIdentifier: 'SRC-005',
    concept: { brand: 'BETA', model: 'MODEL-F', size: 'SIZE-D', container: 'BAG', pack: '12PK' },
    itemCode: 'SKU-A05',
    plantToExtend: ['FAC-06'],
    producing: ['FAC-06'],
    distributing: ['FAC-04'],
    sending: ['FAC-08'],
    purchasing: 'BUY-03',
    bomPlant: 'FAC-06',
    components: [['MAT-004', '16800'], ['MAT-104', '120000'], ['MAT-106', '120000'], ['MAT-107', '120000'], ['MAT-108', '420']],
    justification: 'Expand product capacity at a contract facility. Existing components only.',
  }),
  zeta: product({
    sourceIdentifier: 'SRC-006',
    concept: { brand: 'GAMM', model: 'MODEL-H', size: 'SIZE-B', container: 'BOX', pack: '8PK' },
    itemCode: 'SKU-A06',
    market: 'Region B',
    components: [['MAT-005', '14400'], ['MAT-101', '80000'], ['MAT-102', '80000'], ['MAT-111', '10000']],
    justification: 'Create a Model H product variant for Region B. Uses existing components.',
  }),
  eta: product({
    sourceIdentifier: 'SRC-007',
    concept: { brand: 'DELT', model: 'MODEL-I', size: 'SIZE-B', container: 'BOX', pack: '12PK' },
    itemCode: 'SKU-A07',
    components: [['MAT-006', '13200'], ['MAT-101', '120000'], ['MAT-102', '120000'], ['MAT-110', '10000']],
    justification: 'Extend the product range with Model I in Region A. Existing components only.',
  }),
  theta: product({
    sourceIdentifier: 'SRC-008',
    concept: { brand: 'GAMM', model: 'MODEL-E', size: 'SIZE-C', container: 'BAG', pack: '6PK' },
    itemCode: 'SKU-A08',
    totalShelf: '240',
    minShelf: '120',
    plantToExtend: ['FAC-11'],
    producing: ['FAC-12'],
    distributing: ['FAC-11'],
    sending: ['FAC-12'],
    bomPlant: 'FAC-12',
    // The carton starts as the 8-pack carton, which Execution returns (see C2 below).
    components: [['MAT-007', '9800'], ['MAT-105', '60000'], ['MAT-106', '60000'], ['MAT-111', '10000']],
    justification: 'Create a Model E variant with alternate packaging for Region A. Existing components only.',
  }),
};

/* ------------------------------------------------------------------ helpers */

let counter = 0;
const BASE = Date.UTC(2026, 9, 19, 13, 0, 0);

/** A fixed clock: `at(actor, day, 'HH:mm')` is a deterministic point in October 2026. */
const at = (actor: Actor, day: number, time: string, reference: ReferenceData): DomainContext => {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date(BASE + (day - 19) * 86_400_000 + (hours - 13) * 3_600_000 + minutes * 60_000).toISOString();
  return { now, actor, reference, newId: (prefix) => `${prefix}_s${String(++counter).padStart(3, '0')}` };
};

const must = (result: OpResult): BomRequest => {
  if (!result.ok) throw new Error(`Seed data is inconsistent: ${result.error}`);
  return result.request;
};

const itemOf = <T extends RequestItem>(request: BomRequest, type: ItemType): T => {
  const item = request.items.find((entry) => entry.type === type);
  if (!item) throw new Error(`Seed request ${request.id} has no ${type} item`);
  return item as T;
};

const maybe = (value: string): FieldMap[string] => (value === '' ? undefined : fv(value));

/** The concept attributes as Finished Product Create fields. The domain generates the Material Description from them. */
function conceptFields(concept: Partial<Concept>): FieldMap {
  const fields: FieldMap = {
    conceptBrand: concept.brand ? fv(concept.brand) : undefined,
    conceptVariant: concept.variant ? fv(concept.variant) : undefined,
    conceptModel: concept.model ? fv(concept.model) : undefined,
    conceptPackageSize: concept.size ? fv(concept.size) : undefined,
    conceptContainer: concept.container ? fv(concept.container) : undefined,
    conceptPackConfiguration: concept.pack ? fv(concept.pack) : undefined,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function createFields(p: Product): FieldMap {
  const fields: FieldMap = {
    externalMaterialId: fv(p.sourceIdentifier), // SOURCE_MATERIAL_IDENTIFIER_FIELD
    ...conceptFields(p.concept),
    itemCode: fv(p.itemCode),
    orderableBaseUom: fv(p.uom),
    netWeight: maybe(p.net),
    grossWeight: maybe(p.gross),
    weightUnit: maybe(p.weightUnit),
    minShelfLife: fv(p.minShelf),
    totalShelfLife: fv(p.totalShelf),
    temperatureCondition: fv(p.temperature),
    targetMarket: fv(p.market),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

const extendFields = (p: Product, includeShipMtl = true): FieldMap => ({
  plantToExtend: fv(p.plantToExtend),
  producingPlants: fv(p.producing),
  distributingPlants: fv(p.distributing),
  sendingPlants: fv(p.sending),
  ...(includeShipMtl ? { shippingCategory: fv(p.shipMtl) } : {}),
  purchasingGrp: fv(p.purchasing),
});

function fillCreate(request: BomRequest, p: Product, ctx: DomainContext, fields = createFields(p)): BomRequest {
  const item = itemOf<FertCreateItem>(request, 'finishedGoodsCreate');
  return must(updateItem(request, item.id, { fields: { ...item.data.fields, ...fields } }, ctx));
}

function fillExtend(request: BomRequest, p: Product, ctx: DomainContext, includeShipMtl = true): BomRequest {
  const item = itemOf<ExtendItem>(request, 'extend');
  const rows = item.data.rows.map((row) => ({ ...row, fields: { ...row.fields, ...extendFields(p, includeShipMtl) } }));
  return must(updateItem(request, item.id, { rows }, ctx));
}

function fillBom(request: BomRequest, p: Product, ctx: DomainContext): BomRequest {
  const item = itemOf<FertBomItem>(request, 'finishedGoodsBom');
  const header: FieldMap = {
    ...item.data.header,
    plant: fv(p.bomPlant),
    headerMatlGrp: fv('GRP-01'),
    headerBaseUom: fv(p.bomHeaderUom),
    headerQuantity: fv(p.bomQty),
  };
  const components = p.components.map(([number, quantity], index) => {
    const material = findMaterial(ctx.reference, number);
    if (!material) throw new Error(`Seed component ${number} is missing from the reference data`);
    return { id: item.data.components[index]?.id ?? ctx.newId('cmp'), fields: componentFieldsFromReference(material, quantity) };
  });
  return must(updateItem(request, item.id, { header, components }, ctx));
}

/** Creates a draft on the golden path with Intake done and the template generated. */
function startDraft(id: string, name: string, actor: Actor, day: number, p: Product, reference: ReferenceData): BomRequest {
  let request = { ...createRequest({ name }, at(actor, day, '13:05', reference)), id };
  const c = at(actor, day, '13:20', reference);
  request = must(
    updateRequestDetails(request, { businessNeed: 'newProduct', materialScenario: 'noNewMaterials', context: { businessJustification: fv(p.justification) } }, c),
  );
  request = must(completeIntake(request, c));
  return must(generateInitialItems(request, c));
}

/** A complete, valid draft ready to submit. */
function completeDraft(id: string, name: string, actor: Actor, day: number, p: Product, reference: ReferenceData): BomRequest {
  let request = startDraft(id, name, actor, day, p, reference);
  const c = at(actor, day, '14:10', reference);
  request = fillCreate(request, p, c);
  request = fillExtend(request, p, c);
  return fillBom(request, p, c);
}

const submit = (request: BomRequest, actor: Actor, day: number, time: string, reference: ReferenceData) =>
  must(submitRequest(request, at(actor, day, time, reference)));

/** Synthetic execution identifiers recorded at completion. For Finished Product Create this is the newly assigned Execution Identifier. */
const executionId = (n: number) => `4000${String(18000 + n)}`;

function complete(request: BomRequest, type: ItemType, identifier: string, actor: Actor, day: number, time: string, reference: ReferenceData) {
  return must(completeItem(request, itemOf(request, type).id, at(actor, day, time, reference), { executionIdentifier: identifier }));
}

/* ------------------------------------------------------------------ seed records */

export function buildSeedRequests(reference: ReferenceData = REFERENCE_DATA): Record<string, BomRequest> {
  counter = 0;
  const requests: BomRequest[] = [];

  // Drafts ----------------------------------------------------------------------------------------
  // D1: just started. A simulated Reference Data upload populated the target market; three product attributes are chosen,
  // so the description can't be generated yet.
  {
    const p = PRODUCTS.alpha;
    let r = startDraft('BR-2026-0151', 'Product Launch Beta', DEMO_REQUESTOR_ACTOR, 29, p, reference);
    const c = at(DEMO_REQUESTOR_ACTOR, 29, '15:30', reference);
    r = must(addUpload(r, { fileName: 'product-specification-sample.xlsx', kind: 'referenceDocument', populatedFields: ['targetMarket'] }, c));
    r = fillCreate(r, p, c, {
      ...conceptFields({ brand: p.concept.brand, variant: p.concept.variant, model: p.concept.model }),
      targetMarket: fv(p.market, 'upload', 'product-specification-sample.xlsx'),
    });
    requests.push(must(saveDraft(r, c)));
  }

  // D2: fully drafted with an invalid sample Product Code to demonstrate validation.
  {
    const p = { ...PRODUCTS.beta, itemCode: 'A1' };
    const r = completeDraft('BR-2026-0150', 'Product Configuration Gamma', DEMO_REQUESTOR_ACTOR, 28, p, reference);
    requests.push(must(saveDraft(r, at(DEMO_REQUESTOR_ACTOR, 28, '16:45', reference))));
  }

  // D3: a path that is visible but planned for a future phase. No items are generated.
  {
    const c = at(DEMO_REQUESTOR, 27, '10:15', reference);
    let r = { ...createRequest({ name: 'Future Path Sample' }, c), id: 'BR-2026-0149' };
    r = must(
      updateRequestDetails(r, { businessNeed: 'newProduct', materialScenario: 'allNewMaterials', context: { businessJustification: fv('New product with new components.') } }, c),
    );
    r = must(completeIntake(r, c));
    requests.push(r);
  }

  // Requests --------------------------------------------------------------------------------------
  // R1: Ready for Execution.
  {
    const r = completeDraft('BR-2026-0148', 'Product Launch Delta', DEMO_REQUESTOR_ACTOR, 27, PRODUCTS.gamma, reference);
    requests.push(submit(r, DEMO_REQUESTOR_ACTOR, 27, '15:40', reference));
  }

  // R2: In Progress and partly complete. Finished Product Create is done with its Execution Identifier.
  {
    let r = completeDraft('BR-2026-0146', 'Product Update Epsilon', DEMO_REQUESTOR, 21, PRODUCTS.delta, reference);
    r = submit(r, DEMO_REQUESTOR, 22, '11:30', reference);
    r = must(startExecution(r, at(DEMO_EXECUTOR_ACTOR, 23, '09:05', reference), [itemOf(r, 'finishedGoodsCreate').id, itemOf(r, 'extend').id]));
    r = complete(r, 'finishedGoodsCreate', executionId(412), DEMO_EXECUTOR_ACTOR, 23, '10:20', reference);
    requests.push(r);
  }

  // R3: Action Required. Execution returned the Extend item for a plant issue.
  {
    let r = completeDraft('BR-2026-0145', 'Product Launch Zeta', DEMO_REQUESTOR_ACTOR, 23, PRODUCTS.epsilon, reference);
    r = submit(r, DEMO_REQUESTOR_ACTOR, 23, '14:20', reference);
    r = must(startExecution(r, at(DEMO_EXECUTOR, 26, '09:00', reference)));
    r = complete(r, 'finishedGoodsCreate', executionId(405), DEMO_EXECUTOR, 26, '10:35', reference);
    const input: ReturnInput = {
      scope: 'item',
      itemId: itemOf(r, 'extend').id,
      category: 'plantOrExtension',
      section: 'Plants',
      fieldId: 'producingPlants',
      requiredAction: 'Confirm which plant produces this item. Co-packer FAC-06 isn’t set up to produce it.',
      explanation: 'The co-packer plant can’t be extended for this material type yet.',
    };
    requests.push(must(addReturn(r, input, at(DEMO_EXECUTOR, 26, '11:15', reference))));
  }

  // R4: Returned for missing information, corrected, and resubmitted. Ready again as submission 2.
  {
    const p = PRODUCTS.zeta;
    let r = startDraft('BR-2026-0147', 'Product Configuration Eta', DEMO_REQUESTOR, 20, p, reference);
    const c = at(DEMO_REQUESTOR, 20, '14:30', reference);
    r = fillCreate(r, p, c);
    r = fillExtend(r, p, c, false);
    r = fillBom(r, p, c);
    r = submit(r, DEMO_REQUESTOR, 21, '09:10', reference);
    const extendId = itemOf(r, 'extend').id;
    r = must(
      addReturn(
        r,
        { scope: 'item', itemId: extendId, category: 'missingInformation', section: 'Plants', fieldId: 'shippingCategory', requiredAction: 'Add the Shipping Category (pallet type and cases per pallet).' },
        at(DEMO_EXECUTOR_ACTOR, 22, '13:40', reference),
      ),
    );
    const fix = at(DEMO_REQUESTOR, 23, '08:50', reference);
    const extend = itemOf<ExtendItem>(r, 'extend');
    r = must(updateItem(r, extendId, { rows: extend.data.rows.map((row) => ({ ...row, fields: { ...row.fields, shippingCategory: fv('SHIP-01') } })) }, fix));
    r = must(recordCorrection(r, fix, extendId));
    requests.push(must(resubmitRequest(r, at(DEMO_REQUESTOR, 23, '09:05', reference))));
  }

  // Completed -------------------------------------------------------------------------------------
  // C1: every item completed, each with its Execution Identifier.
  {
    let r = completeDraft('BR-2026-0140', 'Product Update Theta', DEMO_REQUESTOR_ACTOR, 20, PRODUCTS.eta, reference);
    r = submit(r, DEMO_REQUESTOR_ACTOR, 20, '16:00', reference);
    r = must(startExecution(r, at(DEMO_EXECUTOR_ACTOR, 21, '08:30', reference)));
    r = complete(r, 'finishedGoodsCreate', executionId(371), DEMO_EXECUTOR_ACTOR, 21, '09:40', reference);
    r = complete(r, 'extend', executionId(372), DEMO_EXECUTOR_ACTOR, 21, '10:25', reference);
    requests.push(complete(r, 'finishedGoodsBom', executionId(373), DEMO_EXECUTOR_ACTOR, 21, '11:50', reference));
  }

  // C2: a returned BOM component, corrected, resubmitted, then completed. History keeps the whole story.
  {
    const p = PRODUCTS.theta;
    let r = completeDraft('BR-2026-0138', 'Product Configuration Iota', DEMO_REQUESTOR, 19, p, reference);
    r = submit(r, DEMO_REQUESTOR, 19, '15:15', reference);
    r = must(startExecution(r, at(DEMO_EXECUTOR, 20, '09:00', reference)));
    const bomId = itemOf(r, 'finishedGoodsBom').id;
    r = must(
      addReturn(
        r,
        { scope: 'item', itemId: bomId, category: 'invalidReference', section: 'Components', fieldId: 'componentNumber', requiredAction: 'Replace the carton component with the 6-pack carton.', explanation: 'The listed carton is for 8-packs.' },
        at(DEMO_EXECUTOR, 20, '11:10', reference),
      ),
    );
    const bom = itemOf<FertBomItem>(r, 'finishedGoodsBom');
    const fix = at(DEMO_REQUESTOR, 21, '08:40', reference);
    const sixPackCarton = findMaterial(reference, 'MAT-112');
    if (!sixPackCarton) throw new Error('Seed carton 4400212 is missing from the reference data');
    const components = bom.data.components.map((component) =>
      component.fields.componentNumber?.value === 'MAT-111'
        ? { id: component.id, fields: componentFieldsFromReference(sixPackCarton, '10000') }
        : component,
    );
    r = must(updateItem(r, bomId, { header: bom.data.header, components }, fix));
    r = must(recordCorrection(r, fix, bomId));
    r = must(resubmitRequest(r, at(DEMO_REQUESTOR, 21, '08:55', reference)));
    r = must(startExecution(r, at(DEMO_EXECUTOR, 22, '09:15', reference)));
    r = complete(r, 'finishedGoodsCreate', executionId(341), DEMO_EXECUTOR, 22, '10:05', reference);
    r = complete(r, 'extend', executionId(342), DEMO_EXECUTOR, 22, '10:50', reference);
    requests.push(complete(r, 'finishedGoodsBom', executionId(343), DEMO_EXECUTOR, 22, '13:15', reference));
  }

  return Object.fromEntries(requests.map((request) => [request.id, request]));
}
