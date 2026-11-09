# SiteRadar Supabase + Resend configuration

Dedicated Supabase project:
- Project ref: `icqkurgimumojmtnzxya`
- URL: `https://icqkurgimumojmtnzxya.supabase.co`
- Region: `ap-south-1`

The database schema and RLS policies are applied. The `run-site-audit` Edge Function is deployed with JWT verification enabled. This checklist records provider settings that cannot be safely completed from repository code alone.

## 1. Authentication URL settings

In Supabase Dashboard → Authentication → URL Configuration:
- Set **Site URL** to the actual SiteRadar deployed URL. Do not use the ZenVentora site URL unless SiteRadar is actually hosted there.
- Add local callback: `http://localhost:5173/auth/callback*`
- Add local recovery: `http://localhost:5173/reset-password*`
- Add production callback: `https://YOUR-SITERADAR-HOST/auth/callback*`
- Add production recovery: `https://YOUR-SITERADAR-HOST/reset-password*`
- Replace the placeholder with the actual deployed host before testing.
- Keep the allow-list restricted to SiteRadar and local development only.
- The app uses PKCE and manually exchanges one-time codes. Do not enable implicit-flow-only assumptions in custom templates.

## 2. Email Auth provider and password recovery

In Authentication → Sign In / Providers:
- Enable Email/password.
- Keep email confirmation enabled for production; don't enable auto-confirm just to hide delivery problems.
- Configure the confirmation email's redirect to the allowed `/auth/callback` route.
- Configure password recovery links to use `/reset-password?type=recovery`.
- Use the Auth email templates in [auth-email-templates.md](auth-email-templates.md).
- Test signup confirmation, expired/reused links, resend-confirmation, forgot password, valid reset, invalid reset, signed-in visit to reset route, logout and session expiry.

## 3. Configure Resend SMTP for Supabase Auth

Resend currently has the domain `zenventora.in` verified and sending enabled. The requested sender for SiteRadar is `sales@zenventora.in`; confirm that this exact address is accepted as a sender under the verified domain before testing. A separate authentication subdomain is an optional later improvement, but requires DNS verification.

In Resend:
1. Create a **Sending** API key. Keep it private; never paste it into GitHub or frontend environment variables.
2. Use `sales@zenventora.in` as the preferred sender address if the provider accepts it for the verified domain.
3. Ensure SPF/DKIM are verified; publish DMARC policy appropriate for the domain.

In Supabase Dashboard → Project Settings / Authentication → SMTP Settings (the exact navigation label may vary):
- Enable Custom SMTP.
- Host: `smtp.resend.com`
- Port: `465` (SSL) or `587` (STARTTLS)
- Username: `resend`
- Password: the Resend API key created above
- Sender email: `sales@zenventora.in`
- Sender name: `SiteRadar`
- Save settings and test confirmation + recovery emails to an address you control.

Supabase Auth emails (confirmation and password recovery) are sent by Supabase Auth through this SMTP connection. Published Resend templates do **not** automatically replace Supabase Auth templates.

