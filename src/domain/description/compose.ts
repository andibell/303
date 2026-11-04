import { textOf } from '../items/accessors';
import type { FieldMap } from '../types';
import type { DescriptionTemplate } from './templates';

export interface DescriptionPart {
  segmentId: string;
  label: string;
  required: boolean;
  /** The token this segment contributes, or null when nothing is chosen. */
  token: string | null;
}

export interface DescriptionResult {
  templateId: string;
  /** Complete once every required segment has a value. */
  complete: boolean;
  /** The generated description, only when complete. Never shortened. */
  value: string | null;
  /** The description so far with [Label] placeholders for missing required segments (optional ones are left out). */
  preview: string;
  parts: DescriptionPart[];
  /** Labels of required segments still to choose, in order. */
  missing: string[];
  length: number;
  maxLength: number;
  /** Characters over the limit; 0 when within it. */
  overBy: number;
}

/**
 * Builds the description from the item's fields: deterministic, in segment order, with the template's separator and
 * transform. It reports an over-long result as it is: no truncation and no abbreviation (none is documented).
 */
export function composeDescription(template: DescriptionTemplate, fields: FieldMap): DescriptionResult {
  const parts: DescriptionPart[] = template.segments.map((segment) => {
    const chosen = textOf(fields[segment.fieldId]);
    const option = segment.options.find((entry) => entry.id === chosen);
    const raw = option ? (option.code ?? option.id) : null;
    return {
      segmentId: segment.id,
      label: segment.label,
      required: segment.required,
      token: raw === null ? null : template.transform === 'upper' ? raw.toUpperCase() : raw,
    };
  });
  const missing = parts.filter((part) => part.required && part.token === null).map((part) => part.label);
  const complete = missing.length === 0;
  const tokens = parts.flatMap((part) => (part.token === null ? [] : [part.token]));
  const value = complete ? tokens.join(template.separator) : null;
  const preview = parts
    .flatMap((part) => (part.token !== null ? [part.token] : part.required ? [`[${part.label}]`] : []))
    .join(template.separator);
  const length = value?.length ?? 0;
  return {
    templateId: template.id,
    complete,
    value,
    preview,
    parts,
    missing,
    length,
    maxLength: template.maxLength,
    overBy: Math.max(0, length - template.maxLength),
  };
}
