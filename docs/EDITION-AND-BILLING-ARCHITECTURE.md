# SiteRadar editions, onboarding and billing architecture

Status date: 2026-10-29

## Product goals

SiteRadar is a multi-tenant website-intelligence SaaS. Editions are server-authoritative and must never be granted by trusting a URL parameter or browser state alone. The eMenu live site (https://emenu.zenventora.in/) is the requested visual/flow reference for signup, login, forgot password, password recovery and session handling; do not claim pixel-level parity until the reference can be inspected in a browser.

## Edition selection and account flow

1. Public pricing/edition selection uses `?edition=free`, `?edition=standard`, or `?edition=ultimate`. Only the edition selection is carried forward; query parameters are untrusted input and never directly unlock features.
2. Signup collects only identity/authentication fields (name, email, password). It does not ask for organization/site details.
3. Email confirmation returns to the auth callback, exchanges the PKCE code once and restores the authenticated session.
4. A newly authenticated user with no completed workspace setup goes to `/setup`. Existing configured users go to `/app` after login/session restore.
5. Setup collects organization/workspace name and slug, then the first website name, URL and optional sitemap URL. It creates the workspace and site only after validation and a successful authenticated request.
6. A Free selection activates the permanent Free edition. A Standard/Ultimate selection starts the configured trial only once per workspace; current default is 14 days. Trial duration is catalog configuration and may be changed to 20 days without a code change. Coupon-added days are applied server-side.
7. When a trial ends, access falls back to Free unless a verified payment event activated a paid subscription. UI must clearly show trial expiry and downgrade; it must not continue to display paid entitlements.
8. A user who already has a configured workspace goes straight to the dashboard. Workspace switching and shared login across future products are separate from product-specific edition entitlements.

## Initial edition matrix

Price values are intentionally unset until the owner approves actual prices. Currency defaults to INR. Never display fabricated prices.

| Capability | Free | Standard | Ultimate |
|---|---|---|---|
| Permanent access | Yes | Paid or trial | Paid or trial |
| Trial | Not required | 14 days, configurable | 14 days, configurable |
| Website projects | 1 | 5 target | 25 target |
| Audit runs | 5/month target | 50/month target | 250/month target |
| Pages per audit | 15 (current crawler cap) | 15 until worker upgrade | 15 until worker upgrade |
| Audit history | 7 days target | 90 days target | 365 days target |
| Issue explorer and evidence | Basic | Advanced filters/history target | Advanced filters/history target |
| CSV exports | Yes, current bounded exports | Yes | Yes |
| PDF/branded reports | Not available yet | Planned | Planned |
| Scheduled audits | Not available yet | Planned | Planned |
| Uptime monitoring | Not available yet | Planned | Planned |
| Performance/Core Web Vitals | Not available yet | Planned | Planned |
| Accessibility/security diagnostics | Not available yet | Planned | Planned |
| Crawl graph | Not available yet | Planned | Planned |
| Team seats | 1 | 3 target | 10 target |
| API/white-label | No | No | Planned |
| Support | Standard help | Priority target | Priority/consultative target |

Important: target limits and planned capabilities are product-design targets, not claims that the engines are already implemented. The current crawler hard cap is 15 pages per run. Until queue-backed crawling and each diagnostic engine exist, the UI must label those capabilities as coming soon and must not simulate results.

## Subscription states

- `free`: permanent no-cost access.
- `trialing`: Standard or Ultimate trial with an authoritative `trial_ends_at`.
- `active`: payment/provider or authorized manual activation confirmed.
- `past_due`: payment failed; use a configurable grace period, then restrict paid features.
- `cancel_at_period_end`: paid access remains through `current_period_end`.
- `canceled`: cancellation finalized.
- `expired`: trial or subscription period ended; effective entitlement falls back to Free.
- `incomplete`: checkout/payment was initiated but not confirmed; do not unlock paid features.
- `paused`: administrative/provider pause.

## Payment and coupon rules

- Provider is not selected yet. Keep the subscription model provider-neutral; do not fake a successful payment.
- Checkout creates an `incomplete` record. Only a verified, signature-checked, idempotently processed provider webhook can activate a paid plan.
- Keep raw provider event payloads server-side; never expose them to normal workspace members.
- Coupons are normalized uppercase codes, with active window, plan applicability, discount type/value, redemption limits and optional extra trial days.
- Coupon validation and redemption are server-side, transactional and idempotent. A browser cannot set discount amounts, payment state, plan access, trial dates or provider IDs.
- For the current no-payment development stage, Standard/Ultimate access is through an explicitly requested trial, not a fabricated paid transaction. URL edition parameters select the desired trial; they do not prove payment.
- Pricing remains unset until approved. No checkout button should imply that a payment has been collected when no provider is configured.

## Lifecycle notifications

Send transactional notices with idempotency keys for:
- signup confirmation and recovery (Supabase Auth via SMTP sender `sales@zenventora.in`);
- workspace setup completed;
- trial started;
- trial ending in 3 days and 1 day;
- trial expired / downgraded to Free;
- payment pending/failed/past due;
- payment success / receipt;
- subscription cancellation and expiry;
- coupon applied/rejected;
- audit completed and future monitoring alerts.

Email delivery requires configured Supabase Custom SMTP/Resend secrets and real inbox tests. A notification row is not proof of successful delivery; track queued/sent/failed states.

## Analytics and charts

All workspace analytics are computed from that workspace's persisted records, with date range, selected website, metric source and data freshness shown. Support chart types only where data is meaningful:
- time-series line/area: audit score or issue-count trends across saved audit runs;
- bar: audits, pages crawled, issues by severity/category, per-site comparisons;
- stacked bar: severity/category distribution over time;
- donut/pie: current issue severity/category mix (not time trends);
- table: URL-level evidence, trend deltas and exact values;
- performance charts only after real Lighthouse/CrUX data exists;
- traffic/search/ranking charts only after a real authorized analytics/search-console integration exists.
No sample data, invented scores, fake traffic or decorative charts that imply measurement.

## Required engineering gates

1. Database schema and RLS for catalog, subscriptions, coupons, redemptions, provider events and notifications.
2. Secure onboarding state detection and workspace/site setup, with URL edition selection carried through auth redirects.
3. Server-side entitlement helper and feature gates for every protected action and UI route; hide/disable controls with a clear upgrade explanation.
4. Trial-expiry job, idempotent lifecycle notices, and downgrade tests.
5. Payment provider selection and signed webhook before real paid checkout is advertised.
6. Unit/integration tests for RLS cross-workspace isolation, duplicate webhook events, coupon limits, trial expiry, URL tampering, checkout cancellation/failure and existing-user login.
7. Product QA for all visible buttons: each must work, be disabled with an explanation, or be removed until supported.
8. Responsive/accessibility review for 320px/mobile/tablet/desktop, keyboard navigation, focus, contrast, loading, empty, success, retry and error states.

## Current release blockers

- Current crawler is a bounded MVP (15 pages/run), not a full Ahrefs/Semrush/Sitebulb/DebugBear replacement.
- Performance, accessibility, security, scheduled monitoring, uptime, crawl map, PDF/branded reports and shareable reports require real implementations.
- Auth email delivery and eMenu visual parity have not yet been end-to-end verified.
- No payment provider or approved prices are configured.
- Product-wide SSO across SiteRadar, E1 and Inventory needs a shared identity/product-launch contract; do not duplicate user identities per product.


## Competitor-informed feature coverage

The feature catalog is deliberately split into **plan entitlement** and **implementation status**. A feature can be included in Standard/Ultimate in the target product design while still displaying “Coming soon” until its real engine is delivered. This avoids selling a roadmap item as an already-working feature.

Reference sources reviewed on 2026-10-29:
- Ahrefs Site Audit advertises technical/on-page issue groups, JavaScript execution, issue prioritization, charts, exports, page/link explorers, crawl configuration and scheduled/always-on audit workflows: https://ahrefs.com/site-audit
- Semrush Site Audit advertises severity-weighted issues, thematic reports, recurring data refreshes, shareable/white-label reports, alerts and automated email reports: https://www.semrush.com/features/site-audit/
- Sitebulb advertises 300+ prioritized Hints, audit comparisons, JavaScript crawling, crawl visualizations, PDF reports, URL/link explorers and accessibility/international/performance reports: https://sitebulb.com/features/ and https://sitebulb.com/product/
- DebugBear advertises synthetic lab tests, Lighthouse, CrUX, real-user monitoring, uptime monitoring, alerting, custom dashboards, comparison and PDF/CSV sharing: https://www.debugbear.com/features

Those competitor counts and capabilities are references only; they are **not SiteRadar claims**.

### Product parity groups

1. **Technical crawl:** HTTP status, redirects, indexability, robots/sitemaps, canonicals, titles/descriptions/headings, duplicate metadata/content, image alt, mobile viewport/language, internal link failures.
2. **Exploration:** page explorer, link explorer, URL-level evidence, crawl depth and internal-link graph, URL include/exclude rules, custom crawl limits, raw vs rendered HTML.
3. **Analytics:** honest health score, issue severity/category distribution, time-series trends, audit-to-audit change deltas, affected URL counts and coverage, site comparisons, annotations and saved dashboard filters.
4. **Performance:** real Lighthouse lab runs, Core Web Vitals, CrUX field data, optional consent-aware RUM, request waterfalls, mobile/desktop profiles, budgets and regression alerts.
5. **Accessibility/security:** automated accessibility rule evidence, safe public security/header checks, robots access checks for search/AI user agents. Do not market these as penetration testing or full compliance certification.
6. **Automation/monitoring:** daily/weekly/monthly crawls, retry/queue handling, uptime checks, outage/recovery alerts, trial/subscription lifecycle notices, audit-completed emails.
7. **Reporting/agency:** CSV, PDF, branded/white-label reports, permissioned share links, scheduled email reports, client portal, team collaboration, API/webhooks, Search Console/Analytics integrations.
8. **Billing:** Free/Standard/Ultimate entitlements, configurable trial duration, coupon validation, trial reminders, expiry/downgrade, payment event idempotency, cancellation/past-due states and provider-backed receipts.

### Current implemented vs target

- The current technical crawler is bounded to **15 pages per run** and does not render JavaScript. It records the current MVP checks and real issue/page evidence.
- The public plan catalog enforces current website and monthly audit-run limits. The target matrix separately records higher page limits for Standard/Ultimate; these targets must not be enabled until the crawler/queue infrastructure supports them.
- Currently available feature keys: technical crawl MVP, issue explorer, audit history, CSV exports, robots/sitemap discovery, HTTP/redirect recording, duplicate metadata/content hints and basic internal-link checks.
- The rest of the catalog is marked as coming soon. Standard is intended for teams needing deeper exploration, audit comparisons, PDF, scheduled audits, uptime and performance/accessibility/security diagnostics. Ultimate adds JavaScript rendering, crawl visualizations, RUM, white-label/client portal, API and custom dashboards.
- Final monthly/annual prices remain NULL until approved. Fixed/percentage coupons validate but cannot apply monetary discounts before a payment provider and signed webhook flow are configured.


## Cross-product identity (E1 / Inventory)

The SiteRadar edition query parameter and account-setup flow are implemented for SiteRadar. They are **not, by themselves, cross-product SSO**. E1 and Inventory must use the same central Supabase Auth project (or a shared OIDC identity provider), trusted redirect URLs, a common user identity contract, and server-verified product entitlements. A URL parameter is only a requested destination/edition; it must never grant access by itself.

Before wiring E1/Inventory, confirm their repository URLs, deployed app URLs, current Supabase Auth project IDs and user/workspace tables. Then implement a product registry, per-workspace product entitlements, a safe allow-listed product redirect map and migration/identity mapping for existing users. Do not silently create duplicate user identities or copy passwords between Auth projects.