Official references:
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend SMTP credentials](https://resend.com/changelog/smtp-service)

## 4. Edge Function secrets

The deployed crawler uses the Supabase-managed `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` server environment values. Do not copy those into the browser app. The Resend templates below are published, but actual delivery remains off until secrets and a sender are configured.

In Supabase Dashboard → Edge Functions → Secrets, add:
- `SITERADAR_APP_URL` = the actual SiteRadar origin, e.g. `https://YOUR-SITERADAR-HOST` (without a trailing slash)
- `RESEND_API_KEY` = the Resend sending API key
- `SITERADAR_FROM_EMAIL` = `SiteRadar <sales@zenventora.in>` (if accepted by Resend as a verified sender)
- `SITERADAR_AUDIT_TEMPLATE_ID` = `acc59f5f-2875-4246-83d7-2069cdb36f2b`

Published Resend templates:
- Audit completed: `SiteRadar — Audit Completed` (ID: `acc59f5f-2875-4246-83d7-2069cdb36f2b`)
- Uptime down: `SiteRadar — Uptime Down Alert` (ID: `e6efa426-ce97-4351-9ff3-ca214ca30c9b`)

The uptime template is published for the future monitoring worker; the current crawler only sends the audit-completed template.

The function intentionally skips the audit-completed email if the Resend key or sender is absent; the audit itself can still finish. Never set these as `VITE_*` variables.

## 5. SiteRadar Edge Function status

- `run-site-audit` is deployed and requires an authenticated JWT.
- It verifies the signed-in user and workspace membership before crawling.
- It performs a bounded MVP crawl (up to 15 pages; UI default 15), same hostname only, robots.txt-aware path checks, sitemap URL discovery, HTTP status capture, HTML title/description/H1/canonical checks and internal links within the fetched page set.
- It writes audit runs, pages, links and issues into the existing RLS-protected schema using a server-side service role.
- It sends the audit-completed Resend template only after the four secrets above are configured.

## 6. Important production gaps

This is a real first crawler milestone, not a full Ahrefs/Semrush/Sitebulb/DebugBear replacement yet:
- No JavaScript rendering, Lighthouse/Core Web Vitals/CrUX, external-link status checks, scheduled queue worker, crawl pause/resume or full issue lifecycle reconciliation.
- The MVP uses DNS checks before requests, but production SSRF defence still needs an isolated worker with network-level egress restrictions and DNS-rebinding-safe transport.
- Robots parsing is conservative and does not implement every wildcard edge case.
- Only the first 20 pages are checked per request; longer audits need a durable queue/worker instead of a single synchronous Edge Function.
- Validate with two separate user accounts and adversarial URLs before allowing broad beta use.

## 7. Frontend environment

Copy `.env.example` to `.env.local` and set:
- `VITE_SUPABASE_URL=https://icqkurgimumojmtnzxya.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` to the project publishable key
- `VITE_APP_URL` to local app origin or actual deployed SiteRadar origin

Only a publishable key belongs in browser code. Never add a service-role key or Resend API key to a `VITE_*` variable or commit `.env.local`.


## 8. Edition, trial and lifecycle configuration

The edition catalog and subscription tables are now deployed. Free, Standard and Ultimate are stored in `public.plan_catalog`; prices are intentionally NULL until approved. Standard/Ultimate default to a 14-day trial and the duration is read from the database, so it can be changed to 20 days by an authorized database administrator without a code change.

The `process-subscription-lifecycle` Edge Function is deployed with JWT verification disabled but requires the private `x-lifecycle-secret` header. It expires trials, queues 3-day/1-day reminders, and sends queued subscription notices through Resend when configured. To activate scheduled processing:

1. Generate a strong random secret locally; do not paste it into chat or commit it.
2. In Supabase Dashboard → Edge Functions → Secrets, set `SITERADAR_LIFECYCLE_SECRET` to that value.
3. Set `RESEND_API_KEY`, `SITERADAR_FROM_EMAIL=SiteRadar <sales@zenventora.in>`, and `SITERADAR_APP_URL` to the real deployed SiteRadar URL.
4. In GitHub repository Settings → Secrets and variables → Actions, create `SITERADAR_LIFECYCLE_SECRET` with the exact same random value.
5. Run the **SiteRadar subscription lifecycle** workflow manually once, inspect its response/logs, and confirm the email arrives. It is scheduled daily at 04:15 UTC after the secret is configured.

The worker leaves notices queued when Resend configuration is missing. Its deployed status alone does not mean emails are being sent.

## 9. Edition limits and current payment boundary

- Database triggers enforce the catalog's website limit and monthly audit-run limit; the crawler also checks the monthly audit quota and returns a clear limit response.
- Standard/Ultimate trial selection is server-side and a workspace/user cannot repeatedly start the same trial through the supported onboarding RPC.
- Coupon validation is server-side. Trial-day coupons can extend a trial within the 60-day hard limit. Percentage/fixed-amount coupons are validated but are not applied until a real payment provider is selected and checkout is enabled.
- No payment provider is connected. Prices are not configured, and the UI must not claim a paid transaction succeeded.
- The public edition selection query parameter chooses a plan request only; the backend starts at most one configured trial and never treats a URL parameter as proof of payment.
- The GitHub workflow will be skipped until `SITERADAR_LIFECYCLE_SECRET` is configured in repository Actions secrets.
