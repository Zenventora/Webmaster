# SiteRadar implementation backlog

## Verified implementation snapshot — 2026-10-29

- **Foundation UI:** React/TypeScript/Vite app, responsive theme, protected routes, website project CRUD and auth route components are present. Public `/pricing`, post-signup `/setup`, workspace-aware route guard, and `/app/billing` edition management are now in code.
- **Auth code:** PKCE session persistence/refresh, confirmation callback, resend-confirmation UI, forgot-password, recovery-code exchange, recovery-only password reset, logout and session guards are implemented in code. Real inbox delivery and full end-to-end flow testing are pending Supabase Auth URL/SMTP configuration.
- **Crawler MVP:** deployed authenticated Edge Function `run-site-audit` verifies user/workspace membership, revalidates public hostname/DNS and redirects, observes robots paths, checks sitemap URLs, crawls up to 15 same-host pages per run, persists page/link/issue evidence, and detects HTTP/fetch errors, title/description/H1/canonical issues, duplicate metadata/content candidates, missing viewport/language, image alt gaps, noindex and redirect hints.
- **Dashboard and reports:** workspace KPIs use saved records; audit activity has period/site filters, a real-data bar chart, an open-issue severity donut, and a finding-trend line chart. Reports exports up to 500 audit runs and 5,000 loaded issues as CSV. Page-inventory export and PDF/shareable reports remain incomplete.
- **Editions and onboarding:** Free/Standard/Ultimate public pricing, edition-preserving signup, protected post-signup workspace/site setup, actual workspace plan status, website/monthly audit usage meters, trial start/expiry refresh, coupon validation and trial-day coupon redemption are in source. Database triggers enforce current website and monthly audit quotas. The feature catalog separates entitlements from implementation readiness; prices remain unset and payment checkout is not connected.
- **Issue and page UI:** audit history, issue explorer with status transitions, and page inventory are wired to persisted data.
- **Email:** audit-completed template and subscription lifecycle worker are deployed; trial start/reminder/expiry and subscription notices are queued and can be sent through Resend. Actual email delivery and daily scheduled processing still require Supabase/GitHub secrets and inbox tests. Supabase Auth custom SMTP and confirmation/reset templates still need Dashboard configuration.
- **CI:** the prior baseline frontend typecheck/build and crawler typecheck passed; the current multi-file edition/onboarding changes have not been independently rerun through a confirmed CI result in this session. CI now includes typechecking for the lifecycle Edge Function. Dependency audit previously reached zero advisories after upgrading React Router to 7.18.5.
- **Not release-ready:** eMenu exact UI match still needs a live browser comparison; auth/coupon/trial email end-to-end tests are pending. Lifecycle worker is deployed, but scheduled execution requires `SITERADAR_LIFECYCLE_SECRET` in Supabase and GitHub Actions plus Resend secrets. No payment provider/prices are configured. Production-grade queueing, network-level SSRF controls, JS rendering, Lighthouse/CrUX, external link checks, full performance/accessibility/security engines, and PDF/shareable reporting remain future work.


## P0 — foundation (must finish first)

- [ ] Create Vite + React + TypeScript app shell from approved design tokens and reusable controls.
- [ ] Add routes, typed route boundaries, responsive navigation, and public/protected layouts.
- [ ] Add env.example, README setup steps, lockfile, formatting/lint/typecheck/test/build scripts.
- [ ] Keep secrets out of code and logs; use a browser-safe Supabase publishable key only.
- [ ] Add reusable FormField, PasswordField, Button, Alert, Toast, EmptyState, LoadingState and Modal patterns.
- [ ] Add accessible form labels, keyboard navigation, visible focus, reduced motion and mobile layout checks.

**Acceptance:** fresh clone installs reproducibly, lint/typecheck/tests/build pass, no secrets are tracked, and every route has a designed loading/error state.

## P1 — authentication

