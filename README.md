# BOM Pilot

**Protogen P303 mobile-first case study.** A fictional enterprise product that lets a **Product Commercialization Manager** request a new finished product built from **existing materials**, from first question to submitted request, on a phone.

- **Primary user:** Product Commercialization Manager (the **Requestor** role).
- **Supported scenario:** New Product / Innovation using existing materials (Business Need "New Product / Innovation" + Material Scenario "No New Materials").
- **Everything runs in the browser.** There is no backend and no connection to any enterprise system. All data is synthetic.

See [BRIEF.md](./BRIEF.md) for the product specification, including the exact validation rules and scope boundaries.

## Happy Path

> **New Request → Intake → Request Setup → Existing Materials → Review → Submit → Confirmation → BOM Work**

Every step is functional in the browser. Review, Submit and Confirmation are working screens, not placeholders.

## What You Can Try

Best viewed at a phone width (about 375–430px; browser dev tools device mode works well). Nothing needs installing if you are using the deployed build.

1. Select **New Request**.
2. Choose **New Product / Innovation**.
3. Choose **No New Materials**.
4. Complete **Intake**: a request name and a business justification, then **Continue to Request Setup**.
5. Complete **Create Finished Product**.
6. Open **Build Product BOM** (on a phone, open the Request Items summary first).
7. **Search and select existing materials** (for example "COMPONENT A", then "PACKAGE A").
8. Enter **quantities** and check the **units**. Use **Add component** for a second material.
9. **Resolve validation.** Try clearing a quantity: the item shows **Needs attention** and the readiness message changes.
10. Select **Review & Submit**. Review says **Ready to submit** (or lists what is blocking).
11. Select **Submit**.
12. **Confirmation** shows the request ID and details.
13. Select **View in BOM Work**: the request is listed under **Requests**.

Sample values for step 5: Source Material Identifier `900001`; Brand Alpha, Model B, Package size B, Container Box, Pack 12-pack; Product Code `CITRUS-12`; orderable unit CS; shelf life 90 and 180 days; Ambient; Target Market Region A.
Sample values for steps 7–8: `MAT-001` COMPONENT A, quantity `18200`; `MAT-101` PACKAGE A, quantity `120000`.

Progress is saved in the browser, so a refresh keeps it. To start clean, open the role menu (top right) and choose **Reset demo data**. Please try the flow with a new request rather than the seeded records in BOM Work; those exist only as context.

## Current Implemented Experience

- **Intake:** request name, Business Need (six options), Material Scenario (four options, shown only for New Product / Innovation), business justification, and an optional simulated reference-document upload (only the file name is kept). Only New Product / Innovation + No New Materials continues; other options show a "Planned for a future phase" notice and can be saved as drafts.
- **Conditional behavior:** the Material Scenario question, justification and upload appear only on the supported path; the path locks once Request Items exist; the "Reference document link" field appears when Bill of Materials setup is "Yes"; BOM requirements follow that setting.
- **Create Finished Product:** Source Material Identifier, a Material Description generated from structured attributes, Product Code, orderable unit, optional weights, shelf life, temperature condition, target market, and Bill of Materials setup.
- **Build Product BOM:** search the 24 existing synthetic materials, select one, enter a quantity, use or change the unit, add another component, change or remove a component. The product it builds is shown read-only.
- **Continuous validation:** progressive and shared by Request Setup, Review and Submit. Blocking issues stop submission; nonblocking warnings do not. Each item reads Not started, In progress, Needs attention or Complete.
- **Review:** a read-only summary of the actual request, its items and the chosen components, with Edit links and "Ready to submit" or "Unable to submit".
- **Submit:** validates, blocks an invalid request, performs a real local state transition, and ignores a double tap.
- **Confirmation:** the submitted request's synthetic ID and details, with View in BOM Work, Start another request, and Return to BOM Work.
- **BOM Work:** Drafts, Requests and Completed lists with search. A submitted request appears under Requests.
- **Requestor-focused lifecycle:** a second demo role (Execution Specialist) shows role-based access to the request lists only.

## Test Scenarios

