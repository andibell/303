import type { ReferenceMaterial } from '../referenceTypes';
import type { FieldMap } from '../types';

/**
 * Builds a BOM component row from a reference material: the number is the user’s choice, and the
 * description, type, group and default unit come from the reference data rather than being re-entered
 * Quantity and priority are provided by the user.
 */
export function componentFieldsFromReference(
  material: ReferenceMaterial,
  quantity: string,
  options: { unit?: string; priority?: string } = {},
): FieldMap {
  const fromReference = (value: string) => ({ value, provenance: 'reference' as const, sourceRef: material.number });
  return {
    componentNumber: { value: material.number, provenance: 'user' },
    componentDescription: fromReference(material.description),
    componentMatlType: fromReference(material.type),
    componentMatlGrp: fromReference(material.materialGroup),
    componentQty: { value: quantity, provenance: 'user' },
    componentBaseUom: { value: options.unit ?? material.baseUom, provenance: options.unit ? 'user' : 'reference', sourceRef: material.number },
    priority: { value: options.priority ?? '1', provenance: 'user' },
  };
}
