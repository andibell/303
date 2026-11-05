# Product

**BOM Pilot** — the product name used throughout the application (page title, global header, and navigation).

# Case Study

Protogen P303 Mobile Experience.

# Primary User

**Product Commercialization Manager**, represented in the build by the **Requestor** role. A second demo role, **Execution Specialist**, exists only to show role-based access to the request lists; it is not the primary user and nothing downstream of submission is functional (see Scope Boundaries).

# Focused Scenario

**New Product / Innovation + No New Materials.**

"No New Materials" means every component material the product needs **already exists** in the synthetic material catalog (24 fictional materials). The request therefore creates one new finished product and describes its structure entirely from existing materials; it never asks for a new component material to be created.

This is the only Business Need / Material Scenario combination that is functional end to end. Every other option is selectable in Intake but is marked "Planned for a future phase" and cannot continue.

# Core User Need

The user needs to define a new finished product and its existing-material component structure, and submit a complete request, without navigating the complexity of the underlying enterprise system.

# Primary Decision

Which existing materials belong in this new product structure, in what quantities, and is the request complete enough to submit?

# Product Principle

**Business Need establishes the starting experience.** Intake opens with "What is the business need for this request?"; the answer decides which questions, uploads and Request Items follow.

The product reveals only what the current task needs:
- The material-scenario question appears only after "New Product / Innovation" is chosen.
- Business justification, the optional reference-document upload and the Request Item preview appear only on the supported path.
- Inside Create Finished Product, the "Reference document link" field appears only when Product Bill of Materials setup is "Yes".
- Validation is progressive: an untouched Request Item shows "Not started", not a list of errors. Review reports everything that blocks submission.
- Enterprise detail stays behind the experience: the user enters a Source Material Identifier (the Execution Identifier is shown read-only as something execution assigns later), Request Items lead with business names ("Build Product BOM") and show the technical type beneath, and values that come from reference data or are generated are marked as such.

# Final Happy Path

All of the following is functional through the browser, with no backend:

**New Request → New Product / Innovation → No New Materials → Intake → Request Setup → Create Finished Product → Build Product BOM → Select Existing Materials → Validation → Review → Submit → Confirmation → BOM Work**

| Step | What happens |
|---|---|
| New Request | Creates one Draft with a synthetic request ID and opens Intake. |
| Intake | Request name, Business Need, Material Scenario, business justification (required), optional simulated reference-document upload (file name only is kept). Continue generates the three Request Items once. |
| Create Finished Product | Defines the new finished product: Source Material Identifier, a generated Material Description (built from Brand, Variant, Model, Package size, Container type and Pack configuration), Product Code, orderable unit, optional weights, shelf life in days, temperature condition, target market, and whether a Product Bill of Materials is needed. |
| Build Product BOM | Select the existing materials in the product and their quantities (below). |
| Validation | Continuous in Request Setup (see Validation). |
| Review | Read-only summary of the actual request with Edit links and a ready / blocked statement. |
| Submit | Local state transition from Draft to Submitted. |
| Confirmation | Shows the submitted request, its ID, and next actions. |
| BOM Work | The submitted request is listed under Requests. |

# Existing-Material Component Selection

Build Product BOM is a focused component editor, not a full BOM authoring tool. The Requestor can:

- **Search** the existing synthetic materials by number or description (for example "COMPONENT A" or "MAT-101"). The list offers only existing materials, and says so when nothing matches.
- **Select** a material. Its description, material type and material group come from the catalog and are shown with a reference-data marker.
- **Enter a quantity** (greater than zero, digits with up to three decimals).
- **Use or change the unit.** It starts as the material's own unit and can be changed from the supported units; a unit the user chose is kept if the material is changed.
- **Add another component.** A material already used in another row is disabled in the list.
- **Change or remove a component.** Removing the last one leaves a blank row to fill in.
- **See the product being built.** A read-only "Product this BOM builds" box shows the finished product, description and material type derived from Create Finished Product. These values are not editable here.

