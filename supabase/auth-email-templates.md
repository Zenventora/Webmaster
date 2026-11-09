# SiteRadar Supabase Auth email templates

These templates belong in **Supabase Dashboard → Authentication → Email Templates**. They are not Resend product-notification templates. Supabase must generate and validate the one-time confirmation/recovery links.

Keep the content transactional and short. Use the Supabase template variables exactly as shown; do not hard-code tokens or manually construct auth URLs.

## Confirm signup

**Subject:** Confirm your SiteRadar account

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Confirm your SiteRadar account</title>
</head>
<body style="margin:0;padding:0;background-color:#0e1118;font-family:Arial,Helvetica,sans-serif;color:#e8ebf2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e1118" style="padding-top:28px;padding-bottom:28px;background-color:#0e1118;">
    <tr><td align="center" style="padding-left:14px;padding-right:14px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#151a24" style="width:100%;max-width:560px;border:1px solid #30394b;background-color:#151a24;border-radius:12px;">
        <tr><td style="padding:24px 26px;border-bottom:1px solid #2b3342;">
          <p style="margin:0;font-size:19px;line-height:26px;font-weight:bold;color:#f4f6fb;">Site<span style="color:#9aaaff;">Radar</span></p>
        </td></tr>
        <tr><td style="padding:28px 26px;">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:32px;color:#f1f4fb;">Confirm your email</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#a1adc1;">Confirm this email address to activate your SiteRadar account. If you did not create this account, you can ignore this message.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#5877f0" style="border-radius:7px;background-color:#5877f0;">
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 18px;color:#ffffff;font-size:13px;line-height:18px;font-weight:bold;text-decoration:none;">Confirm email address</a>
          </td></tr></table>
          <p style="margin:22px 0 0;font-size:11px;line-height:18px;color:#77859b;">If the button does not work, open this one-time confirmation link:<br><a href="{{ .ConfirmationURL }}" style="color:#9eafff;overflow-wrap:anywhere;">Confirm your account</a></p>
        </td></tr>
        <tr><td style="padding:16px 26px;border-top:1px solid #2b3342;"><p style="margin:0;font-size:10px;line-height:16px;color:#77859b;">SiteRadar account security message.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

## Reset password

**Subject:** Reset your SiteRadar password

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset your SiteRadar password</title>
</head>
<body style="margin:0;padding:0;background-color:#0e1118;font-family:Arial,Helvetica,sans-serif;color:#e8ebf2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e1118" style="padding-top:28px;padding-bottom:28px;background-color:#0e1118;">
    <tr><td align="center" style="padding-left:14px;padding-right:14px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#151a24" style="width:100%;max-width:560px;border:1px solid #30394b;background-color:#151a24;border-radius:12px;">
        <tr><td style="padding:24px 26px;border-bottom:1px solid #2b3342;">
          <p style="margin:0;font-size:19px;line-height:26px;font-weight:bold;color:#f4f6fb;">Site<span style="color:#9aaaff;">Radar</span></p>
        </td></tr>
        <tr><td style="padding:28px 26px;">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:32px;color:#f1f4fb;">Reset your password</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#a1adc1;">We received a request to reset the password for your SiteRadar account. Use the secure one-time link below. If you did not request this, ignore this email.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#5877f0" style="border-radius:7px;background-color:#5877f0;">
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 18px;color:#ffffff;font-size:13px;line-height:18px;font-weight:bold;text-decoration:none;">Choose a new password</a>
          </td></tr></table>
          <p style="margin:22px 0 0;font-size:11px;line-height:18px;color:#77859b;">If the button does not work, open this one-time reset link:<br><a href="{{ .ConfirmationURL }}" style="color:#9eafff;overflow-wrap:anywhere;">Reset password</a></p>
        </td></tr>
        <tr><td style="padding:16px 26px;border-top:1px solid #2b3342;"><p style="margin:0;font-size:10px;line-height:16px;color:#77859b;">SiteRadar account security message. Never share this link with anyone.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

## Required behavior
- The confirmation email must use the allowed `/auth/callback` redirect.
- The password recovery email must use the allowed `/reset-password?type=recovery` redirect.
- Set redirect targets in the application and Supabase allow-list; do not trust an arbitrary URL from the email request.
- Test with a real inbox after Custom SMTP is enabled. A template preview is not a delivery test.
- Keep passwords and one-time tokens out of analytics and logs.
