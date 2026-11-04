import type { FieldMap, FieldValue, RequestItem } from '../types';
import { ITEM_DEFS, type FieldSpec, type GroupId } from './fieldSpecs';

/** A set of fields that share one list of specs: a form, an Extend row, the BOM header, a component. */
export interface FieldGroup {
  groupId: GroupId;
  rowId?: string;
  fields: FieldMap;
  specs: FieldSpec[];
}

export function fieldGroups(item: RequestItem): FieldGroup[] {
  const defs = ITEM_DEFS[item.type].groups;
  switch (item.type) {
    case 'finishedGoodsCreate':
      return [{ groupId: 'main', fields: item.data.fields, specs: defs.main ?? [] }];
    case 'extend':
      return item.data.rows.map((row) => ({ groupId: 'row', rowId: row.id, fields: row.fields, specs: defs.row ?? [] }));
    case 'finishedGoodsBom':
      return [
        { groupId: 'header', fields: item.data.header, specs: defs.header ?? [] },
        ...item.data.components.map((component) => ({
          groupId: 'component' as const,
          rowId: component.id,
          fields: component.fields,
          specs: defs.component ?? [],
        })),
      ];
  }
}

export function isBlank(value: FieldValue | undefined): boolean {
  if (!value) return true;
  return Array.isArray(value.value) ? value.value.length === 0 : value.value.trim() === '';
}

export const textOf = (value: FieldValue | undefined): string =>
  value ? (Array.isArray(value.value) ? value.value.join(', ') : value.value.trim()) : '';

export const listOf = (value: FieldValue | undefined): string[] =>
  !value ? [] : Array.isArray(value.value) ? value.value : value.value.trim() === '' ? [] : [value.value.trim()];

/** Number of characters in the System material description (the form's calculated "Description Characters"). */
export const descriptionLength = (value: FieldValue | undefined): number => (value ? textOf(value).length : 0);

/** True when the user (not the system) has entered something in the item. Derived values don't count. */
export function hasUserContent(item: RequestItem): boolean {
  return fieldGroups(item).some((group) =>
    Object.values(group.fields).some((value) => !isBlank(value) && value?.provenance !== 'derived'),
  );
}

/** Replaces one field. Pass `rowId` for Extend rows and BOM components. */
export function withField(
  item: RequestItem,
  groupId: GroupId,
  fieldId: string,
  value: FieldValue | undefined,
  rowId?: string,
): RequestItem {
  const set = (fields: FieldMap): FieldMap => {
    const next = { ...fields };
    if (value === undefined) delete next[fieldId];
    else next[fieldId] = value;
    return next;
  };
  switch (item.type) {
    case 'finishedGoodsCreate':
      return { ...item, data: { fields: set(item.data.fields) } };
    case 'extend':
      return { ...item, data: { rows: item.data.rows.map((row) => (row.id === rowId ? { ...row, fields: set(row.fields) } : row)) } };
    case 'finishedGoodsBom':
      return groupId === 'header'
        ? { ...item, data: { ...item.data, header: set(item.data.header) } }
        : {
            ...item,
            data: {
              ...item.data,
              components: item.data.components.map((c) => (c.id === rowId ? { ...c, fields: set(c.fields) } : c)),
            },
          };
  }
}
