import { REFERENCE_DATA } from '../../data/reference';
import { DESCRIPTION_TEMPLATES } from '../../domain/description/templates';
import { fieldGroups, isBlank, listOf, textOf, type FieldGroup } from '../../domain/items/accessors';
import type { FieldSpec } from '../../domain/items/fieldSpecs';
import { itemBusinessName } from '../../domain/items/itemNames';
import { findPlant } from '../../domain/referenceTypes';
import type { BomRequest, FieldValue, RequestItem, ValidationIssue } from '../../domain/types';
import { FINISHED_GOODS_CREATE_SECTIONS } from '../setup/editors/fertCreateLayout';

/*
 * Read-only presentation for Review & Submit. It words what the request already holds and what the domain's
 * submission review reports; nothing here decides what is valid.
 */

export interface ReviewField {
  id: string;
  label: string;
  text: string;
  value: FieldValue;
  fromReference: boolean;
}

export interface ReviewGroup {
  key: string;
  title: string;
  fields: ReviewField[];
}

const CREATE_SECTION_ORDER = FINISHED_GOODS_CREATE_SECTIONS.map((entry) => entry.section);
const CREATE_SECTION_TITLES = new Map(FINISHED_GOODS_CREATE_SECTIONS.map((entry) => [entry.section, entry.title]));

function displayText(spec: FieldSpec, value: FieldValue): string {
  if (spec.choices) {
    const raw = textOf(value);
    return REFERENCE_DATA[spec.choices].find((choice) => choice.id === raw)?.label ?? raw;
  }
  if (spec.input === 'plantList' || spec.input === 'plant') {
    return listOf(value)
      .map((code) => {
        const plant = findPlant(REFERENCE_DATA, code);
        return plant ? `${code} · ${plant.name}` : code;
      })
      .join(', ');
  }
  return textOf(value);
}

function specFields(group: FieldGroup): Map<string, ReviewField[]> {
  const sections = new Map<string, ReviewField[]>();
  for (const spec of group.specs) {
    if (spec.shownWhen && !spec.shownWhen.test(group.fields)) continue;
    const value = group.fields[spec.id];
    if (!value || isBlank(value)) continue;
    const field = { id: spec.id, label: spec.label, text: displayText(spec, value), value, fromReference: spec.origin === 'reference' };
    sections.set(spec.section, [...(sections.get(spec.section) ?? []), field]);
  }
  return sections;
}

/** The description builder's attributes, which live in the item's fields but aren't spec fields. */
function conceptFields(group: FieldGroup): ReviewField[] {
  const template = DESCRIPTION_TEMPLATES.finishedGoods;
  if (!template) return [];
  return template.segments.flatMap((segment) => {
    const value = group.fields[segment.fieldId];
    if (!value || isBlank(value)) return [];
    const raw = textOf(value);
    return [{ id: segment.fieldId, label: segment.label, text: segment.options.find((o) => o.id === raw)?.label ?? raw, value, fromReference: false }];
  });
}

/** An item's entered and generated values, grouped as the user knows them. Blank and hidden fields are left out. */
export function reviewGroups(item: RequestItem): ReviewGroup[] {
  const groups = fieldGroups(item);

  if (item.type === 'finishedGoodsCreate') {
    const [main] = groups;
    const sections = specFields(main);
    const concept = conceptFields(main);
    if (concept.length > 0) sections.set('Product information', concept);
    return CREATE_SECTION_ORDER.flatMap((section) => {
      const fields = sections.get(section);
      return fields ? [{ key: section, title: CREATE_SECTION_TITLES.get(section) ?? section, fields }] : [];
    });
  }

  const rows = groups.filter((group) => group.groupId === 'row').length;
  let component = 0;
  let row = 0;
  return groups.flatMap((group) => {
    if (group.groupId === 'component') component += 1;
    if (group.groupId === 'row') row += 1;
    return [...specFields(group)].map(([section, fields]) => ({
      key: `${group.rowId ?? group.groupId}-${section}`,
      title:
        group.groupId === 'component' ? `Component ${component}` : group.groupId === 'row' && rows > 1 ? `Material ${row} · ${section}` : section,
      fields,
    }));
  });
}

export interface IssueGroup {
  key: string;
  title: string;
  /** Where the issues can be fixed. */
  to: string;
  linkLabel: string;
  messages: string[];
}

/** Blocking issues grouped by where they are fixed: a Request Item in Request Setup, or Intake. */
export function blockingIssueGroups(request: BomRequest, issues: ValidationIssue[]): IssueGroup[] {
  const base = `/requests/${request.id}`;
  const groups = new Map<string, IssueGroup>();
  for (const issue of issues.filter((entry) => entry.blocking)) {
    const item = issue.itemId ? request.items.find((entry) => entry.id === issue.itemId) : undefined;
    const target: Omit<IssueGroup, 'messages'> = item
      ? { key: item.id, title: itemBusinessName(item.type), to: `${base}/setup/${item.id}`, linkLabel: `Edit ${itemBusinessName(item.type)}` }
      : issue.section === 'Intake'
        ? { key: 'intake', title: 'Intake', to: `${base}/intake`, linkLabel: 'Edit in Intake' }
        : { key: 'request', title: 'Request', to: `${base}/setup`, linkLabel: 'Edit Request Details' };
    const group = groups.get(target.key) ?? { ...target, messages: [] };
    if (!group.messages.includes(issue.message)) group.messages.push(issue.message);
    groups.set(target.key, group);
  }
  return [...groups.values()];
}
