import { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { ReferenceIndicator } from '../../../components/provenance/ReferenceIndicator';
import { SourceNote } from '../../../components/provenance/SourceNote';
import { REFERENCE_DATA_PHRASE, sourceNoteFor } from '../../../components/provenance/provenance';
import { REFERENCE_DATA } from '../../../data/reference';
import { isBlank, textOf, withField } from '../../../domain/items/accessors';
import { selectComponentMaterial } from '../../../domain/items/bom';
import { findMaterial, type ReferenceMaterial } from '../../../domain/referenceTypes';
import { fv } from '../../../domain/requests';
import type { BomComponent, BomRequest, FertBomItem, ValidationIssue } from '../../../domain/types';
import { useAppStore } from '../../../store/appStore';

const ADD_COMPONENT_ID = 'bom-add-component';
const componentMaterialId = (rowId: string) => `bom-material-${rowId}`;

const MATERIALS = REFERENCE_DATA.materials;
const typeLabel = (id: string) => REFERENCE_DATA.materialTypes.find((type) => type.id === id)?.label ?? id;
const materialLabel = (material: ReferenceMaterial) => `${material.number} · ${material.description}`;
const newComponentId = () => `cmp_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;

// Pixel sizes on purpose: in MUI's sx a bare 1 means 100%.
const srOnly = { position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const;

interface BomEditorProps {
  request: BomRequest;
  item: FertBomItem;
}

/**
 * Build Product BOM: choose which existing materials go into the finished product, and how much of each. Every
 * change goes straight to the draft through the store, so the domain re-derives values and re-validates, and the
 * item card, workspace, Review and submission all read the same record. The product the BOM builds comes from
 * Create Finished Product and is shown read-only.
 *
 * Validation is progressive: a field's blocking issue shows once the user has left the field, or straight away
 * for a value that was already saved.
 */
export function BomEditor({ request, item }: BomEditorProps) {
  const updateItem = useAppStore((state) => state.updateItem);
  const { header, components } = item.data;
  const started = item.completeness !== 'notStarted';

  const [touched, setTouched] = useState<Set<string>>(
    () =>
      new Set(
        item.data.components.flatMap((component) =>
          Object.entries(component.fields).flatMap(([id, value]) => (!isBlank(value) && value?.provenance !== 'derived' ? [`${component.id}:${id}`] : [])),
        ),
      ),
  );
  const [announcement, setAnnouncement] = useState('');
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const moveFocus = (id: string) => setFocus((current) => ({ id, n: (current?.n ?? 0) + 1 }));
  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);

  const touch = (rowId: string, fieldId: string) =>
    setTouched((current) => (current.has(`${rowId}:${fieldId}`) ? current : new Set(current).add(`${rowId}:${fieldId}`)));

  const latest = () => useAppStore.getState().requests[request.id]?.items.find((entry) => entry.id === item.id) as FertBomItem | undefined;
  const commit = (next: BomComponent[]) => {
    const current = latest();
    if (current) updateItem(request.id, item.id, { header: current.data.header, components: next });
  };

  const chooseMaterial = (rowId: string, material: ReferenceMaterial | null) => {
    const current = latest();
    if (!current) return;
    commit(current.data.components.map((component) => (component.id === rowId ? selectComponentMaterial(component, material) : component)));
    touch(rowId, 'componentNumber');
    setAnnouncement(material ? `${materialLabel(material)} chosen.` : 'Material cleared.');
  };
  const changeField = (rowId: string, fieldId: 'componentQty' | 'componentBaseUom', raw: string, provenance: 'user' = 'user') => {
    const current = latest();
    if (!current) return;
    const next = withField(current, 'component', fieldId, raw.trim() === '' ? undefined : fv(raw, provenance), rowId);
    updateItem(request.id, item.id, next.data);
  };
  const addComponent = () => {
    const current = latest();
    if (!current) return;
    const id = newComponentId();
    commit([...current.data.components, { id, fields: {} }]);
    setAnnouncement(`Component ${current.data.components.length + 1} added.`);
    moveFocus(componentMaterialId(id));
  };
  const removeComponent = (rowId: string) => {
    const current = latest();
    if (!current) return;
    const remaining = current.data.components.filter((component) => component.id !== rowId);
    // There is always a row to fill in, so an emptied list starts over with one blank component.
    commit(remaining.length > 0 ? remaining : [{ id: newComponentId(), fields: {} }]);
    setAnnouncement('Component removed.');
    moveFocus(ADD_COMPONENT_ID);
  };

  const issueFor = (rowId: string, fieldId: string): ValidationIssue | null => {
    if (!touched.has(`${rowId}:${fieldId}`)) return null;
    return item.issues.find((issue) => issue.rowId === rowId && issue.fieldId === fieldId && issue.blocking) ?? null;
  };
  const chosen = useMemo(() => new Set(components.map((component) => textOf(component.fields.componentNumber)).filter(Boolean)), [components]);
  const noMaterialYet = !components.some((component) => !isBlank(component.fields.componentNumber));
  const listIssue = started && noMaterialYet ? item.issues.find((issue) => !issue.rowId && issue.blocking) : undefined;
  const createItem = request.items.find((entry) => entry.type === 'finishedGoodsCreate');

  const product = [
    { id: 'p40Fert', label: 'Finished product', value: header.p40Fert },
    { id: 'headerDescription', label: 'Description', value: header.headerDescription },
    { id: 'headerMatlType', label: 'Material type', value: header.headerMatlType },
  ];
  // The material type is derived as soon as Create Finished Product exists, so it alone doesn't make the product known.
  const hasProduct = !isBlank(header.p40Fert) || !isBlank(header.headerDescription);

  return (
    <Box data-testid="bom-editor" sx={{ mt: 3 }}>
      <Typography variant="body2" component="div" color="text.secondary" sx={{ maxWidth: 760, display: 'grid', gap: 0.5 }}>
        <span>Choose the existing materials that go into this product, and how much of each. Only materials that already exist can be used. Fields marked with * are required. Changes are saved to this draft as you go.</span>
        <SourceNote kind="reference" testId="bom-reference-note">
          Lists marked with this icon use {REFERENCE_DATA_PHRASE.charAt(0).toLowerCase() + REFERENCE_DATA_PHRASE.slice(1)}.
        </SourceNote>
      </Typography>

      <Box component="section" aria-labelledby="bom-product-heading" data-testid="bom-product" sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, maxWidth: 760 }}>
        <Typography id="bom-product-heading" variant="body2" sx={{ fontWeight: 600 }}>
          Product this BOM builds
        </Typography>
        {hasProduct ? (
          <Box component="dl" sx={{ m: 0, mt: 0.5, display: 'grid', gap: 0.75 }}>
            {product
              .filter((entry) => !isBlank(entry.value))
              .map((entry) => {
                const note = sourceNoteFor(entry.value);
                return (
                  <Box key={entry.id}>
                    <Typography component="dt" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {entry.label}
                    </Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                      {entry.id === 'headerMatlType' ? typeLabel(textOf(entry.value)) : textOf(entry.value)}
                      {note && (
                        <Typography component="span" variant="caption" sx={{ display: 'block' }}>
                          <SourceNote kind={note.kind}>{note.text}</SourceNote>
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                );
              })}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            The finished product appears here once Create Finished Product has its Source Material Identifier.
            {createItem && (
              <>
                {' '}
                <Link component={RouterLink} to={`/requests/${request.id}/setup/${createItem.id}`}>
                  Go to Create Finished Product
                </Link>
              </>
            )}
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />
      <Typography variant="h3" component="h3" id="bom-components-heading">
        Components
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {noMaterialYet ? 'No materials chosen yet.' : `${components.filter((component) => !isBlank(component.fields.componentNumber)).length} chosen.`}
      </Typography>
      {listIssue && (
        <Typography role="alert" variant="body2" sx={{ mt: 1, color: 'error.main', fontWeight: 600 }} data-testid="bom-list-issue">
          {listIssue.message}
        </Typography>
      )}

      <Stack spacing={3} sx={{ mt: 2, maxWidth: 560 }} role="list" aria-labelledby="bom-components-heading">
        {components.map((component, index) => {
          const number = textOf(component.fields.componentNumber);
          const material = number ? (findMaterial(REFERENCE_DATA, number) ?? null) : null;
          const unit = textOf(component.fields.componentBaseUom);
          const unitOptions = REFERENCE_DATA.bomUoms.some((option) => option.id === unit) || !unit ? REFERENCE_DATA.bomUoms : [...REFERENCE_DATA.bomUoms, { id: unit, label: unit }];
          const materialIssue = issueFor(component.id, 'componentNumber') ?? (number && !material ? { message: `Material ${number} isn’t in the reference material list.` } : null);
          const qtyIssue = issueFor(component.id, 'componentQty');
          const used = new Set([...chosen].filter((entry) => entry !== number));
          const headingId = `bom-component-${component.id}-heading`;
          const detail = material
            ? [textOf(component.fields.componentDescription), typeLabel(textOf(component.fields.componentMatlType)), `Group ${textOf(component.fields.componentMatlGrp)}`].join(' · ')
            : null;
          return (
            <Box component="section" role="listitem" key={component.id} aria-labelledby={headingId} data-testid="bom-component">
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography id={headingId} variant="h4" component="h4">
                  Component {index + 1}
                </Typography>
                <Button
                  color="secondary"
                  onClick={() => removeComponent(component.id)}
                  aria-label={`Remove component ${index + 1}${material ? `, ${materialLabel(material)}` : ''}`}
                  sx={{ fontWeight: 400 }}
                >
                  Remove
                </Button>
              </Stack>

              <Autocomplete
                id={componentMaterialId(component.id)}
                options={MATERIALS}
                value={material}
                onChange={(_, next) => chooseMaterial(component.id, next)}
                onBlur={() => touch(component.id, 'componentNumber')}
                getOptionLabel={materialLabel}
                isOptionEqualToValue={(a, b) => a.number === b.number}
                getOptionDisabled={(option) => used.has(option.number)}
                autoHighlight
                noOptionsText="No existing material matches. Only existing materials can be added."
                renderOption={({ key, ...props }, option) => (
                  <li key={key} {...props}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {materialLabel(option)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {typeLabel(option.type)} · Group {option.materialGroup} · {option.baseUom}
                        {used.has(option.number) && ' · Already added'}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Material"
                    required
                    error={Boolean(materialIssue)}
                    helperText={
                      materialIssue ? (
                        materialIssue.message
                      ) : detail ? (
                        <>
                          <ReferenceIndicator />
                          {detail}
                        </>
                      ) : (
                        <>
                          <ReferenceIndicator />
                          Search by number or description.
                        </>
                      )
                    }
                  />
                )}
              />

              <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 2 }}>
                <TextField
                  id={`bom-qty-${component.id}`}
                  label="Quantity"
                  required
                  value={textOf(component.fields.componentQty)}
                  onChange={(event) => changeField(component.id, 'componentQty', event.target.value)}
                  onBlur={() => touch(component.id, 'componentQty')}
                  error={Boolean(qtyIssue)}
                  helperText={qtyIssue?.message ?? 'Amount used in the product.'}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
                <TextField
                  id={`bom-unit-${component.id}`}
                  select
                  label="Unit"
                  required
                  disabled={!material}
                  value={unit}
                  onChange={(event) => changeField(component.id, 'componentBaseUom', event.target.value)}
                  helperText={material ? 'Starts as the material’s own unit.' : 'Choose a material first.'}
                  // The disabled grey is too faint for text that explains why the field is disabled.
                  slotProps={{ formHelperText: { sx: { '&.Mui-disabled': { color: 'text.secondary' } } } }}
                >
                  {unitOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          );
        })}
      </Stack>

      <Button
        id={ADD_COMPONENT_ID}
        variant="outlined"
        color="secondary"
        startIcon={<AddIcon />}
        onClick={addComponent}
        sx={{ mt: 3, width: { xs: '100%', sm: 'auto' } }}
      >
        Add component
      </Button>

      <Box role="status" aria-live="polite" sx={srOnly}>
        {announcement}
      </Box>
    </Box>
  );
}
