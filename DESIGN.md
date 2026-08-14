# Logistics ERP Design System

## 1. Atmosphere & Identity

A calm, operational command surface: compact enough for warehouse throughput, but explicit enough to prevent costly data-entry mistakes. The signature is blue-accented white work surfaces over a slate logistics shell.

## 2. Color

### Palette

| Role             | Token                    | Light     | Dark      | Usage                          |
| ---------------- | ------------------------ | --------- | --------- | ------------------------------ |
| Surface/primary  | `--ion-background-color` | `#f8fafc` | `#0f172a` | Page background                |
| Surface/elevated | `--ion-card-background`  | `#ffffff` | `#1e293b` | Cards and lists                |
| Text/primary     | `--ion-text-color`       | `#0f172a` | `#f1f5f9` | Body and headings              |
| Text/secondary   | `--gray-500`             | `#64748b` | `#94a3b8` | Captions and hints             |
| Border/default   | `--gray-200`             | `#e2e8f0` | `#334155` | Dividers and outlines          |
| Accent/primary   | `--ion-color-primary`    | `#2563eb` | `#3b82f6` | Primary actions and focus      |
| Status/success   | `--ion-color-success`    | `#16a34a` | `#22c55e` | Confirmations                  |
| Status/warning   | `--ion-color-warning`    | `#f59e0b` | `#fbbf24` | Cautions                       |
| Status/error     | `--ion-color-danger`     | `#dc2626` | `#ef4444` | Errors and destructive actions |

Only tokens already defined in `apps/web/src/theme/variables.scss` are used for new UI.

## 3. Typography

| Level   | Token                       | Usage                 |
| ------- | --------------------------- | --------------------- |
| H1      | `--font-size-3xl`, bold     | Major page title      |
| H2      | `--font-size-xl`, semibold  | Section heading       |
| H3      | `--font-size-lg`, semibold  | Card/list heading     |
| Body    | `--font-size-base`, regular | Default copy          |
| Body/sm | `--font-size-sm`, regular   | Secondary information |
| Caption | `--font-size-xs`, medium    | Labels and metadata   |

Primary and heading stacks use the existing Apple/Segoe/system stack; monospace uses SF Mono/Fira Code/Consolas. Body text remains at least 14px.

## 4. Spacing & Layout

Spacing uses the existing 4px scale: `--space-1` through `--space-20`. Mobile content is one readable column with 16px Ionic padding. The established application split is mobile below 1080px, tablet from 1080px, and desktop from 1280px; desktop work surfaces stay within the existing sidebar/content shell.

## 5. Components

### Ionic Work Form

- **Structure**: toolbar, padded content, list of labeled Ionic fields, inline feedback, full-width primary action.
- **Variants**: create, edit, conditional fields.
- **Spacing**: Ionic list rhythm plus `--space-4` content padding.
- **States**: enabled, disabled, saving, success, validation error.
- **Accessibility**: visible labels, native input semantics, keyboard reachability, 44px minimum touch targets.
- **Motion**: Ionic defaults only.
- **Layout**: single-column stack; content owns vertical scroll.

### Financial Summary List

- **Structure**: document identity row, fee sections, supply/VAT/total rows, document actions.
- **Variants**: DRAFT, ISSUED, PAID, CANCELLED; HQ and partner views.
- **Spacing**: standard Ionic item rhythm.
- **States**: loading, empty, error, status-dependent actions.
- **Accessibility**: amount labels remain textual; destructive cancellation is explicitly labeled.
- **Motion**: none beyond Ionic feedback.
- **Layout**: stacked list; content owns vertical scroll.

## 6. Motion & Interaction

Use Ionic's existing 100–300ms interaction feedback. Animate only opacity and transform. New workflows do not add decorative motion; reduced-motion preferences therefore remain unaffected.

## 7. Depth & Surface

Mixed strategy inherited from the application: subtle `--gray-200` borders define dense operational lists, while cards may use `--shadow-sm`. No new elevation levels are introduced.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

Target WCAG 2.2 AA: 4.5:1 body contrast, visible focus, full keyboard reachability, 44px touch targets, textual status labels, and readable single-column reflow at 375px without primary-content overflow.

### Accepted Debt

| Item                                    | Location                                       | Why accepted                                                  | Owner / Exit                                         |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Existing raw colors coexist with tokens | `apps/web/src/global.scss`, `_web-layout.scss` | Pre-existing system inconsistency; unrelated to the PRD slice | Consolidate during an approved design-system cleanup |
