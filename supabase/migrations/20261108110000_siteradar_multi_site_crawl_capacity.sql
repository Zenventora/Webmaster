-- SiteRadar demo readiness: support a small portfolio of sites and larger bounded sitemap crawls.
-- The worker still enforces a 50-page hard cap and a 90-second execution budget.
update public.plan_catalog
set limits = jsonb_set(
  jsonb_set(
    coalesce(limits, '{}'::jsonb),
    '{sites}',
    to_jsonb(case plan_key when 'standard' then 10 when 'ultimate' then 25 else 1 end),
    true
  ),
  '{pages_per_audit}',
  to_jsonb(case plan_key when 'free' then 15 when 'standard' then 50 when 'ultimate' then 50 else 15 end),
  true
),
updated_at = now()
where plan_key in ('free','standard','ultimate');