- **Valid happy path:** the flow above, from New Request to the request appearing in BOM Work.
- **Missing BOM component:** a request with no component material is blocked on Review with "Add at least one component material."
- **Invalid or missing component data:** a chosen material with no quantity, a quantity with no material, or a quantity of zero shows Needs attention, and Submit is blocked.
- **Add, change and remove components:** including a material that cannot be added twice, and a unit that is kept when the material changes.
- **Request Setup and Review agree** on whether the request is ready, including when the Plant Availability item is untouched.
- **Duplicate submission protection:** a double tap creates one submission.
- **Confirmation:** shows the actual submitted request, survives a refresh, and keeps the request in BOM Work; Start another request does not change it.
- **Recovery:** an unknown request ID, or a request that has not been submitted, shows a clear message and a way back.

The scenarios above are covered by the automated tests listed under Validation.

**Mobile responsive behavior** was checked in a real browser (not part of the automated suite) at 375×812, 390×844, 430×932, 768×1024 and 1280×800: no horizontal scrolling, usable component controls, and the Request Item list collapsing to a summary on narrow screens. The automated tests cover that narrow-screen layout switch.

## Validation

```sh
npm run check          # typecheck + lint + tests + production build
npm run verify:review  # confirms the build opens from dist/index.html with no server or network
```

Current verified result: **22 test files, 423 tests passing**, with a clean typecheck, lint and production build. `npm run build:review` runs the build and the review-build check together. Other scripts: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:watch`.

## Technology

From `package.json`: React 19 and TypeScript, built with Vite; React Router (hash routing, so the static build works anywhere); Zustand for state, persisted to browser storage; MUI with Emotion for UI; Vitest with Testing Library for tests; ESLint with typescript-eslint.

## Running Locally

```sh
npm install
npm run dev
```

`npm run build` produces a static site in `dist/` that needs no server (for example, a Vite project on Vercel with build command `npm run build` and output directory `dist`).

## Project Structure

- `BRIEF.md` — the product specification
- `README.md` — this file
- `LICENSE` — MIT
- `scripts/verify-review-build.mjs` — the review-build check
- `src/app/` — routes and role-based route gating
- `src/components/` — shared UI: shell and navigation, status, stepper, provenance markers
- `src/data/` — synthetic reference data (materials, facilities, units), demo personas and seeded records
- `src/domain/` — framework-independent request model, field definitions, validation rules and readiness
- `src/features/intake/` — Intake
- `src/features/setup/` — Request Setup, with `editors/` holding the Create Finished Product editor and the **Build Product BOM component editor** (`BomEditor.tsx`)
- `src/features/review/` — **Review, Submit and Confirmation**
- `src/features/work/` — BOM Work lists
- `src/features/reports/`, `src/features/placeholders/` — the "Planned" Reports area and the labeled out-of-scope screens
- `src/store/` — Zustand store and persistence
- `src/theme/` — MUI theme and design tokens

## Accessibility

- Labeled inputs, grouped choices, written (not color-only) error messages tied to their fields, and a skip link.
- A visible keyboard focus ring and logical focus: to the first problem after a failed Continue, to the validation statement after a blocked Submit, and to the success heading on Confirmation.
- Error text meets WCAG AA contrast (about 4.9:1 on the page background).
- About 44px touch targets for happy-path controls on phones and touch screens.
- Status is shown as icon plus text, never color alone.
- Status and alert messages announce saves, component changes, blocked submissions and the submission result.

I spot-checked the main screens with the axe-core accessibility engine; that check is not part of this repository's test suite.

## Public-Safe Disclosure

This repository is a generalized, fictional submission. All organizations, products, materials, identifiers, workflow examples and sample data are synthetic or generalized. It contains no client-specific source material, no original branding, screenshots, transcripts or proprietary fonts, and no confidential metrics. The application has no connection to any live enterprise system.

## Out of Scope

Functional in this build: Intake, Request Setup (Create Finished Product and Build Product BOM), Review, Submit, Confirmation and BOM Work.

Not part of this build:
- execution, returns and completion of submitted requests (their screens are labeled placeholders; the seeded records in BOM Work only illustrate them)
- plant and facility editing (Set Up Plant Availability is present as context; it does not affect the happy path)
- SAP or other ERP integration
- approvals and reviewer workflow
- material creation, other complete Business Need flows, analytics, notifications, admin tools and an AI assistant

See [BRIEF.md](./BRIEF.md) for the full scope boundaries.