Every change is saved to the draft as it is made, announced to assistive technology, and re-validated. Selected components appear on Review as "Component 1 … MAT-001 · COMPONENT A, 18200 KG" and are kept exactly as chosen when the request is submitted.

# Validation

One rule set drives Request Setup, Review and Submit, so they cannot disagree about readiness. Each Request Item shows **Not started**, **In progress**, **Needs attention** or **Complete**. An edited item stays "started" even if it is emptied again.

## Blocking

Issues that prevent the supported P303 task from being submitted.

- **Intake:** request name, Business Need, Material Scenario (the supported combination), business justification.
- **Create Finished Product:** Source Material Identifier; Material Description (needs Brand, Model, Package size, Container type and Pack configuration, at most 80 characters); Product Code (3–24 letters, numbers or hyphens); orderable unit (EA, PK, CS or PAL); Minimum and Total Shelf Life in whole days; Temperature Condition; Target Market.
- **Build Product BOM:**
  - at least one component material
  - every component material must exist in the catalog
  - a chosen material needs a quantity, and a quantity needs a material
  - a quantity must be greater than zero
  - a quantity needs a unit
- **Across items:** if Product Bill of Materials setup is "Yes", a Build Product BOM item (or a reference link) must exist. This check runs at submission.

Incomplete or invalid required component data shows **Needs attention** and blocks Submit.

## Nonblocking

Guidance that does not stop submission and is shown as a warning ("won't block submission"):
- optional Create Finished Product fields (weights, weight unit, reference link)
- the Build Product BOM header details (facility, material group, base unit, quantity), which this focused editor does not expose
- plant and facility details on Set Up Plant Availability

A request is **ready** when nothing blocks submission. An untouched item that only has warnings does not hold the request back.

## Out of scope

Plant availability editing, and all downstream execution functionality. Neither is needed to complete the supported happy path.

# Review

Review is functional and summarizes the actual active request:
- request name, ID, status, Business Need, Material Scenario, number of Request Items, business justification, and the reference document if one was added
- each Request Item as a read-only section with its entered and generated values (generated and reference-based values are marked), collapsible; on narrow screens only items that block submission start open
- the chosen BOM components with description, material number, quantity and unit
- a validation statement, **Ready to submit** or **Unable to submit**, with each blocking issue and a link to the place that fixes it
- Edit links (per item, Request Details, Intake); Review itself never edits anything

# Submit

Submit:
- re-runs the full submission validation
- if anything blocks, stays on Review, shows the blocking issues and moves focus to the validation statement; the request stays a Draft
- if valid, performs a real **local** state transition: the request becomes Submitted (shown as "Ready for Execution" in BOM Work), the submission time and history events are recorded, and every Request Item is kept
- shows an in-progress state and ignores a second tap, so a double tap cannot submit twice

Everything is local to the browser. Nothing is sent to a backend, workflow engine, ERP or email system, and the interface never implies it is.

# Confirmation

Confirmation shows the actual submitted request:
- the heading "Request submitted", with the message "Your request has been submitted and is now available in BOM Work."
- the synthetic request ID, prominently
- request name, status ("Submitted" with the BOM Work status), submission date and time, Business Need, Material Scenario and number of Request Items
- next actions: **View in BOM Work**, **Start another request** (a fresh draft; the submitted request is untouched) and **Return to BOM Work**

The submitted request stays in BOM Work under Requests and survives a refresh. An unknown request ID, or a request that has not been submitted, shows a clear message with a way back.

# Mobile Context

Designed primarily for roughly **375–430px** widths, for a user who works between meetings, consults product information elsewhere, completes the task in short bursts, uses one hand, and may be interrupted. Layouts were checked at 375×812, 390×844, 430×932, 768×1024 and 1280×800.