- [ ] Signup page with password confirmation, policy feedback and confirmation-pending state.
- [ ] Login page with show/hide password, generic error handling, busy state and safe next route.
- [ ] Forgot-password form with generic submission result and abuse/rate-limit UX.
- [ ] Reset-password page that requires a valid Supabase recovery session.
- [ ] Auth callback/confirmation handler and clear invalid/expired-link screen.
- [ ] Protected app shell and reliable logout/session restore.
- [ ] Profile display and minimal security settings.
- [ ] Supabase redirect allow-list and auth provider configuration documented.
- [ ] Resend transactional templates or Supabase Auth templates configured, sent and verified in non-production.
- [ ] Tests for confirmation, recovery, bad tokens, redirect allow-list, session and cross-user access.

**Acceptance:** every auth flow works with real Supabase Auth in a configured environment; no mock success; email links return to the intended safe route.

## P2 — project setup and crawl worker

- [ ] Create website/project form with validated start URL or sitemap URL.
- [ ] Allow scope/depth/URL/request/bytes/timeout/rate options with sensible defaults and validation.
- [ ] Add sitemap index + nested sitemap parsing, XML/gzip limits, invalid XML and robots sitemap discovery.
- [ ] Build a queue-backed crawl worker with progress, retries, dedupe, cancellation and partial results.
- [ ] Validate every redirect and destination IP; block loopback, private, link-local and metadata IPs.
- [ ] Respect robots.txt; set a recognizable user agent; don't make state-changing requests.
- [ ] Persist audit run, pages, crawl events and failures in isolated tenant data.
- [ ] Record page status, final URL, response headers subset, content type, canonical, title, description, headings, robots, links, images, language, structured-data presence.
- [ ] Add adversarial SSRF, redirect-loop, DNS rebinding, infinite sitemap, huge response and worker-crash tests.

**Acceptance:** a permitted public website can be crawled within limits; blocked or unfetched pages are never shown as passing; cancelled runs terminate safely.

## P3 — technical audit and issue explorer

- [ ] Versioned rule registry with category, severity, evidence schema and fix explanation.
- [ ] Missing/duplicate title and description, missing H1, canonical problems, noindex, sitemap mismatch.
- [ ] Broken internal links, redirect chains/loops, errors, soft-404 candidates and orphan-page candidates.
- [ ] Structured filters, full-text URL search, pagination and grouped issue details.
- [ ] Page inspector with inlinks/outlinks, status chain and extracted meta tags.
- [ ] Issue lifecycle across audits: new, recurring, resolved, ignored; track first/last seen.
- [x] CSV export for audit history and issue register (bounded to the latest 500 audit runs and 5,000 loaded issues).
- [ ] CSV export for page inventory.
- [ ] Category score formulas documented, testable and versioned.

**Acceptance:** every displayed issue points to reproducible evidence, affected URL(s), rule version and actionable guidance.

## P4 — quality and extended diagnosis

- [ ] Lighthouse test worker for selected pages, mobile/desktop labels and bounded concurrency.
- [ ] CrUX integration when data is available; record data source, freshness and unavailable states distinctly.
- [ ] Resource inventory and performance history; compare prior runs and flag regressions.
- [ ] Automated accessibility rules with explicit scope/limitations and manual review notice.
- [ ] Safe security observations: HTTPS, mixed content and security headers; no intrusive exploit tests.
- [ ] AI-crawler access observations based on robots and reachable resources; no ranking guarantees.
- [ ] Crawl graph for internal links and depth, with accessible alternate table/list view.
- [ ] PDF report/export and controlled expiring share link.

**Acceptance:** test sources are labelled correctly, missing data is not a pass, and diagnostics don't claim complete security/accessibility compliance.

## P5 — monitoring and SaaS readiness

- [ ] Scheduled audit configuration, job state machine and duplicate-run prevention.
- [ ] Uptime checks, incident state transitions and down/recovered alerts.
- [ ] Resend integration for transactional email with idempotency and delivery logging.
- [ ] Notification preferences and per-project threshold controls.
- [ ] Workspace membership and explicit roles; invite/revoke workflow.
- [ ] Usage limits, job quotas, retention and deletion workflow.
- [ ] API/webhooks and external integrations with scoped secrets and audit logs.
- [ ] Regression/large-crawl/load tests, backup/restore practice and operational dashboards.

