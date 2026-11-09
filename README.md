# SiteRadar

**Website Intelligence & Monitoring Platform**  
*Every Page. Every Issue. One Clear View.*

SiteRadar combines planned technical SEO crawling, issue exploration, performance diagnostics and monitoring into one workspace.

## Current development status

### Built / connected
- React + TypeScript + Vite scaffold in GitHub.
- Dark navy/blue interim theme; the requested eMenu source is currently unavailable in its repository, so an exact reference match is pending.
- A single login/signup entry route, forgot-password, reset-password and auth-callback routes. Public marketing landing, pricing and product-directory pages now redirect to the account entry point.
- Supabase browser client uses PKCE, persistent sessions, auto-refresh, explicit one-time code exchange and a recovery-session guard.
- Protected app shell, real-data overview analytics, websites list, create-site, site-detail, crawl-map, response-timing, accessibility findings and security-header observation views.
- Website detail UI can invoke the authenticated `run-site-audit` Edge Function and displays persisted audit history and summaries.
- Dashboard KPIs use saved Supabase records; audit activity chart compares real pages-checked and finding counts from the latest 12 saved runs.
- Reports page exports saved audit history, issue records and page inventory to CSV (bounded to 500 runs, 5,000 issues and 10,000 latest pages).
- Dedicated SiteRadar Supabase project created separately from the existing production project; it is currently inactive because the organization is at its Free-tier active-project limit.
- Core tenant-oriented schema applied; all 15 public application tables have RLS enabled.
- Membership policy recursion was addressed using a private membership-check helper; Supabase security advisor currently reports no lints.
- Resend templates for audit completion and uptime-down notifications have been created and published.
- Product blueprint, competitor feature matrix, design system, auth flows, data model and prioritized backlog documented.

### Not implemented or not verified yet
- Supabase Auth dashboard URL/redirect allow-list, Custom SMTP settings and confirmation/recovery delivery. The repository contains copy-ready templates and a setup checklist, but provider settings still need a verified sender and secrets.
- End-to-end tests of signup, login, confirmation, password recovery, cross-tenant isolation and a real crawl from an authenticated browser session.
- The current `run-site-audit` function is a bounded MVP (up to 50 pages per request subject to edition limits and a 90-second safety budget, same-host only, with nested sitemap-index discovery and non-JavaScript HTML checks). It is not yet a queue-backed production crawler.
- Not implemented: JavaScript rendering, Lighthouse/CrUX/Core Web Vitals, external link-status crawling, full WCAG accessibility/security audits, scheduled monitoring, uptime polling, PDF/shareable reports, queue-backed large-crawl processing and integrations. Current performance and security screens show bounded crawler timing and HTTP-header observations only.
- The current run includes frontend typecheck/build and Deno crawler checks in GitHub Actions; see the latest workflow result before release.

Vite is pinned to 6.4.5. The UI deliberately displays “not tested / awaiting first audit” instead of fabricated crawl metrics. The dashboard analytics are driven by saved audit, issue and site rows; no sample analytics are presented.

## Visual reference

Requested live visual reference: https://emenu.zenventora.in/

The eMenu source repository currently contains only a README, and the live URL could not be fetched by the inspection tools during the latest review. A pixel-level auth-theme match is therefore not verified. SiteRadar currently uses an interim dark theme; do not describe it as an exact eMenu match until the live screens can be inspected and compared.

## Local development

1. Install Node.js LTS.
2. Clone this repository.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_APP_URL`.
6. In Supabase Auth, configure the Site URL and exact redirect allow-list. See [Supabase configuration checklist](supabase/configuration-checklist.md).
7. Run `npm run dev`.
8. Before merge, run `npm run typecheck` and `npm run build`.

Never commit `.env.local`. Never expose service-role keys or secret credentials in a `VITE_*` variable.

## Supabase project

- Project ref: `icqkurgimumojmtnzxya`
- URL: https://icqkurgimumojmtnzxya.supabase.co
- Region: ap-south-1

The dedicated project has an initial tenant-oriented schema and RLS. Restoring it is blocked until the organization frees an active-project slot or upgrades its Supabase plan. See [data model](docs/DATA-MODEL.md) and [configuration checklist](supabase/configuration-checklist.md). Auth dashboard configuration and real end-to-end tests remain pending.

## Demo readiness

- [Current capability coverage, demo checklist and release blockers](docs/DEMO-READINESS.md)

## Product planning

- [Competitor matrix and feature coverage](docs/COMPETITOR-MATRIX.md)
- [Design system](docs/DESIGN-SYSTEM.md)
- [Auth and email flows](docs/AUTH-AND-EMAIL-FLOWS.md)
- [Implementation backlog](docs/IMPLEMENTATION-BACKLOG.md)
- [Data model and RLS requirements](docs/DATA-MODEL.md)
- [Resend email catalog](docs/RESEND-EMAIL-CATALOG.md)

## Architecture and safety principles

- Browser clients use only Supabase publishable keys. Service-role secrets stay server-side.
- Every workspace-owned row is protected by membership and RLS.
- The current crawler runs as a bounded Supabase Edge Function; a queue-backed worker with network-level egress isolation remains required for larger production crawls.
- Validate every URL and redirect, block private/reserved targets, enforce bounded budgets, and respect robots.txt.
- Distinguish passed, failed, skipped, blocked and unavailable checks; missing data must never become a pass.
- Automated accessibility/security checks are signals, not full compliance or penetration-test claims.
