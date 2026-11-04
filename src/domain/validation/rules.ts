import { isFunctionalPath } from '../businessNeeds';
import type { Choice } from '../referenceTypes';
import { findMaterial, findPlant } from '../referenceTypes';
import { brief, fieldRequirements } from '../sources';
import { fieldGroups, isBlank, listOf, textOf, type FieldGroup } from '../items/accessors';
import { ITEM_DEFS, type FieldSpec } from '../items/fieldSpecs';
import type { BomRequest, ItemType, RequestItem } from '../types';
import type { RuleFinding, ValidationRule } from './types';

/*
 * The active rule catalog. Two kinds of rule:
 *  1. Generated from field specs (required, length, format, enumerations, lookups).
 *  2. Hand-written rules for request-level and cross-item logic, each with its own citation.
 *
 * Additional cross-field checks are intentionally omitted from this generic demonstration.
 */

const PLANT_CODE = /^[A-Z0-9-]{2,12}$/i;

const itemsOf = (request: BomRequest, type: ItemType) => request.items.filter((item) => item.type === type);

function eachSpecField(
  request: BomRequest,
  type: ItemType,
  spec: FieldSpec,
  visit: (item: RequestItem, group: FieldGroup) => RuleFinding | RuleFinding[] | null,
): RuleFinding[] {
  const findings: RuleFinding[] = [];
  for (const item of itemsOf(request, type)) {
    for (const group of fieldGroups(item)) {
      if (!group.specs.includes(spec)) continue;
      const result = visit(item, group);
      if (result) findings.push(...(Array.isArray(result) ? result : [result]));
    }
  }
  return findings;
}

const locate = (item: RequestItem, group: FieldGroup, spec: FieldSpec) => ({
  itemId: item.id,
  rowId: group.rowId,
  section: spec.section,
  fieldId: spec.id,
});

const choiceLabels = (choices: Choice[]) => choices.map((choice) => choice.label).join(', ');