- **Focused decisions:** one Request Item is edited at a time; choices are full-width rows; the only long free-text field is the business justification, and every other input is short, constrained or chosen from a list.
- **No horizontal scrolling,** and no data tables for authoring. Review content stacks into one column.
- **Touch-friendly controls:** about 44px on screens narrower than 900px or with a touch pointer, with desktop density kept on wide mouse-driven screens.
- **Responsive Request Item editing:** the Request Item list collapses to a summary of the current item and progress.
- **Focused primary actions:** a sticky action bar keeps Save Draft and the next step (Review & Submit, then Submit) reachable.
- **No hover dependency:** every action is an explicit control, and reference-data notes are visible text.
- **Interruption-tolerant:** changes save as you go and survive a refresh.

# Information Hierarchy

1. What are you trying to accomplish? Business Need in Intake.
2. What product are you launching? Request name, business justification, and Create Finished Product.
3. Which existing materials belong to it, and how much? Build Product BOM.
4. Is the structure complete? Item status and the readiness statement in Request Setup.
5. What will be submitted? Review.
6. Did submission succeed? Confirmation, then BOM Work.

This follows the user's task, not the structure of the underlying enterprise system.

# Conditional Behavior

- A Business Need other than New Product / Innovation hides the Material Scenario question and shows a "Planned for a future phase" notice.
- Business justification, the upload and the item preview appear only on the supported path.
- Once Request Items exist, Business Need and Material Scenario are locked; a different path means a new request.
- Product Bill of Materials setup is "Yes" automatically while a Build Product BOM item exists, and "Reference document link" appears when it is "Yes".
- BOM component requirements apply while Product Bill of Materials setup is needed.
- Unit choices start from the chosen material; a material already used is unavailable in other rows.
- Removing a Request Item previews what depends on it before the user confirms.

# Accessibility

Intended requirements, as implemented:
- **Labels and structure:** labeled inputs, `fieldset`/`legend` for choice groups, a "Skip to main content" link, a clear page heading on each screen, and a stage stepper that marks the current and completed stage in text.
- **Keyboard:** all actions are operable by keyboard, with a visible 2px focus ring. Focus moves to the first problem after a failed Continue, to the validation statement after a blocked Submit, to the success heading on Confirmation, to the new component's material field after adding a component, and to the Add component button after removing one.
- **Validation associations:** each error or hint is tied to its field, and errors are written messages, not color alone.
- **Error contrast:** error text meets WCAG AA (about 4.9:1 on the page background).
- **Touch targets:** about 44px for happy-path controls on narrow or touch screens.
- **Status not by color alone:** every status chip pairs an icon with text, and the selected choice uses a marker and bold text as well as color.
- **Announcements:** the save, add, remove and choose actions, the blocked-submit alert, and the Confirmation message are announced through status or alert regions.
- **Understandable progress:** step labels, "N of M ready", and item statuses in words.

# Synthetic Data Boundary

All organizations, products, requests, material records, identifiers, taxonomies and workflow examples are fictional and created for this case study: the material catalog (`MAT-001` to `MAT-202`), facilities (`FAC-01` to `FAC-12`), units, brand and model options, and the demo personas. The reference data is labelled in the application as "Fictional demo reference data · static sample · not connected to a live system", and the footer states there is no connection to external systems.

# Scope Boundaries

The MVP is **not**:
- an SAP or ERP integration, or an ERP replacement
- a material-creation platform (the scenario assumes the materials already exist)
- a full BOM authoring system
- an approval or reviewer workflow
- an execution workflow (execution, returns, completion)
- a plant or facility editor
- master-data governance software
- supply or manufacturing planning
- project management, analytics or notifications
- admin tools
- an AI assistant
- a source of additional complete Business Need flows

Out of scope, and shown honestly as such:
- **Set Up Plant Availability** is present as product context with a short "outside the current POC review scope" note. It is not needed for the happy path and its warnings never block submission.
- The request record, a Request Item's execution data, and the execution package open a labeled placeholder. Reports is marked "Planned".
- Seeded demonstration requests in BOM Work (including in-progress and completed examples) give context only. They are not the way to test the submission.
