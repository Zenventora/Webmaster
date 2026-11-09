# SiteRadar product QA review

Review date: 2026-10-29  
Scope: source-code review of the current `main` branch. This is not a claim that every browser, device, provider setting, or production email flow has been end-to-end tested.

## Current status

### Implemented in source
- React/TypeScript/Vite app with public landing, login, signup, forgot/reset password, auth callback, protected workspace shell and sign-out.
- Supabase session restore, PKCE callback handling, protected routes and recovery-session checks.
- Website creation/list/detail flows backed by Supabase.
- Authenticated `run-site-audit` function with bounded same-host HTML crawling and persisted run/page/link/issue data.
- Audit history, issue search/status/severity filters and page inventory.
- Dashboard workspace counts loaded from saved database records.
- Dashboard bar chart based on saved audit runs with period/site filters, plus open-issue severity donut and finding-trend line chart. Empty states avoid placeholder data.
- Public pricing page, Free/Standard/Ultimate selection, post-signup organization/site setup, workspace-aware route guard and subscription billing page.
- Current plan status, configurable trial dates, website/audit usage meters, trial-day coupon validation/redemption and a subscription notification center.
- CSV export for the latest 500 audit runs and up to 5,000 loaded issue records.
- Published Resend templates exist; audit-completion email code is conditional on server secrets. A lifecycle worker queues trial start/reminder/expiry and subscription notices; sending and schedule activation are still secret/config dependent.

### Known not complete / not verified
- The supplied eMenu live URL is now the intended auth visual reference: https://emenu.zenventora.in/. The live site could not be fetched by the current inspection tools during this review, so a pixel-level comparison has not been verified. Do not describe the current SiteRadar auth theme as an exact eMenu match yet.
- Supabase Auth Site URL/redirect allow-list, Custom SMTP and actual confirmation/recovery email delivery still require dashboard configuration and inbox tests.
- Final prices are not approved/configured, no payment provider or signed payment webhook is connected, and monetary coupon discounts cannot be applied yet. Trial-day coupons are supported.
- The current enforced crawler cap is 15 pages/run. Higher Standard/Ultimate page counts are target limits only until queueing/rendered crawl infrastructure is implemented.
- Feature entitlements are tiered in the plan catalog, but features marked Coming soon remain unavailable until their actual engines ship.
- Current branch changes have not had a confirmed final frontend typecheck/build or browser end-to-end test in this session.
- Production SiteRadar app URL is not confirmed in this repository's configuration.
- Dashboard chart shows crawl volume/findings, not web traffic, search clicks, rankings or performance. Those need real authorized integrations or measurement engines.
- CSV export is implemented for audit history and issues only. Page inventory export, PDF, branded report, share links, scheduled delivery and full unbounded history are not implemented.
- Performance page, accessibility scanner, security observations, AI readiness, crawl map, scheduled monitoring and uptime monitoring are still placeholder/planned modules.
- Barcode generation/scanning is not a native requirement for a website SEO audit platform. If "bar chart" was intended, the real-data audit chart is the relevant feature.
- Crawler MVP is capped at 15 pages per run and does not render JavaScript, run Lighthouse/CrUX, or verify external-link status. Network-level egress isolation and DNS-rebinding-safe SSRF controls remain production hardening work.

## Release QA matrix

| Area | Source status | Release gate |
|---|---|---|
| Auth screens and session | Code present | Test real signup, confirm, login, logout, expired/reused links, reset and refresh on deployed host |
| Email delivery | Not verified | Configure Supabase SMTP with `sales@zenventora.in`; send and receive confirmation, recovery and audit emails |
| Website CRUD | Code present | Test duplicate URLs, invalid URL, denied workspace, network errors and concurrent submit |
| Crawler | Bounded MVP | Test 15-page limit, robots rules, redirects, sitemap failures, timeouts, 4xx/5xx, SSRF and DNS rebinding |
| Dashboard KPIs | Real saved database counts | Compare each KPI with database query results for two isolated accounts |
| Audit chart | Real saved audit-run summaries | Test no data, one run, multiple runs, zero values, long date labels and mobile overflow |
| Issue explorer | Code present | Test filters, empty search, status transitions, permission failure and pagination limits |
| Reports | Audit + issue CSV | Verify quoting of commas/quotes/newlines, UTF-8, empty exports and record limits; PDF is not available |
| Performance/accessibility/security/crawl map/monitoring | Placeholder modules | Do not market as implemented until real data engines, states and tests exist |
| Responsive/accessibility | CSS patterns exist | Browser test at 320px, mobile, tablet and desktop; keyboard-only, focus, contrast and screen-reader checks |
| Production security | Partial foundation | Verify tenant isolation, rate limits, secrets, RLS, worker isolation, logging and backup/restore |

