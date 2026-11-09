# SiteRadar — demo readiness and operating model

**Reviewed:** 2026-11-08  
**Product name:** SiteRadar

This document separates capabilities that are present in the current code from capabilities that are still required before SiteRadar can be presented as a production-ready website intelligence platform. A navigation item or plan entitlement is not treated as an implemented engine.

## Current product flow

1. A user opens the single account entry page. New and returning users use the same login/signup surface.
2. An existing signed-in user is routed into the protected app. A user without a completed workspace is routed to account setup.
3. The initial setup creates the organization/workspace and first website. The exact shared ZenVentora Accounts session handoff remains a later integration step after the approved contract is supplied.
4. Additional websites belong to the same active workspace. Adding a second website must not create another workspace.
5. A team can bulk-add its website portfolio in one save, using one line per property:

   `Website name | https://website.example | https://website.example/sitemap.xml`

   The sitemap value is optional. Up to 25 lines can be submitted in a batch. Duplicate origins within the batch are rejected, existing workspace origins are skipped, and database RLS/edition quotas still apply.
6. Each website detail page can start an authenticated audit. Results are saved as audit runs, page records, links, issues and issue occurrences.
7. Dashboard analytics, issue triage, audit history, page inventory and CSV exports read saved database records. Empty/unavailable states must never be presented as a successful measurement.

## Capabilities available in the bounded MVP

| Area | Current implementation |
|---|---|
| Account entry | One login/signup entry route; existing valid sessions route to the product; new accounts go through setup |
| Workspace and sites | Workspace membership/roles, workspace-scoped queries, single-site add and batch website import into one workspace |
| Sitemap discovery | Configured sitemap URL, robots.txt sitemap declarations, default `/sitemap.xml`, nested same-host sitemap indexes (up to 12 files / 2,000 discovered URLs), gzip sitemap support |
| Crawl safety | Authenticated audit invocation, workspace role checks, same-host redirects, public DNS/IP checks before requests, robots rules, four redirect hops, 6-second per-request cap, 1 MB response/decompressed-body cap |
| Crawl budget | Up to 50 pages per run subject to edition limits and a 90-second overall budget. Free remains 15 pages per run; Standard/Ultimate target 50 pages after the included plan migration is applied. Remaining work is labelled partial |
| Technical checks | HTTP/fetch errors, missing/long titles, descriptions, H1 presence/count, canonical presence/cross-host canonical, noindex, viewport, HTML language, charset, image alt omissions, redirect chain, duplicate metadata/content fingerprints and internal links to fetched 4xx/5xx pages |
| Page diagnostics | Response-time and response-size observations, passive homepage security-header observations, limited automated accessibility issue rules, crawl-depth/link mapping |
| Issue lifecycle | Open/ignored/resolved states, issue occurrences/evidence, ignored state retained across later scans, and auto-resolution only when the source page is successfully fetched again and the finding is not reproduced |
| Analytics | Saved audit/site/issue metrics, audit activity and finding trend, severity breakdown, selected website/date filters |
| Reports | CSV exports for audit history, issue register and page inventory; CSV formula-injection protection |
| Commercial foundation | Free/Standard/Ultimate plan catalog, feature catalog, workspace entitlements, site/audit quota enforcement, trial/coupon groundwork and subscription lifecycle queue |

## Hard limits — do not claim these as complete

- **Large-site crawling is not production-ready.** The current crawler is a bounded synchronous Edge Function, not a durable queue-backed worker. A 90-second timeout or page cap can leave a site partially crawled. Sites with hundreds or thousands of URLs need queue continuation, progress, retries, cancellation, concurrency/rate controls and durable worker processing.
- Sitemap discovery is same-host only, is bounded to 12 sitemap files and 2,000 URLs, and does not support every third-party sitemap arrangement.
- The crawler does not render JavaScript, run Lighthouse, collect CrUX/Core Web Vitals, check every external link, run a complete WCAG scan, perform penetration testing or verify AI search rankings.
- Performance is HTTP response timing/size, not Lighthouse or Core Web Vitals. Accessibility checks are heuristics, not WCAG certification. Security checks are passive HTTP-header observations, not a vulnerability scan or penetration test.
- Scheduled recurring audits, uptime polling/alerts, PDF/white-label reports, expiring share links, scheduled report delivery, external integrations and public API access are not complete.
- Paid checkout is not connected. Prices remain unapproved/unset; a trial is not a payment confirmation.
- Workspace switching, full team invitation/member administration and account-profile management remain incomplete. The current app context resolves the most recently joined active workspace membership.
- The central ZenVentora Accounts SSO/session handoff must not be guessed. Keep the temporary SiteRadar auth path until the approved callback parameters, product attribution and session rules are supplied and tested.

## Internal demo checklist

Before showing the product to the team:

- [ ] Restore the dedicated SiteRadar Supabase project and verify it is `ACTIVE_HEALTHY`.
- [ ] Confirm Render's `VITE_SUPABASE_URL` and publishable key point to that restored SiteRadar project.
- [ ] Set the exact SiteRadar application URL and auth redirect allow-list in Supabase.
- [ ] Configure SMTP and verify confirmation and password-recovery delivery in a real inbox.
- [ ] Create a fresh demo account and one demo workspace.
- [ ] Bulk-add the 5–6 demo websites with their sitemap URLs.
- [ ] Run one audit per website. Record URLs discovered, pages fetched, time-budget usage, robots blocks, fetch failures and remaining/pending pages.
- [ ] Check that dashboard totals match the selected workspace's saved audit runs and open issues.
- [ ] Re-run one audit to verify ignored findings remain ignored and resolved findings reopen only when reproduced.
- [ ] Test two separate accounts and verify one account cannot read another workspace's websites, pages, issues or reports.
- [ ] Export audit history, issue register and page inventory CSVs and inspect the contents.

## Release blockers

1. **Supabase is currently the first blocker.** The dedicated `siteradar` project is inactive. The organization's Free plan already has two active projects; Supabase rejected the restore because another active project would need to be paused/deleted or the organization plan upgraded. No unrelated project should be paused without explicit approval.
2. **The plan migration is pending.** `20261108110000_siteradar_multi_site_crawl_capacity.sql` changes Standard to 10 sites and 50 pages/run and Ultimate to 25 sites and 50 pages/run. It must be applied to the dedicated database after that project is restored. Free remains one site and 15 pages/run.
3. **Durable crawler queue:** a synchronous 50-page / 90-second run is not sufficient for typical multi-hundred-page sites. Implement a worker before claiming full-site coverage.
4. **End-to-end verification:** deployed signup/login, email confirmation, password recovery, workspace setup, 5–6 real site audits, issue lifecycle and tenant isolation need browser tests against the restored database.
5. **Advanced diagnostics:** build and test each real engine before enabling the corresponding plan capability or presenting it as shipped.

## Safe demo wording

“SiteRadar's current MVP discovers same-host URLs from sitemap indexes, audits a bounded set of pages, records evidence-backed technical findings, and provides real audit analytics, issue triage, crawl/page views and CSV exports.”

Do not claim full-website queue crawling, JavaScript rendering, Lighthouse/Core Web Vitals, universal external broken-link detection, full security/accessibility audits or AI/search ranking analytics.