function generatedRules(type: ItemType): ValidationRule[] {
  const rules: ValidationRule[] = [];
  const specs = Object.values(ITEM_DEFS[type].groups).flat();

  for (const spec of specs) {
    const base = { appliesTo: type, source: spec.source, phase: 'authoring' as const };
    const id = (check: string) => `${type}.${spec.id}.${check}`;

    if (spec.requirement !== 'optional') {
      const required = spec.requirement === 'required';
      rules.push({
        ...base,
        id: id(required ? 'required' : 'expected'),
        description: required
          ? `${spec.label} must be provided.`
          : `${spec.label} is expected, but the source leaves its requirement ambiguous, so a gap is a warning.`,
        severity: required ? 'error' : 'warning',
        category: 'missing',
        evaluate: ({ request }) =>
          eachSpecField(request, type, spec, (item, group) =>
            (spec.appliesWhen?.(request) ?? true) && isBlank(group.fields[spec.id])
              ? {
                  ...locate(item, group, spec),
                  message: required
                    ? `${spec.label} is required.`
                    : `${spec.label} hasn’t been entered yet. This field is expected for the item.`,
                }
              : null,
          ),
      });
    }

    if (spec.maxLength !== undefined) {
      const max = spec.maxLength;
      rules.push({
        ...base,
        id: id('maxLength'),
        description: `${spec.label} can be at most ${max} characters.`,
        severity: 'error',
        category: 'invalid',
        evaluate: ({ request }) =>
          eachSpecField(request, type, spec, (item, group) => {
            const length = textOf(group.fields[spec.id]).length;
            return length > max
              ? { ...locate(item, group, spec), message: `${spec.label} can be at most ${max} characters (currently ${length}).` }
              : null;
          }),
      });
    }

    if (spec.exactLength !== undefined) {
      const exact = spec.exactLength;
      rules.push({
        ...base,
        id: id('length'),
        description: `${spec.label} must be exactly ${exact} characters.`,
        severity: 'error',
        category: 'invalid',
        evaluate: ({ request }) =>
          eachSpecField(request, type, spec, (item, group) => {
            const value = textOf(group.fields[spec.id]);
            return value !== '' && value.length !== exact
              ? { ...locate(item, group, spec), message: `${spec.label} must be ${exact} characters.` }
              : null;
          }),
      });
    }

    if (spec.pattern) {
      const { regex, message } = spec.pattern;
      rules.push({
        ...base,
        id: id('format'),
        description: `${spec.label} must match the documented format.`,
        severity: 'error',
        category: 'invalid',
        evaluate: ({ request }) =>
          eachSpecField(request, type, spec, (item, group) => {
            const value = textOf(group.fields[spec.id]);
            return value !== '' && !regex.test(value) ? { ...locate(item, group, spec), message } : null;
          }),
      });
    }

    if (spec.input === 'plantList' || spec.input === 'plant') {
      rules.push({
        ...base,
        id: id('format'),
        description: `${spec.label} entries must use a valid facility identifier.`,
        source: spec.source,
        severity: 'error',
        category: 'invalid',
        evaluate: ({ request }) =>
          eachSpecField(request, type, spec, (item, group) => {
            const bad = listOf(group.fields[spec.id]).filter((code) => !PLANT_CODE.test(code));
            return bad.length > 0
              ? { ...locate(item, group, spec), message: `${spec.label}: ${bad.join(', ')} ${bad.length > 1 ? 'aren’t' : 'isn’t'} a valid facility identifier.` }
              : null;
          }),
      });
    }

    if (spec.choices) {
      const list = spec.choices;
      rules.push({
        ...base,
        id: id('allowedValues'),
        description: `${spec.label} must be one of the documented values.`,
        severity: 'error',
        category: 'invalid',
        evaluate: ({ request, reference }) =>
          eachSpecField(request, type, spec, (item, group) => {
            const value = textOf(group.fields[spec.id]);
            const allowed = reference[list];
            return value !== '' && !allowed.some((choice) => choice.id === value)
              ? { ...locate(item, group, spec), message: `${spec.label} must be one of: ${choiceLabels(allowed)}.` }
              : null;
          }),
      });
    }

    if (spec.lookup) {
      const { list, severity } = spec.lookup;
      rules.push({
        ...base,
        id: id('lookup'),
        description: `${spec.label} is checked against the representative ${list} reference data.`,
        severity,
        category: 'invalid',
        evaluate: ({ request, reference }) =>
          eachSpecField(request, type, spec, (item, group) => {
            const values = listOf(group.fields[spec.id]);
            const missing = values.filter((value) => {
              if (list === 'plants') return PLANT_CODE.test(value) && !findPlant(reference, value);
              if (list === 'materials') return !findMaterial(reference, value);
              return !reference.bomUoms.some((uom) => uom.id === value);
            });
            if (missing.length === 0) return null;
            const where = locate(item, group, spec);
            if (list === 'plants') return { ...where, message: `Plant ${missing.join(', ')} isn’t in the reference plant list.` };
            if (list === 'materials') {
              return {
                ...where,
                message: `Material ${missing.join(', ')} isn’t in the reference material list. A No New Materials request can only use existing materials.`,
              };
            }
            return { ...where, message: `${missing.join(', ')} isn’t in the representative unit list. Check it before submitting.` };
          }),
      });
    }
  }
  return rules;
}

const pairRule = (
  type: 'finishedGoodsBom',
  id: string,
  quantity: string,
  unit: string,
  groupName: 'header' | 'component',
  quantityLabel: string,
  unitLabel: string,
): ValidationRule => ({
  id,
  description: `${quantityLabel} needs a ${unitLabel}.`,
  severity: 'error',
  category: 'consistency',
  phase: 'authoring',
  appliesTo: type,
  source: fieldRequirements('sample field'),
  evaluate: ({ request }) => {
    const findings: RuleFinding[] = [];
    for (const item of itemsOf(request, type)) {
      for (const group of fieldGroups(item)) {
        if (group.groupId !== groupName) continue;
        if (!isBlank(group.fields[quantity]) && isBlank(group.fields[unit])) {
          findings.push({
            itemId: item.id,
            rowId: group.rowId,
            section: groupName === 'header' ? 'BOM header' : 'Components',
            fieldId: unit,
            message: `${unitLabel} is required when ${quantityLabel} is entered.`,
          });
        }
      }
    }
    return findings;
  },
});

