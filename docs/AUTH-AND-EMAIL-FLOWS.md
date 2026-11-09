# SiteRadar authentication and email flows

## Visual reference

Requested live reference: https://emenu.zenventora.in/ (the eMenu repository is https://github.com/samsahabdeenm/emenu).

**Reference inspection result:** the eMenu repository's `main` branch currently contains only `README.md` and no source files for signup, login, forgot-password, session handling, or theme. The live URL was supplied, but the available inspection tools did not return its page content during this review. An exact visual/flow match is therefore not verified yet; do not claim it is a pixel-perfect clone. Do not claim that the current SiteRadar auth screens are copied from eMenu.

Interim theme already implemented in SiteRadar: dark navy shell (#0e1118 / #121720 / #151a24), blue accents (#5877f0 / #7895ff), Manrope headings, DM Sans UI, restrained borders, compact form fields, responsive layouts and clear loading/error states. This is an interim existing theme, not a verified eMenu match. Once eMenu source is accessible, compare every auth state and replace the interim styling to match the actual reference.

## Routes

- /login
- /signup
- /forgot-password
- /reset-password
- /auth/callback
- /auth/confirm (if using a token-hash confirmation route)
- /auth/error
- /app (protected application shell)
- /setup (protected post-signup organization/site setup)
- /pricing (public Free/Standard/Ultimate selection)
- /products (public product directory; E1/Inventory are integration-pending)
- /app/products (workspace product entitlements)
- /app/billing (edition, trial, coupon and usage management)
- /app/notifications (subscription lifecycle notification center)
- /settings/profile
- /settings/security

## Signup

1. Validate normalized email, password policy, confirmation match, and legal acceptance if required.
2. Apply server-side rate limits and bot protection where needed.
3. Submit to Supabase Auth. Never write a custom password table.
4. If email confirmation is required, show a clear “check your inbox” state; don't claim the user is authenticated when no session exists.
5. Handle duplicate-account responses without unnecessarily revealing account existence.
6. Verification links route through configured trusted redirect URLs.
7. Expired or reused links show a useful page and rate-limited resend flow.
8. On successful verification, continue to a safe internal route.

## Login

1. Email and password with accessible show/hide toggle.
2. Enter submits; labels and keyboard focus order are correct.
3. Disable controls during network activity; prevent duplicate requests.
4. Display useful but non-sensitive auth errors; don't reveal whether an email exists.
5. Handle unconfirmed email state and resend confirmation if configured.
6. Preserve only an allow-listed internal next path. Reject external and protocol-relative redirects.
7. Recover session state on page load; protected screens must not flash private data while auth resolves.
8. On session expiry, return to login with a safe return path.
9. Sign out clears the app session and returns to a public route.

## Forgot password

1. Request an email and show a generic “If an account matches, we sent a reset email” result to reduce account enumeration.
2. Rate limit by account, IP and session where appropriate.
3. Use Supabase Auth password recovery with a redirect to the trusted reset route.
4. Reset links are single-use and time-limited; never put tokens into analytics or application logs.
5. Handle delivery failure and expired/reused links gracefully.

## Reset password

1. Verify recovery session/token before showing the update form.
2. New password, confirmation and password-policy feedback.
3. Submit via Supabase Auth password update, never custom SQL password writes.
4. On success, confirm the change and choose a clear sign-in/session policy.
5. On invalid or expired token, show “request another reset link”.
6. Never log reset URLs, tokens or passwords.

## Email change and account security

- Require confirmation according to configured Supabase behavior; notify users of sensitive account changes when supported.
- Consider MFA after baseline flows are stable.
- Avoid relying on user-editable user_metadata for permissions or tenant access.
- Use authorization checks and RLS on every workspace-owned row, not simply “is authenticated”.

## Supabase Auth and Resend responsibilities

Use Supabase Auth as identity and token authority for email confirmation and password recovery. Configure Supabase Auth email templates and trusted URL settings. Do not invent a separate OTP/token system.

Resend may deliver product notifications independent of the authentication token lifecycle:
- Audit completed
- Critical issues detected or resolved
- Scheduled report ready
- Uptime down/recovered
- Workspace invitation, if that flow is implemented
- Security notice only when its source and permissions are trustworthy

Never send raw passwords, reusable tokens, or sensitive audit details to an unverified recipient. A custom Auth email hook using Resend would need explicit implementation and tests against the current Supabase template variables and signature-verification rules.

## Domain and sender

Discovered Resend state:
- Verified sending domain: zenventora.in
- Sending enabled
- Receiving disabled
- No existing templates returned

Until a dedicated sender is verified, sender options must use a verified address on zenventora.in. Prefer moving product mail onto a dedicated subdomain such as notifications.zenventora.in after deliberate DNS setup. Do not silently alter production DNS or enable receiving.

Before production mail:
- Verify SPF/DKIM and consider DMARC.
- Set sender name and reply-to.
- Include accessible responsive HTML and plain-text fallback.
- Use idempotency for retries and log delivery status without sensitive payloads.
- Handle bounces and complaints appropriately.
- Keep transactional account messages separate from marketing subscriptions.

## Supabase setup checklist

1. Create or select a dedicated SiteRadar Supabase project; don't reuse a production application's database by default.
2. Set the Site URL and exact localhost/production redirect allow-list entries. Avoid broad production wildcards.
3. Enable email/password and decide whether email confirmation is required.
4. Configure SMTP/custom SMTP only after sender deliverability and limits are tested.
5. Enable Google OAuth only after an OAuth client is created and configured in Supabase.
6. Keep the publishable key in browser code only. Service-role and secret keys stay server-side.
7. Implement workspace membership RLS policies with explicit role predicates and cross-tenant tests.
8. Add migrations and run security/performance advisors after schema changes.
9. Test signup, confirmation, login, logout, forgot password, valid/expired/reused reset links, redirect safety, cross-user isolation and email delivery.

## Current blocker

The SiteRadar GitHub repository was empty. The product blueprint is committed in README/docs, but the actual frontend scaffold, dedicated Supabase setup and working email configuration still need implementation. Do not modify the existing Supabase production project for SiteRadar without choosing a dedicated project or explicitly approving a safe isolation plan.