## Dashboard/report truthfulness rules
- Never substitute demo/sample values for missing production data.
- Show the metric source and date range for every chart.
- Distinguish not tested, unavailable, blocked, failed and passed.
- Do not label crawl findings as web analytics or Core Web Vitals.
- Do not claim full security or accessibility compliance from heuristic checks.
- Keep CSV limits visible and use server-side pagination/exports for large datasets.

## Next priorities
1. Match login/signup/recovery screens against the supplied eMenu live reference once its UI can be inspected.
2. Configure Supabase Auth URLs and SMTP; complete inbox end-to-end tests using `sales@zenventora.in`.
3. Add automated unit/integration tests for crawler rules, issue lifecycle, CSV output and cross-workspace RLS.
4. Build report/page-inventory exports and PDF reporting.
5. Implement real performance, accessibility and security diagnostic engines before presenting those navigation modules as available.
6. Harden crawler execution with durable queueing, strict network egress controls, per-hop IP validation, cancellation and retries.


## Release acceptance checklist (must pass before public paid launch)

### Authentication and first-run onboarding
- [ ] New Free signup preserves the selected edition parameter through email confirmation and lands on /setup, not directly on the dashboard.
- [ ] New Standard/Ultimate signup preserves edition and starts the configured trial only after the user submits organization/site setup.
- [ ] Setup creates workspace, owner membership, first site and subscription atomically; invalid site/slug or coupon must roll back the whole setup.
- [ ] Existing user login with an existing workspace lands on /app. Existing user with no workspace lands on /setup.
- [ ] Refresh, back/forward navigation, expired auth session, invalid recovery link and logout are tested in a real browser.
- [ ] eMenu live auth screens are compared screen-by-screen before claiming visual parity.

### Editions, quotas and coupons
- [ ] Free: 1 website and 5 audit runs per UTC calendar month; Standard: 5 websites and 50 audit runs; Ultimate: 25 websites and 250 audit runs.
- [ ] Database triggers reject over-limit site/audit inserts even if a client bypasses the UI.
- [ ] Current crawler cap is 15 pages per run for every edition. Do not enable 500/5,000-page target limits until the queue/worker supports them.
- [ ] Trial duration is read from plan_catalog (currently 14 days for Standard/Ultimate); confirm whether to change it to 20 days before launch.
- [ ] Trial-day coupons enforce active dates, plan applicability, global/per-workspace redemption caps and a 60-day total trial maximum.
- [ ] Percentage/fixed coupons must remain unapplied until a payment provider and signed/idempotent webhook flow are implemented.
- [ ] Expired trials downgrade to Free on subscription refresh/audit access. Daily reminders and email delivery require configured lifecycle and Resend secrets.

### Analytics and reports
- [ ] Bar chart, severity donut and finding-trend line chart use saved database data only.
- [ ] Date/site filters, zero-data states, failed runs, large counts and narrow mobile view are tested.
- [ ] CSV content is escaped correctly and does not expose another workspace's data.
- [ ] Do not label crawl findings as traffic, rankings or Core Web Vitals without a real measurement/integration source.

### Security, billing and operational readiness
- [ ] Test cross-workspace RLS using two distinct authenticated accounts and verify all rows, exports, notifications and audit actions are isolated.
- [ ] Verify the public wrapper RPCs cannot start trials or redeem coupons for a workspace the user does not own/administer.
- [ ] Configure and test Supabase Auth SMTP, sender address, confirmation/reset templates and redirect allow-list.
- [ ] Configure Supabase Edge Function secrets and GitHub Actions lifecycle secret, then verify trial-start, 3-day reminder, 1-day reminder, expiry and retry behavior in an inbox.
- [ ] Select a payment provider; implement checkout session creation, verified webhooks, idempotent payment events, receipts, failed-payment handling, cancellation and refunds before claiming paid checkout is live.
- [ ] Run final frontend typecheck/build, both Deno checks, dependency audit, database advisors and real browser end-to-end tests on the exact commit intended for release.


### Product registry and shared-login boundary
- Product catalog and workspace-level product entitlement tables are deployed. SiteRadar entitlement syncs from the current subscription; E1 and Inventory appear as integration-pending products.
- The directory only launches products explicitly marked available with a configured app URL. The signup query parameter accepts SiteRadar only and will not silently create an account for E1/Inventory.
- True cross-product SSO is not yet complete: E1/Inventory repository URLs, deployed app URLs, and shared Auth project configuration are required before the redirect and entitlement checks can be wired end-to-end.
