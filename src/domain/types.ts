import type { RoleId } from './access';

/*
 * Core BOM domain model.
 * A BomRequest is the parent record; RequestItems are its children. Business Need and shared business
 * context live on the parent and are inherited by every item. There is no item-level override.
 */

export type BusinessNeedId =
  | 'newProduct'
  | 'lineExtension'
  | 'packagingGraphics'
  | 'reformulation'
  | 'plantComan'
  | 'marketUom';

export type MaterialScenarioId = 'noNewMaterials' | 'someNewMaterials' | 'allNewMaterials' | 'notSure';

export type ItemType = 'finishedGoodsCreate' | 'extend' | 'finishedGoodsBom';
export type MaterialType = 'finishedGoods' | 'semiFinished' | 'packaging' | 'rawMaterial';

/** "Resubmitted" is a history event, never a status. */
export type RequestStatus =
  | 'draft'
  | 'validating'
  | 'readyForExecution'
  | 'inProgress'
  | 'actionRequired'
  | 'completed';

/** Where a value came from. */
export type Provenance = 'user' | 'upload' | 'reference' | 'derived';

export interface FieldValue {
  /** Text, or a list of codes (plants). Numbers are kept as the text the user entered. */
  value: string | string[];
  provenance: Provenance;
  /** For example an upload file name or a reference material number. */
  sourceRef?: string;
}
export type FieldMap = Record<string, FieldValue | undefined>;

export interface Actor {
  id: string;
  name: string;
  role: RoleId;
}

/** Authoring completeness of one item: derived from validation, never set by hand. */
export type Completeness = 'notStarted' | 'inProgress' | 'complete' | 'hasIssues';

/** Where the item is in downstream execution. */
export type ExecutionState = 'notSubmitted' | 'ready' | 'inProgress' | 'returned' | 'completed';

export type IssueSeverity = 'error' | 'warning';
/** `missing` = not filled in yet; `invalid` = a value breaks a rule; `consistency` = values conflict. */
export type IssueCategory = 'missing' | 'invalid' | 'consistency';

export interface SourceRef {
  /** Repository path or document the rule comes from. */
  document: string;
  locator: string;
  note?: string;
}

export interface ValidationIssue {
  id: string;
  ruleId: string;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  /** True when the issue stops submission (all errors; never warnings). */
  blocking: boolean;
  itemId?: string;
  itemType?: ItemType;
  /** Row inside an item: an Extend row or a BOM component. */
  rowId?: string;
  section?: string;
  fieldId?: string;
  source: SourceRef;
}

export interface ValidationState {
  evaluatedAt: string | null;
  phase: 'authoring' | 'submission';
  issues: ValidationIssue[];
  blockingCount: number;
  warningCount: number;
  /** No blocking issue remains. */
  submittable: boolean;
}

export interface ItemCompletion {
  completedBy: Actor;
  completedAt: string;
}

interface RequestItemBase {
  id: string;
  type: ItemType;
  /** Parent completes only when every required item has completed. */
  required: boolean;
  /** Part of the recommended starting template. Kept after removal-and-re-add so the UI can explain impact. */
  recommended: boolean;
  completeness: Completeness;
  execution: ExecutionState;
  issues: ValidationIssue[];
  /** Manually entered by the execution specialist after System entry; a generic identifier in the POC. */
  executionIdentifier?: string;
  executionIdentifierRecordedAt?: string;
  completion?: ItemCompletion;
  createdAt: string;
  updatedAt: string;
}

export interface FertCreateItem extends RequestItemBase {
  type: 'finishedGoodsCreate';
  data: { fields: FieldMap };
}

/**
 * The component model can support additional material categories without a schema change.
 */
export interface ExtendRow {
  id: string;
  material: { kind: 'requestItem'; itemId: string } | { kind: 'existing'; materialNumber: string };
  materialType: MaterialType;
  fields: FieldMap;
}
export interface ExtendItem extends RequestItemBase {
  type: 'extend';
  data: { rows: ExtendRow[] };
}

export interface BomComponent {
  id: string;
  fields: FieldMap;
}
export interface FertBomItem extends RequestItemBase {
  type: 'finishedGoodsBom';
  data: { header: FieldMap; components: BomComponent[] };
}

export type RequestItem = FertCreateItem | ExtendItem | FertBomItem;

export interface Upload {
  id: string;
  fileName: string;
  /** Size of the chosen file when known. Only metadata is stored; the file itself is never kept. */
  sizeBytes?: number;
  kind: 'referenceDocument' | 'supporting';
  uploadedAt: string;
  uploadedBy: Actor;
  /** Uploads are simulated in the POC; nothing is parsed. */
  simulated: true;
  /** Field ids populated from the upload. */
  populatedFields: string[];
}

export type HistoryEventType =
  | 'draftCreated'
  | 'draftSaved'
  | 'intakeCompleted'
  | 'itemAdded'
  | 'itemRemoved'
  | 'validationFailed'
  | 'validationPassed'
  | 'requestSubmitted'
  | 'readyForExecution'
  | 'executionStarted'
  | 'actionRequired'
  | 'correctionMade'
  | 'requestResubmitted'
  | 'itemCompleted'
  | 'executionIdentifierRecorded'
  | 'requestCompleted';

export type HistoryMetadata = Record<string, string | number | boolean | string[]>;

/** Append-only. Labels are produced by `describeEvent`, never stored. */
export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  at: string;
  actor: Actor;
  itemId?: string;
  metadata?: HistoryMetadata;
}

export type ReturnReasonId =
  | 'missingInformation'
  | 'invalidReference'
  | 'plantOrExtension'
  | 'conflictingData'
  | 'unsupportedCombination'
  | 'approvalNeeded'
  | 'systemConstraint'
  | 'other';

export type ReturnResolution =
  | { state: 'open' }
  | { state: 'resolved'; resolvedAt: string; resolvedBy: Actor; resubmissionVersion?: number };

/** Execution returns work to the requestor: for one item, or for the whole request. */
export interface ActionRequiredReturn {
  id: string;
  scope: 'request' | 'item';
  /** Present when scope is `item`. */
  itemId?: string;
  category: ReturnReasonId;
  section?: string;
  fieldId?: string;
  requiredAction: string;
  explanation?: string;
  createdBy: Actor;
  createdAt: string;
  resolution: ReturnResolution;
}

export interface SubmissionRecord {
  version: number;
  kind: 'initial' | 'resubmission';
  at: string;
  by: Actor;
  /** Immutable copy of the items as submitted, for the execution-ready output. */
  items: RequestItem[];
}

export interface RequestContext {
  /** Shared by every item. Captured once at Intake. */
  businessJustification?: FieldValue;
}

export interface BomRequest {
  id: string;
  name: string;
  businessNeed: BusinessNeedId | null;
  materialScenario: MaterialScenarioId | null;
  context: RequestContext;
  items: RequestItem[];
  uploads: Upload[];
  requestor: Actor;
  /** True only while the submission review runs (the Validating status). */
  isValidating: boolean;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  submittedBy?: Actor;
  completedAt?: string;
  history: readonly HistoryEvent[];
  returns: ActionRequiredReturn[];
  submissions: SubmissionRecord[];
  validation: ValidationState;
  /** Always true: every record in the POC is synthetic. */
  isSynthetic: true;
}
