# Product

**BOM Pilot** — the product name used throughout the application (page title, global header, and navigation).

# Case Study

Protogen P303 Mobile Experience.

# Primary User

Product Commercialization Manager, represented in this build as the **Requestor** role (one of two demo roles; the other, **Execution Specialist**, represents the downstream team that executes a submitted request).

# Primary Use Case

New Product using existing materials — in the application's own terms, a request with Business Need **"New Product / Innovation"** and Material Scenario **"No New Materials."** This is the only business-need and material-scenario combination that is functional end to end in this build; every other combination is shown as a selectable option but is marked **"Planned for a future phase"** and cannot proceed past Intake.

# Core User Need

The user needs to define the existing materials required for a new product and submit a complete material request without navigating the complexity of the underlying enterprise process.

# Primary Decision

Which existing materials belong in this new product structure, and is the request complete enough to submit?

# Product Principle

Business Need establishes the starting experience. Intake's first question is "What is the business need for this request?" — the answer determines which follow-up questions, uploads, and Request Items the product recommends, before anything about materials or structure is asked.

The product progressively reveals only the information relevant to the user's task:
- The material-scenario question only appears once "New Product / Innovation" is chosen.
- Request context (business justification, reference-document upload) only appears once the path is functional.
- Within a Request Item, fields like "Reference document link" or an entire Product BOM section only appear once an earlier answer makes them relevant.
- Validation issues are counted only for items the user has started; untouched Request Items are not flagged.

# Core Flow

The implemented flow, and how it maps to the brief's intended flow:

| Brief step | Implemented screen / state |
|---|---|
| Start Request | `New Request` — creates a Draft and hands off to Intake |
| New Product | Intake's Business Need and Material Scenario choice (New Product / Innovation → No New Materials) |
| Product Details | Intake — request name, business justification, optional reference-document upload |
| Existing Materials | Request Setup — the **Create Finished Product** Request Item, where the existing Source Material Identifier and product attributes are entered |
| Product Structure | Request Setup — the **Set Up Plant Availability** and **Build Product BOM** Request Items |
| Validation | Continuous, field- and item-level, inside Request Setup (see Validation) |
| Review | **Review & Submit** exists as a routed stage, reachable from Request Setup, but in this build it is a scope placeholder: it states what the full product will do there, without a working review screen |
| Submit | Not implemented in this build |
| Confirmation | Not implemented in this build |

The three authoring stages — **Intake → Request Setup → Review & Submit** — are shown as a persistent stepper. Only Intake and Request Setup are functional; Review & Submit, the request detail record, the Request Item execution-data view, and the execution package view are all represented as out-of-scope placeholders that name what the full product shows there.

A request also has three lifecycle lists outside authoring — **Drafts, Requests, Completed** — visible from "BOM Work" in the main navigation.

# Mobile Context

Designed primarily for approximately 375–430px mobile widths. The user may work between meetings, reference product information elsewhere, complete the task in short bursts, use one hand, and be interrupted.

Implemented implications:
- **Focused decisions** — one choice group (Business Need, then Material Scenario) at a time; later groups only appear once earlier ones are answered.
- **Touch targets** — Business Need and Material Scenario choices render as full-width, bordered option rows rather than compact radio buttons.
- **Clear progress** — the stage stepper and a status chip ("Draft," item completeness) are always visible; on narrow screens the Request Item list collapses into an expandable summary showing the current item and overall progress.
- **Limited free text** — only the request name and business justification are open text in Intake; Request Item fields are mostly choice, lookup, or short, pattern-validated text.
- **No desktop-style data tables** — Request Items are authored one at a time in a single-column workspace, not a grid.
- **No hover dependency** — all actions (add item, remove item, save, continue) are explicit buttons/links, not hover-revealed controls.
- **No horizontal scrolling** — the layout is single-column at phone widths, switching to a two-column (navigator + workspace) layout only at the `md` breakpoint.
- A sticky bottom action bar keeps Save Draft and Continue to Review & Submit reachable without scrolling back up, and scroll padding keeps a focused field clear of that bar.

# Information Hierarchy

1. What are you trying to accomplish? — the Business Need choice in Intake.
2. What product are you launching? — request name and business justification in Intake.
3. Which existing materials belong to it? — the Create Finished Product Request Item in Request Setup.
4. Is the structure complete and compatible? — Request Item completeness chips and the readiness message in Request Setup's action bar.
5. What will be submitted? — the Review & Submit stage (routed, but represented as a placeholder in this build).
6. Did submission succeed? — not implemented in this build.

