import type { ReferenceMaterial } from '../referenceTypes';
import { isBlank, textOf } from './accessors';
import type { BomComponent, FieldMap } from '../types';

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

/**
 * The component after the user picks (or clears) its material. Description, type and group follow the reference
 * material; the quantity the user typed is kept. The unit defaults to the material's own unit unless the user chose
 * a different one, and priority keeps its value (or the default). Clearing the material keeps the quantity and a unit the
 * user chose, so changing a material by clearing it first doesn't lose them.
 */
export function selectComponentMaterial(component: BomComponent, material: ReferenceMaterial | null): BomComponent {
  const { componentQty, componentBaseUom, priority } = component.fields;
  if (!material) {
    const keptUnit = componentBaseUom?.provenance === 'user' && !isBlank(componentBaseUom) ? { componentBaseUom } : {};
    const kept: FieldMap = { ...(componentQty && !isBlank(componentQty) ? { componentQty } : {}), ...keptUnit };
    return { id: component.id, fields: kept };
  }
  const userUnit = componentBaseUom?.provenance === 'user' && !isBlank(componentBaseUom) ? textOf(componentBaseUom) : undefined;
  const fields = componentFieldsFromReference(material, textOf(componentQty), {
    unit: userUnit,
    priority: priority && !isBlank(priority) ? textOf(priority) : undefined,
  });
  if (isBlank(componentQty)) delete fields.componentQty;
  return { id: component.id, fields };
}