**Acceptance:** scheduled tasks survive worker restart without duplicate notifications; workspace isolation is tested; usage/retention controls are enforced server-side.

## Page-by-page UI quality checklist

Each screen must have:
- Default state
- Loading/skeleton state
- Empty state with meaningful next action
- Validation state
- Success feedback
- Permission/auth error
- Network/server error and retry
- Mobile layout
- Keyboard/focus behavior
- Long text and overflow behavior
- Accessible contrast and form labels

## Suggested routes

Public: /, /login, /signup, /forgot-password, /reset-password, /auth/callback, /auth/error, /privacy, /terms.

Authenticated: /app, /app/sites, /app/sites/new, /app/sites/:siteId, /app/sites/:siteId/audits/:auditId, /app/pages, /app/issues, /app/crawl-map, /app/performance, /app/accessibility, /app/security, /app/ai-readiness, /app/monitoring, /app/reports, /app/integrations, /app/settings/profile, /app/settings/team, /app/settings/notifications.

## Workflow acceptance

- Work on a feature branch; make small commits; open a PR with summary, screenshots, tests and known limits.
- Include database migration and rollback notes for schema changes.
- Run tests/typecheck/lint/build before merge.
- Never claim a connector has been configured merely because it is linked; verify actual provider config and a test email.

- **Product registry:** public product catalog and workspace product entitlements are deployed. SiteRadar entitlements mirror subscription plan/status and feature/limit snapshots; E1 and Inventory are visible as integration-pending. Shared-auth redirects are allow-listed by catalog state and configured URL, not a user-supplied arbitrary destination.
- **Feature matrix:** 33 capability keys now distinguish plan entitlement from implementation status. Eight current MVP capabilities are marked available; advanced crawling, performance, accessibility, security, monitoring, PDF/white-label, API and integrations remain explicitly marked coming soon.


## SiteRadar readiness update — 2026-11-08

- Public marketing/landing routes have been removed from the product entry flow; `/`, `/pricing`, and `/products` direct users to the single login/signup entry point. `/login?mode=signup` selects signup; existing users retain the dashboard route after authentication.
- Product display branding and document title use SiteRadar. Existing database table/function names and the central account product slug `siteradar` are intentionally retained as internal compatibility identifiers until the shared-account cutover is completed.
- Sitemap discovery now follows same-host sitemap indexes to a bounded depth and file count, collects up to 2,000 candidate URLs, and supports up to 50 pages per run subject to edition limits and a 90-second execution budget.
- Standard workspace target capacity is raised to 10 sites; Free remains 1 and Ultimate 25. The corresponding plan migration is `20261108110000_vadx_multi_site_crawl_capacity.sql` and still needs to be applied to an active SiteRadar database.
- Reports now include a bounded page-inventory CSV export and CSV formula-injection protection. Dashboard page totals follow the selected site/date filters.
- Still blocked from release verification: the dedicated SiteRadar Supabase project is inactive due the organization's Free plan limit of two active projects. No other production Supabase project was paused. The account-session consolidation, real signup/login/confirmation, cross-tenant authorization tests, and full 5–6 website audit run must be completed against the active database before calling this a customer-demo-ready release.


### Additional SiteRadar dashboard views — 2026-11-08

- Crawl Map reads the latest `pages` and `page_links` records, grouped by crawl depth and link mapping state.
- Performance view shows measured crawler response duration and HTML bytes. It must not be labelled Core Web Vitals or Lighthouse data.
- Accessibility view displays saved `accessibility` category issues. The current HTML rules are partial signals, not a WCAG conformance statement.
- Security view displays homepage response-header observations (HSTS, CSP, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options). It is not a vulnerability scan or penetration test.
- Audit crawler stores response duration and those header values in each page's `meta_snapshot`; page response times above 2.5 seconds create a review finding.
- Vite updated to 6.4.5 to remediate the advisory detected in the earlier CI run.
