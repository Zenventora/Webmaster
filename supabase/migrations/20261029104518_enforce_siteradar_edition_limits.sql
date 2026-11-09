-- Enforce the current plan catalog on every site and audit insert, including service-role crawler inserts.
create or replace function private.enforce_siteradar_site_limit()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare sub record; effective_plan text:='free'; max_sites integer:=1; existing_sites integer:=0;
begin
 select plan_key,status,trial_ends_at,current_period_end into sub from public.workspace_subscriptions where workspace_id=new.workspace_id;
 if found then
  if sub.status='trialing' and sub.trial_ends_at is not null and sub.trial_ends_at<=now() then
   update public.workspace_subscriptions set status='expired',plan_key='free',current_period_end=now(),updated_at=now() where workspace_id=new.workspace_id;
  elsif sub.status in ('active','past_due') and sub.current_period_end is not null and sub.current_period_end<=now() then
   update public.workspace_subscriptions set status='expired',plan_key='free',updated_at=now() where workspace_id=new.workspace_id;
  elsif sub.status='cancel_at_period_end' and sub.current_period_end is not null and sub.current_period_end<=now() then
   update public.workspace_subscriptions set status='canceled',plan_key='free',updated_at=now() where workspace_id=new.workspace_id;
  elsif sub.status in ('trialing','active','past_due') and (sub.status<>'trialing' or sub.trial_ends_at is null or sub.trial_ends_at>now()) and (sub.current_period_end is null or sub.current_period_end>now()) then effective_plan:=sub.plan_key;
  elsif sub.status='cancel_at_period_end' and (sub.current_period_end is null or sub.current_period_end>now()) then effective_plan:=sub.plan_key;
  end if;
 end if;
 select coalesce((limits->>'sites')::integer,1) into max_sites from public.plan_catalog where plan_key=effective_plan;
 select count(*)::integer into existing_sites from public.sites where workspace_id=new.workspace_id;
 if existing_sites>=max_sites then raise exception 'Your % edition allows % website(s). Upgrade your edition to add another website.',initcap(effective_plan),max_sites using errcode='P0001'; end if;
 return new;
end; $function$;
drop trigger if exists enforce_siteradar_site_limit on public.sites;
create trigger enforce_siteradar_site_limit before insert on public.sites for each row execute function private.enforce_siteradar_site_limit();

create or replace function private.enforce_siteradar_audit_limit()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare sub record; effective_plan text:='free'; max_audits integer:=5; used_audits integer:=0;
begin
 select plan_key,status,trial_ends_at,current_period_end into sub from public.workspace_subscriptions where workspace_id=new.workspace_id;
 if found then
  if sub.status='trialing' and sub.trial_ends_at is not null and sub.trial_ends_at<=now() then
   update public.workspace_subscriptions set status='expired',plan_key='free',current_period_end=now(),updated_at=now() where workspace_id=new.workspace_id;
  elsif sub.status in ('active','past_due') and sub.current_period_end is not null and sub.current_period_end<=now() then
   update public.workspace_subscriptions set status='expired',plan_key='free',updated_at=now() where workspace_id=new.workspace_id;
  elsif sub.status='cancel_at_period_end' and sub.current_period_end is not null and sub.current_period_end<=now() then
   update public.workspace_subscriptions set status='canceled',plan_key='free',updated_at=now() where workspace_id=new.workspace_id;
  elsif sub.status in ('trialing','active','past_due') and (sub.status<>'trialing' or sub.trial_ends_at is null or sub.trial_ends_at>now()) and (sub.current_period_end is null or sub.current_period_end>now()) then effective_plan:=sub.plan_key;
  elsif sub.status='cancel_at_period_end' and (sub.current_period_end is null or sub.current_period_end>now()) then effective_plan:=sub.plan_key;
  end if;
 end if;
 select coalesce((limits->>'audits_per_month')::integer,5) into max_audits from public.plan_catalog where plan_key=effective_plan;
 select count(*)::integer into used_audits from public.audit_runs where workspace_id=new.workspace_id and created_at>=date_trunc('month',now());
 if used_audits>=max_audits then raise exception 'Your % edition has reached its % audit run limit for this month. Upgrade your edition or wait for the next billing month.',initcap(effective_plan),max_audits using errcode='P0001'; end if;
 return new;
end; $function$;
drop trigger if exists enforce_siteradar_audit_limit on public.audit_runs;
create trigger enforce_siteradar_audit_limit before insert on public.audit_runs for each row execute function private.enforce_siteradar_audit_limit();
revoke all on function private.enforce_siteradar_site_limit() from public,anon,authenticated;
revoke all on function private.enforce_siteradar_audit_limit() from public,anon,authenticated;
