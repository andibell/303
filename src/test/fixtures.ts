import { REFERENCE_DATA } from '../data/reference';
import { componentFieldsFromReference } from '../domain/items/bom';
import type { DomainContext } from '../domain/history';
import { findMaterial } from '../domain/referenceTypes';
import {
  completeIntake,
  createRequest,
  fv,
  generateInitialItems,
  updateItem,
  updateRequestDetails,
  type OpResult,
} from '../domain/requests';
import type { Actor, BomRequest, ExtendItem, FertBomItem, FertCreateItem, ItemType, RequestItem } from '../domain/types';

export const REQUESTOR: Actor = { id: 'test-requestor', name: 'Test Requestor', role: 'requestor' };
export const EXECUTOR: Actor = { id: 'test-executor', name: 'Test Executor', role: 'executionSpecialist' };

/** A deterministic context: fixed clock that advances a minute per call, sequential ids. */
export function makeCtx(actor: Actor = REQUESTOR, start = '2026-10-01T10:00:00.000Z') {
  let ids = 0;
  let minutes = 0;
  const base = Date.parse(start);
  return (as: Actor = actor): DomainContext => ({
    now: new Date(base + minutes++ * 60_000).toISOString(),
    actor: as,
    reference: REFERENCE_DATA,
    newId: (prefix) => `${prefix}_${++ids}`,
  });
}

export const must = (result: OpResult): BomRequest => {
  if (!result.ok) throw new Error(result.error);
  return result.request;
};

export const itemOf = <T extends RequestItem = RequestItem>(request: BomRequest, type: ItemType): T => {
  const item = request.items.find((entry) => entry.type === type);
  if (!item) throw new Error(`no ${type} item`);
  return item as T;
};

/** Golden-path draft with Intake complete and the template generated, nothing filled in. */
export function templateDraft(ctx = makeCtx()): { request: BomRequest; ctx: ReturnType<typeof makeCtx> } {
  let request = createRequest({ name: 'Test product' }, ctx());
  request = must(
    updateRequestDetails(
      request,
      { businessNeed: 'newProduct', materialScenario: 'noNewMaterials', context: { businessJustification: fv('Launch test product.') } },
      ctx(),
    ),
  );
  request = must(completeIntake(request, ctx()));
  request = must(generateInitialItems(request, ctx()));
  return { request, ctx };
}

/** A fully filled draft with no blocking issues. */
export function validDraft(ctx = makeCtx()): { request: BomRequest; ctx: ReturnType<typeof makeCtx> } {
  let { request } = templateDraft(ctx);

  const create = itemOf<FertCreateItem>(request, 'finishedGoodsCreate');
  request = must(
    updateItem(
      request,
      create.id,
      {
        fields: {
          ...create.data.fields,
          externalMaterialId: fv('900001'),
          materialDescription: fv('TEST MODEL-B SIZE-B BOX 12PK'),
          itemCode: fv('10000000000017'),
          orderableBaseUom: fv('CS'),
          minShelfLife: fv('90'),
          totalShelfLife: fv('180'),
          temperatureCondition: fv('ambient'),
          targetMarket: fv('Region A'),
        },
      },
      ctx(),
    ),
  );

  const extend = itemOf<ExtendItem>(request, 'extend');
  request = must(
    updateItem(
      request,
      extend.id,
      {
        rows: extend.data.rows.map((row) => ({
          ...row,
          fields: {
            ...row.fields,
            plantToExtend: fv(['FAC-04']),
            producingPlants: fv(['FAC-01']),
            distributingPlants: fv(['FAC-04']),
            sendingPlants: fv(['FAC-01']),
            shippingCategory: fv('SHIP-01'),
            purchasingGrp: fv('BUY-01'),
          },
        })),
      },
      ctx(),
    ),
  );

  const bom = itemOf<FertBomItem>(request, 'finishedGoodsBom');
  const material = findMaterial(REFERENCE_DATA, 'MAT-001');
  const can = findMaterial(REFERENCE_DATA, 'MAT-101');
  if (!material || !can) throw new Error('fixture materials missing');
  request = must(
    updateItem(
      request,
      bom.id,
      {
        header: { ...bom.data.header, plant: fv('FAC-01'), headerMatlGrp: fv('GRP-01'), headerBaseUom: fv('CAS'), headerQuantity: fv('10000') },
        components: [
          { id: bom.data.components[0].id, fields: componentFieldsFromReference(material, '18200') },
          { id: 'cmp_extra', fields: componentFieldsFromReference(can, '120000') },
        ],
      },
      ctx(),
    ),
  );
  return { request, ctx };
}

/** Recursively freezes a value so any in-place mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
