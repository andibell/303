import { ITEM_DEFS } from '../items/fieldSpecs';
import { fv, refresh, updateItem, updateRequestDetails } from '../requests';
import type { FertCreateItem, FieldMap } from '../types';
import { RULES } from '../validation/rules';
import { buildSeedRequests } from '../../data/seed';
import { itemOf, makeCtx, must, templateDraft } from '../../test/fixtures';
import { composeDescription } from './compose';
import { DESCRIPTION_TEMPLATES, FINISHED_GOODS_DESCRIPTION_CONCEPT as T } from './templates';
import templatesSource from './templates.ts?raw';

const all: FieldMap = {
  conceptBrand: fv('ALPH'),
  conceptVariant: fv('STD'),
  conceptModel: fv('MODEL-A'),
  conceptPackageSize: fv('SIZE-B'),
  conceptContainer: fv('BOX'),
  conceptPackConfiguration: fv('12PK'),
};

describe('product description template (working hypothesis)', () => {
  it('is explicitly an illustrative template with no external source dependency', () => {
    expect(T.status).toBe('hypothesis');
    expect(T.materialType).toBe('finishedGoods');
    expect(T.source.locator).toBe('sample field');
    expect(T.source.document).toMatch(/not included in this public demo/);
    expect(T.override).toBe('none');
    expect(T.overflow).toBe('report');
    expect(T.abbreviations).toBeNull();
    expect(Object.keys(DESCRIPTION_TEMPLATES)).toEqual(['finishedGoods']);
  });

  it('takes its 80-character limit from the field spec rather than defining its own', () => {
    const spec = ITEM_DEFS.finishedGoodsCreate.groups.main?.find((entry) => entry.id === T.targetFieldId);
    expect(spec?.maxLength).toBe(80);
    expect(T.maxLength).toBe(spec?.maxLength);
  });

  it('stays out of the authoritative field requirements and the rule catalog', () => {
    const specIds = Object.values(ITEM_DEFS).flatMap((def) => Object.values(def.groups).flat().map((spec) => spec.id));
    for (const segment of T.segments) {
      expect(specIds).not.toContain(segment.fieldId);
      expect(RULES.some((rule) => rule.id.includes(segment.fieldId))).toBe(false);
    }
    expect(ITEM_DEFS.finishedGoodsCreate.type).toBe('finishedGoodsCreate');
    expect(ITEM_DEFS.finishedGoodsCreate.label).toBe('Finished Product Create');
  });

  it('marks its options as fictional demo data', () => {
    expect(templatesSource).toMatch(/Fictional options/);
  });
});

describe('composeDescription', () => {
  it('builds the description in segment order with the separator and uppercase transform', () => {
    const result = composeDescription(T, all);
    expect(result.value).toBe('ALPH STD MODEL-A SIZE-B BOX 12PK');
    expect(result.parts.map((part) => part.segmentId)).toEqual(['brand', 'variant', 'model', 'packageSize', 'container', 'pack']);
    expect(result).toMatchObject({ complete: true, length: 32, maxLength: 80, overBy: 0, missing: [] });
  });

  it.each([
    ['conceptBrand', 'BETA', 'BETA STD MODEL-A SIZE-B BOX 12PK'],
    ['conceptVariant', 'ADV', 'ALPH ADV MODEL-A SIZE-B BOX 12PK'],
    ['conceptModel', 'MODEL-B', 'ALPH STD MODEL-B SIZE-B BOX 12PK'],
    ['conceptPackageSize', 'SIZE-C', 'ALPH STD MODEL-A SIZE-C BOX 12PK'],
    ['conceptContainer', 'BAG', 'ALPH STD MODEL-A SIZE-B BAG 12PK'],
    ['conceptPackConfiguration', '24PK', 'ALPH STD MODEL-A SIZE-B BOX 24PK'],
  ])('lets %s contribute its token at its own position', (fieldId, code, expected) => {
    expect(composeDescription(T, { ...all, [fieldId]: fv(code) }).value).toBe(expected);
  });

  it('leaves out an optional segment that is not chosen', () => {
    const { conceptVariant: _omit, ...rest } = all;
    void _omit;
    expect(composeDescription(T, rest).value).toBe('ALPH MODEL-A SIZE-B BOX 12PK');
  });

  it('is incomplete, with placeholders and the missing attributes, until every required segment is chosen', () => {
    const result = composeDescription(T, { conceptBrand: fv('ALPH'), conceptModel: fv('MODEL-A') });
    expect(result).toMatchObject({ complete: false, value: null, length: 0 });
    expect(result.preview).toBe('ALPH MODEL-A [Package size] [Container type] [Pack configuration]');
    expect(result.missing).toEqual(['Package size', 'Container type', 'Pack configuration']);
  });

  it('ignores a value that is not one of the segment options', () => {
    expect(composeDescription(T, { ...all, conceptBrand: fv('NOT-A-BRAND') }).complete).toBe(false);
  });

  it('keeps the complete generated value without truncation', () => {
    const result = composeDescription(T, { ...all, conceptBrand: fv('BETA'), conceptModel: fv('MODEL-J'), conceptPackageSize: fv('SIZE-C'), conceptContainer: fv('BAG'), conceptPackConfiguration: fv('24PK') });
    expect(result.value).toBe('BETA STD MODEL-J SIZE-C BAG 24PK');
    expect(result).toMatchObject({ complete: true, length: 32, overBy: 0 });
  });

  it('is deterministic', () => {
    expect(composeDescription(T, all)).toEqual(composeDescription(T, { ...all }));
  });
});

