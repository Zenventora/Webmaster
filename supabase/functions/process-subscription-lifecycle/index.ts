import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("SITERADAR_FROM_EMAIL") ?? "";
const APP_URL = (Deno.env.get("SITERADAR_APP_URL") ?? "").replace(/\/$/, "");
const LIFECYCLE_SECRET = Deno.env.get("SITERADAR_LIFECYCLE_SECRET") ?? "";

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c] ?? c));
}
function dateLabel(value: string | null | undefined): string {
  if (!value) return "the scheduled date";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) + " IST";
}
function emailContent(type: string, payload: Record<string, unknown>, workspaceName: string) {
  const plan = String(payload.plan_key ?? payload.previous_plan ?? "your selected edition");
  const end = dateLabel(String(payload.trial_ends_at ?? ""));
  const dashboard = APP_URL ? APP_URL + "/app/billing" : "";
  const cta = dashboard ? '<p><a href="' + escapeHtml(dashboard) + '" style="display:inline-block;padding:12px 18px;background:#526fe8;color:#fff;text-decoration:none;border-radius:8px">Manage your edition</a></p>' : "";
  let subject = "SiteRadar account update";
  let heading = "Your SiteRadar account";
  let body = "There is an update to your workspace subscription.";
  switch (type) {
    case "trial_started":
      subject = "Your " + plan + " trial has started";
      heading = "Your trial is active";
      body = "Your " + plan + " trial for " + workspaceName + " is active until " + end + ". No payment has been collected.";
      break;
    case "trial_ending_3_days":
      subject = "Your SiteRadar trial ends soon";
      heading = "Three-day trial reminder";
      body = "Your " + plan + " trial for " + workspaceName + " is approaching its end date (" + end + "). Review your edition before access returns to Free.";
      break;
    case "trial_ending_1_day":
      subject = "Your SiteRadar trial ends within a day";
      heading = "Your trial is nearly over";
      body = "Your " + plan + " trial for " + workspaceName + " ends on " + end + ". Choose a paid plan once checkout is available, or continue on Free.";
      break;
    case "trial_expired":
      subject = "Your SiteRadar trial has ended";
      heading = "Your workspace is now on Free";
      body = "The trial for " + workspaceName + " has ended. Your workspace has returned to the Free edition. Your saved data remains subject to the product's retention rules.";
      break;
    case "subscription_activated":
      subject = "Your SiteRadar subscription is active";
      heading = "Subscription activated";
      body = "The " + plan + " edition for " + workspaceName + " is marked active.";
      break;
    case "payment_past_due":
      subject = "Action needed for your SiteRadar subscription";
      heading = "Payment needs attention";
      body = "The subscription for " + workspaceName + " is marked past due. Review your billing status to avoid interruption.";
      break;
    case "subscription_canceled":
      subject = "Your SiteRadar subscription was canceled";
      heading = "Subscription update";
      body = "The subscription for " + workspaceName + " is marked " + String(payload.status ?? "canceled") + ". Review your edition details for the effective date.";
      break;
  }
  const html = '<div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;color:#1e293b"><p style="color:#526fe8;font-weight:800;letter-spacing:.08em">SITERADAR</p><h1 style="font-size:24px">' + escapeHtml(heading) + '</h1><p style="line-height:1.7">' + escapeHtml(body) + '</p>' + cta + '<p style="font-size:12px;color:#64748b">If you did not expect this message, contact ' + escapeHtml(FROM_EMAIL) + '.</p></div>';
  return { subject, html };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "POST required" }, 405);
  if (!LIFECYCLE_SECRET) return response({ error: "Lifecycle secret is not configured." }, 503);
  const supplied = req.headers.get("x-lifecycle-secret") ?? "";
  if (!safeEqual(supplied, LIFECYCLE_SECRET)) return response({ error: "Unauthorized." }, 401);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return response({ error: "Supabase server configuration is incomplete." }, 503);

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const counters = { expired: 0, remindersQueued: 0, sent: 0, failed: 0, skipped: 0 };
  const { data: expiredCount, error: expiryError } = await service.rpc("expire_siteradar_trials");
  if (expiryError) return response({ error: "Could not process expired trials.", detail: expiryError.message }, 500);
  counters.expired = Number(expiredCount ?? 0);

  const reminderWindow = new Date(now.getTime() + 96 * 60 * 60 * 1000);
  const { data: trials, error: trialError } = await service.from("workspace_subscriptions")
    .select("workspace_id,plan_key,trial_ends_at").eq("status", "trialing").not("trial_ends_at", "is", null)
    .gt("trial_ends_at", now.toISOString()).lte("trial_ends_at", reminderWindow.toISOString()).limit(500);
  if (trialError) return response({ error: "Could not inspect upcoming trial expiries.", detail: trialError.message }, 500);

  for (const trial of trials ?? []) {
    const endMs = new Date(trial.trial_ends_at).getTime();
    const hours = (endMs - now.getTime()) / 3600000;
    const type = hours <= 36 ? "trial_ending_1_day" : hours > 48 ? "trial_ending_3_days" : null;
    if (!type) continue;
    const key = type + ":" + trial.workspace_id + ":" + Math.floor(endMs / 1000);
    const { error } = await service.from("subscription_notifications").insert({
      workspace_id: trial.workspace_id, notification_type: type, channel: "email", scheduled_for: now.toISOString(),
      status: "queued", idempotency_key: key, payload: { plan_key: trial.plan_key, trial_ends_at: trial.trial_ends_at }
    });
    if (!error) counters.remindersQueued++;
    else if (error.code !== "23505") counters.failed++;
  }

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return response({ ok: true, ...counters, queued: true, emailConfigured: false, message: "Lifecycle events were queued. Configure RESEND_API_KEY and SITERADAR_FROM_EMAIL to send emails." });
  }

  const { data: queued, error: queueError } = await service.from("subscription_notifications")
    .select("id,workspace_id,notification_type,idempotency_key,payload,attempts")
    .eq("status", "queued").lte("scheduled_for", now.toISOString()).order("scheduled_for", { ascending: true }).limit(100);
  if (queueError) return response({ error: "Could not load queued notifications.", detail: queueError.message }, 500);

  for (const notification of queued ?? []) {
    const { data: workspace, error: workspaceError } = await service.from("workspaces").select("name,created_by").eq("id", notification.workspace_id).maybeSingle();
    if (workspaceError || !workspace?.created_by) {
      await service.from("subscription_notifications").update({ status: "skipped", last_error: "Workspace owner could not be resolved." }).eq("id", notification.id);
      counters.skipped++;
      continue;
    }
    const { data: userData, error: userError } = await service.auth.admin.getUserById(workspace.created_by);
    const email = userData?.user?.email;
    if (userError || !email) {
      await service.from("subscription_notifications").update({ status: "skipped", last_error: "Workspace owner email is unavailable." }).eq("id", notification.id);
      counters.skipped++;
      continue;
    }
    await service.from("subscription_notifications").update({ status: "sending", recipient_email: email, attempts: Number(notification.attempts ?? 0) + 1, last_error: null }).eq("id", notification.id);
    const content = emailContent(notification.notification_type, (notification.payload ?? {}) as Record<string, unknown>, workspace.name || "your workspace");
    try {
      const result = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json", "Idempotency-Key": notification.idempotency_key },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: content.subject, html: content.html })
      });
      const body = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(String(body.message ?? "Resend rejected the email."));
      await service.from("subscription_notifications").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", notification.id);
      counters.sent++;
    } catch (error) {
      const attempts = Number(notification.attempts ?? 0) + 1;
      await service.from("subscription_notifications").update({
        status: attempts >= 5 ? "failed" : "queued",
        scheduled_for: new Date(Date.now() + Math.min(attempts, 4) * 15 * 60 * 1000).toISOString(),
        last_error: error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed."
      }).eq("id", notification.id);
      counters.failed++;
    }
  }
  return response({ ok: true, ...counters, emailConfigured: true });
});