This order follows the user's task (decide, describe, build, check, submit, confirm), not the underlying enterprise system's master-data architecture — the user is never asked to think in terms of material types, BOM headers, or execution identifiers until the product has already framed the work as "finish describing this product" and "add the Request Items it needs."

# Conditional Behavior

- Choosing a Business Need other than "New Product / Innovation" hides the Material Scenario question (it only applies to New Product) and shows a "Planned for a future phase" notice instead of request context.
- Request context (business justification, reference-document upload) and the generated Request Item template preview only appear once the path is functional (New Product / Innovation + No New Materials).
- Once any Request Item exists, or Intake has been handed off, the Business Need and Material Scenario become locked; changing path requires starting a new request.
- Within **Create Finished Product**, answering "Yes" to "Product Bill of Materials Setup Needed?" reveals the "Reference document link" field.
- If BOM setup is needed, every **Build Product BOM** header and component field becomes relevant (`appliesWhen`); if a Create item's answer is "No," those fields are not required.
- A cross-item rule requires that, when BOM setup is needed, either a Build Product BOM item is present or a reference-document link is provided on the Create item.
- Removing the last Request Item of a type, or removing an item relied on by a cross-item rule, is previewed before the user confirms (Remove Item dialog).

# Validation

Only validation actually present in this build:
- **Field-level rules**, generated per Request Item field from its specification: required vs. expected (non-blocking) vs. optional; maximum length; exact length; pattern/format (e.g., product code, shelf-life days); enumerated choice values; and facility-identifier format.
- **Reference lookups**: plant codes, material numbers, and units of measure are checked against the bundled sample reference data; a missing plant or unit is a warning, a missing material is a blocking error ("A No New Materials request can only use existing materials").
- **Cross-field consistency**: a BOM header or component quantity requires its matching unit of measure.
- **Cross-item consistency**: BOM setup needed on the Create item requires either a Build Product BOM item or a reference-document link.
- **Request-level rules**: Business Need and Material Scenario must be selected; only the New Product / No New Materials combination is submittable; business justification is required.
- Validation runs in two phases — **authoring** (continuous, as the user works) and **submission** (adds cross-item checks) — and issues are only surfaced for fields the user has touched; an untouched Request Item shows as "not started," not as having errors.
- Each Request Item has a derived completeness state: not started, in progress (something missing), has issues (something invalid), or complete.

# Accessibility

Intended requirements, consistent with what the current build does:
- **Semantic labels** — form fields use `FormLabel`/`FormHelperText` with `aria-describedby`; choice groups use `fieldset`/`legend`; regions use `aria-label` (e.g., "Request actions," "No Request Item open").
- **Keyboard focus** — failed validation on Continue moves focus to the first invalid field; adding, removing, or selecting a Request Item moves focus to the relevant heading or control; the stage stepper and navigation expose `aria-current`.
- **Mobile touch targets** — choice options and primary actions are full-width, padded rows and standard-sized buttons, not small inline controls.
- **Accessible errors** — field errors and warnings are delivered as helper text tied to the field via `aria-describedby`, not as a separate error summary only.
- **Status not represented only through color** — `StatusChip` always pairs an icon with a text label for every tone (neutral, info, success, warning, error).
- **Understandable progress** — the stage stepper marks a completed stage with an icon and a visually hidden "(completed)" label, not color alone; Request Item completeness is shown as a labeled chip.
- **Confirmation/status messaging** — save and update actions confirm via a visible snackbar (e.g., "Draft saved," "Request name updated") in addition to the on-screen save indicator.

# Synthetic Data Boundary

All organizations, products, request data, material records, identifiers, taxonomies, and workflow examples in this application and case study are created for this demonstration. The bundled reference data (facilities, materials, units of measure) is explicitly labeled in the code as "Fictional synthetic sample data for this demo. Not connected to a live system," and demo personas (Demo Requestor, Demo Executor) are generic role placeholders, not real people.

# Scope Boundaries

This MVP is **not**:
- SAP
- an ERP replacement
- a full BOM authoring system
- a material-creation platform
- an approval-management platform
- master-data governance software
- supply planning
- manufacturing planning
- project management
- analytics
- an AI assistant

The focused P303 scenario assumes required materials already exist; it demonstrates composing an existing-materials request, not creating new materials. Screens outside this scope (Review & Submit's working form, the request record, the Request Item execution-data view, the execution package, and anything beyond the Requestor/Execution Specialist demo roles) are represented in the build only as labeled placeholders describing what the full product would show.
