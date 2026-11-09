# SiteRadar design system

## Reference

Use the user's existing Site Visual Editor repository as a visual reference:
https://github.com/samsahabdeenm/siteVisualEditor

Observed design characteristics: dark navy workspace, blue primary accent, Manrope display/headings, DM Sans UI typography, restrained borders, compact inputs, responsive three-column app layout, status toasts and useful empty states.

This document specifies a reusable design direction, not a pixel-perfect copy of another product.

## Tokens

- App background: #0e1118
- Topbar / deep surface: #121720
- Panel surface: #151a24
- Secondary surface: #1a202c
- Input surface: #10141d
- Border: #2a3140
- Muted text: #8f98aa
- Primary accent: #5877f0
- Accent highlight: #7895ff
- Positive: #56d6a1
- Error: #ff7d8d
- Typography: Manrope for headings; DM Sans for interface/body
- Radius: 7–10px for controls/cards; 10–14px for larger panels
- Focus state: visible blue outline/border and no removal of browser keyboard focus without replacement
- Motion: subtle, short transitions; respect prefers-reduced-motion

## Layouts

### Auth pages
- Responsive centered card or split-panel layout.
- SiteRadar brand mark and concise value proposition.
- Single-purpose form: do not combine signup and login into one cluttered panel.
- Clear links between login, signup and recovery.
- Form labels always visible; placeholders are supplementary.
- Success/error messages appear next to the form and are announced accessibly.
- Mobile: full-width form with comfortable touch targets.
- Never expose authenticated app navigation until auth state is confirmed.

### App shell
- Desktop: top bar plus collapsible left navigation and main content; optional context drawer for page details.
- Avoid forcing a three-column editor layout on every screen. Use the reference's structure only where it helps.
- Main overview: site selector, latest audit timestamp/status, category scorecards, issue severity counts, health/performance trends, prioritized next steps.
- Issue explorer: filter rail/drawer, search, table/list, detail panel with evidence and recommendations.
- Page inspector: URL/status/meta/indexability/link inventory with tabs and concise evidence.
- Crawl map: graph visualization with searchable/accessible table fallback.
- Reports: report metadata, export state and access expiry.

## Component patterns

- Button: primary, subtle/secondary, destructive, icon-only; visible disabled/loading state.
- Text field: label, optional hint, validation/help message, focus state.
- Password field: accessible show/hide toggle; no unexpected password-manager interference.
- Select/combobox: labelled, keyboard accessible, clear selected state.
- Toast: success/error/info, dismissible, concise and not the only way critical errors are communicated.
- Card: heading, optional metadata, main value, help text.
- Table: sticky header where useful, sorting/filtering states, responsive overflow and pagination.
- Status chip: neutral, success, warning, critical, unknown; don't use color alone to convey meaning.
- Empty state: explain why no data exists and offer a concrete next step.
- Loading state: skeleton or progress with a text explanation; no fake progress percentages.
- Error state: safe message, retry when appropriate, request/support reference if available.
- Dialog: accessible title, focus management, cancel action and destructive confirmation.
- Evidence block: source URL, captured time, rule version, extracted evidence and code/location when available.

## Content principles

- Plain language; state what was actually tested.
- Distinguish detected issue, heuristic candidate, unavailable, skipped and passed.
- Show evidence and a recommended next step for every issue.
- Avoid promising search rankings or full compliance.
- Label performance source as lab, CrUX field or RUM.
- Don't display fake statistics, fake charts or fabricated crawler results.

## Accessibility and responsive acceptance

- Keyboard-accessible navigation and operations.
- Visible focus.
- Semantic headings and labels.
- Accessible status/alert messages.
- Contrast suitable for normal text and controls.
- Reduced-motion support.
- Usable at 320px viewport width and standard tablet/desktop sizes.
- Long URLs, long issue titles, loading states and zero-data states do not break the layout.
- Graphs have accessible textual or tabular alternatives.