describe('generated Material Description in the draft', () => {
  const withFields = (extra: FieldMap) => {
    const { request, ctx } = templateDraft();
    const create = itemOf<FertCreateItem>(request, 'finishedGoodsCreate');
    return { ctx, next: must(updateItem(request, create.id, { fields: { ...create.data.fields, ...extra } }, ctx())) };
  };
  const createOf = (request: Parameters<typeof itemOf>[0]) => itemOf<FertCreateItem>(request, 'finishedGoodsCreate');

  it('is generated by the domain and marked system-generated', () => {
    const { next } = withFields(all);
    expect(createOf(next).data.fields.materialDescription).toEqual({ value: 'ALPH STD MODEL-A SIZE-B BOX 12PK', provenance: 'derived', sourceRef: T.id });
  });

  it('is cleared again when a required attribute is removed', () => {
    const { next, ctx } = withFields(all);
    const { conceptModel: _removed, ...rest } = createOf(next).data.fields;
    void _removed;
    const after = must(updateItem(next, createOf(next).id, { fields: rest }, ctx()));
    expect(createOf(after).data.fields.materialDescription).toBeUndefined();
  });

  it('never overwrites a description that was typed', () => {
    const { next } = withFields({ ...all, materialDescription: fv('TYPED BEFORE') });
    expect(createOf(next).data.fields.materialDescription).toEqual({ value: 'TYPED BEFORE', provenance: 'user' });
  });

  it('leaves Request Name and Execution Identifier alone', () => {
    const { next } = withFields({ ...all, externalMaterialId: fv('900123') });
    expect(next.name).toBe('Test product');
    expect(createOf(next).data.fields.externalMaterialId).toEqual({ value: '900123', provenance: 'user' });
  });

  it('does not add validation rules of its own', () => {
    const { next } = withFields({ ...all, conceptBrand: fv('BETA'), conceptModel: fv('MODEL-J'), conceptPackageSize: fv('SIZE-C'), conceptContainer: fv('BAG'), conceptPackConfiguration: fv('24PK') });
    const issues = createOf(next).issues;
    expect(issues.filter((issue) => issue.fieldId === 'materialDescription')).toHaveLength(0);
    expect(issues.some((issue) => issue.fieldId?.startsWith('concept'))).toBe(false);
    expect(createOf(next).completeness).toBe('inProgress');
  });

  it('makes no concept attribute required: without them, only the authoritative "required" rule applies', () => {
    const { request } = templateDraft();
    const ruleIds = createOf(request).issues.filter((issue) => issue.fieldId === 'materialDescription').map((issue) => issue.ruleId);
    expect(ruleIds).toEqual(['finishedGoodsCreate.materialDescription.required']);
  });

  it('is reproduced exactly after the draft is stored and reloaded', () => {
    const { next } = withFields(all);
    const reloaded = refresh(JSON.parse(JSON.stringify(next)), makeCtx()());
    expect(createOf(reloaded).data.fields.materialDescription).toEqual(createOf(next).data.fields.materialDescription);
  });

  it('survives unrelated request edits', () => {
    const { next, ctx } = withFields(all);
    const renamed = must(updateRequestDetails(next, { name: 'Future Path Sample' }, ctx()));
    expect(createOf(renamed).data.fields.materialDescription?.value).toBe('ALPH STD MODEL-A SIZE-B BOX 12PK');
  });

  it('is generated for seeded drafts within the generic field limit', () => {
    const seed = buildSeedRequests();
    expect(createOf(seed['BR-2026-0151']).data.fields.materialDescription).toBeUndefined(); // attributes incomplete
    const orchard = createOf(seed['BR-2026-0150']).data.fields.materialDescription;
    expect(orchard).toMatchObject({ value: 'BETA STD MODEL-G SIZE-C BAG 24PK', provenance: 'derived' });
    expect(String(orchard?.value).length).toBe(32);
  });
});