const requestRules: ValidationRule[] = [
  {
    id: 'request.businessNeed.selected',
    description: 'A Business Need must be selected.',
    severity: 'error',
    category: 'missing',
    phase: 'authoring',
    appliesTo: 'request',
    source: brief('sample field'),
    evaluate: ({ request }) =>
      request.businessNeed ? [] : [{ section: 'Intake', fieldId: 'businessNeed', message: 'Select a business need.' }],
  },
  {
    id: 'request.materialScenario.selected',
    description: 'A material scenario must be selected.',
    severity: 'error',
    category: 'missing',
    phase: 'authoring',
    appliesTo: 'request',
    source: brief('sample field'),
    evaluate: ({ request }) =>
      request.materialScenario ? [] : [{ section: 'Intake', fieldId: 'materialScenario', message: 'Select a material scenario.' }],
  },
  {
    id: 'request.supportedPath',
    description: 'Only New Product / Innovation with No New Materials is functional in the POC.',
    severity: 'error',
    category: 'consistency',
    phase: 'authoring',
    appliesTo: 'request',
    source: brief('sample field'),
    evaluate: ({ request }) =>
      request.businessNeed && request.materialScenario && !isFunctionalPath(request.businessNeed, request.materialScenario)
        ? [
            {
              section: 'Intake',
              fieldId: 'materialScenario',
              message: 'This combination is planned for a future phase of the pilot and can’t be submitted yet.',
            },
          ]
        : [],
  },
  {
    id: 'request.businessJustification.required',
    description: 'Business Justification / Request Details is mandatory for every Create and Extend item.',
    severity: 'error',
    category: 'missing',
    phase: 'authoring',
    appliesTo: 'request',
    source: fieldRequirements('sample field'),
    evaluate: ({ request }) =>
      isBlank(request.context.businessJustification)
        ? [{ section: 'Intake', fieldId: 'businessJustification', message: 'Business justification is required.' }]
        : [],
  },
];

const crossItemRules: ValidationRule[] = [
  {
    id: 'finishedGoodsCreate.bomSetup.consistency',
    description: 'If a Product Bill of Materials is needed, either complete the Product Bill of Materials item or provide the reference guide link.',
    severity: 'error',
    category: 'consistency',
    phase: 'submission',
    appliesTo: 'finishedGoodsCreate',
    source: fieldRequirements('sample field'),
    evaluate: ({ request }) => {
      const hasBomItem = itemsOf(request, 'finishedGoodsBom').length > 0;
      return itemsOf(request, 'finishedGoodsCreate').flatMap((item) =>
        item.type === 'finishedGoodsCreate' &&
        item.data.fields.finishedGoodsBomSetupNeeded?.value === 'Y' &&
        !hasBomItem &&
        isBlank(item.data.fields.referenceGuideLink)
          ? [
              {
                itemId: item.id,
                section: 'Market and BOM setup',
                fieldId: 'referenceGuideLink',
                message: 'Product Bill of Materials setup is needed. Add the Product Bill of Materials item or provide the reference guide link.',
              },
            ]
          : [],
      );
    },
  },
];

export const RULES: readonly ValidationRule[] = [
  ...requestRules,
  ...(['finishedGoodsCreate', 'extend', 'finishedGoodsBom'] as const).flatMap(generatedRules),
  ...crossItemRules,
  pairRule('finishedGoodsBom', 'finishedGoodsBom.headerQuantity.requiresUnit', 'headerQuantity', 'headerBaseUom', 'header', 'Header Quantity', 'Header Base UoM'),
  pairRule('finishedGoodsBom', 'finishedGoodsBom.componentQty.requiresUnit', 'componentQty', 'componentBaseUom', 'component', 'Component Qty', 'Component Base U of M'),
];
