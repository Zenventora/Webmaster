# SiteRadar transactional email catalog

These are product notification requirements, not configured/published templates. Do not use these as password-reset token templates; Supabase Auth remains the token authority.

## Templates to implement

1. Welcome / email verified: welcome text, what can be done next, link to the app.
2. Audit completed: project/site name, audit completion state, counts by severity, deep link to run.
3. Critical issues detected: site name, concise count, link to authenticated issue explorer. Do not include sensitive page contents.
4. Uptime down: monitored URL, first detected time, status/timeout reason, link to monitor history.
5. Uptime recovered: monitored URL, recovery time and approximate incident duration.
6. Scheduled report ready: report name, format, expiry and authenticated/download authorization link.
7. Workspace invitation: invitee, workspace, role, inviter and secure single-use invitation URL; rate limit creation and verify invitation on acceptance.
8. Security event notification: only for supported events and with minimal information; offer guidance to review account security.

## Common email quality rules

- Brand: SiteRadar; match the chosen app palette but ensure strong text contrast.
- Layout: responsive, accessible, table-based HTML compatible with major mail clients; provide text fallback.
- Use an informative subject and preheader, heading hierarchy, descriptive links and accessible language.
- Include a plain-text fallback.
- Never include raw passwords, long-lived credentials, service-role keys or confidential crawl evidence.
- Use idempotency keys and retry with backoff for transient failures.
- Verify recipient authorization before scheduling reports or sending workspace-specific summaries.
- Log email provider message ID, template version, notification type and delivery state; do not log sensitive template variables.
- Respect suppression/bounce/complaint status, and do not use transactional mail for unsolicited marketing.
- Handle repeated events without sending duplicate alerts. Alert on incident transitions and meaningful changes instead of every monitor poll.
- Ensure report links enforce authorization or expire; a guessed URL must not expose client data.

## Current provider state

Resend currently has a verified sending domain zenventora.in with sending enabled and receiving disabled. Two SiteRadar templates are published: `siteradar-audit-completed` and `siteradar-uptime-down`. The audit-completed template is wired into the crawler function but delivery is skipped until `RESEND_API_KEY`, `SITERADAR_FROM_EMAIL`, and `SITERADAR_APP_URL` are set in Supabase Edge Function secrets. Supabase Auth confirmation/reset templates are documented separately in `supabase/auth-email-templates.md`; Custom SMTP still needs to be enabled in Supabase Dashboard.
