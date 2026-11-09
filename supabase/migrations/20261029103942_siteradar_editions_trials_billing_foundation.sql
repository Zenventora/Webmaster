-- SiteRadar editions, trials, coupons and billing lifecycle foundation.
-- Prices remain NULL until approved; no payment provider is assumed.
create table if not exists public.plan_catalog (
  plan_key text primary key check (plan_key in ('free','standard','ultimate')),
  display_name text not null,
  description text not null default '',
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  monthly_price_minor bigint,
  annual_price_minor bigint,
  trial_days integer not null default 0 check (trial_days between 0 and 60),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (monthly_price_minor is null or monthly_price_minor >= 0),
  check (annual_price_minor is null or annual_price_minor >= 0)
);
insert into public.plan_catalog (plan_key,display_name,description,currency,monthly_price_minor,annual_price_minor,trial_days,limits,features,sort_order)
values
('free','Free','Permanent free edition for individuals evaluating website health.','INR',null,null,0,
 '{"sites":1,"audits_per_month":5,"pages_per_audit":15,"history_days":7,"team_seats":1,"uptime_monitors":0}'::jsonb,
 '{"technical_audit_mvp":true,"issue_explorer":true,"audit_history":true,"csv_audit_export":true,"pdf_reports":false,"scheduled_audits":false,"uptime_monitoring":false,"performance_diagnostics":false,"accessibility_diagnostics":false,"security_diagnostics":false,"crawl_graph":false,"api_access":false,"white_label":false}'::jsonb,1),
('standard','Standard','For growing teams that need repeatable audits and reporting.','INR',null,null,14,
 '{"sites":5,"audits_per_month":50,"pages_per_audit":15,"history_days":90,"team_seats":3,"uptime_monitors":0}'::jsonb,
 '{"technical_audit_mvp":true,"issue_explorer":true,"audit_history":true,"csv_audit_export":true,"pdf_reports":false,"scheduled_audits":false,"uptime_monitoring":false,"performance_diagnostics":false,"accessibility_diagnostics":false,"security_diagnostics":false,"crawl_graph":false,"api_access":false,"white_label":false}'::jsonb,2),
('ultimate','Ultimate','For agencies and advanced teams; includes higher target limits and future advanced diagnostics.','INR',null,null,14,
 '{"sites":25,"audits_per_month":250,"pages_per_audit":15,"history_days":365,"team_seats":10,"uptime_monitors":0}'::jsonb,
 '{"technical_audit_mvp":true,"issue_explorer":true,"audit_history":true,"csv_audit_export":true,"pdf_reports":false,"scheduled_audits":false,"uptime_monitoring":false,"performance_diagnostics":false,"accessibility_diagnostics":false,"security_diagnostics":false,"crawl_graph":false,"api_access":false,"white_label":false}'::jsonb,3)
on conflict (plan_key) do update set display_name=excluded.display_name,description=excluded.description,currency=excluded.currency,trial_days=excluded.trial_days,limits=excluded.limits,features=excluded.features,sort_order=excluded.sort_order,updated_at=now();

create table if not exists public.workspace_subscriptions (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 plan_key text not null references public.plan_catalog(plan_key),
 status text not null check (status in ('free','trialing','active','past_due','cancel_at_period_end','canceled','expired','incomplete','paused')),
 trial_started_at timestamptz, trial_ends_at timestamptz, current_period_start timestamptz, current_period_end timestamptz,
 cancel_at_period_end boolean not null default false, canceled_at timestamptz,
 billing_provider text, provider_customer_id text, provider_subscription_id text, coupon_id uuid,
 activation_source text not null default 'free_signup' check (activation_source in ('free_signup','trial','provider','manual','migration')),
 activated_by uuid references auth.users(id) on delete set null,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (trial_ends_at is null or trial_started_at is not null),
 check (trial_ends_at is null or trial_started_at is null or trial_ends_at > trial_started_at)
);
create table if not exists public.coupons (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code=upper(trim(code)) and length(code) between 3 and 64),
 description text not null default '', discount_type text not null check (discount_type in ('percent','fixed','trial_days')),
 discount_value numeric(12,2) not null check (discount_value>=0),
 currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
 applicable_plan_keys text[] not null default array['standard','ultimate']::text[],
 max_redemptions integer check (max_redemptions is null or max_redemptions>0),
 max_redemptions_per_workspace integer not null default 1 check (max_redemptions_per_workspace>0),
 trial_days_bonus integer not null default 0 check (trial_days_bonus between 0 and 60),
 valid_from timestamptz, valid_until timestamptz, is_active boolean not null default false,
 metadata jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (valid_until is null or valid_from is null or valid_until>valid_from),
 check (discount_type<>'percent' or discount_value<=100)
);
create table if not exists public.coupon_redemptions (
 id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 subscription_plan_key text not null references public.plan_catalog(plan_key),
 discount_applied_minor bigint not null default 0 check (discount_applied_minor>=0),
 extra_trial_days integer not null default 0 check (extra_trial_days between 0 and 60),
 redeemed_by uuid references auth.users(id) on delete set null, redeemed_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb, unique(coupon_id,workspace_id)
);
alter table public.workspace_subscriptions drop constraint if exists workspace_subscriptions_coupon_id_fkey;
alter table public.workspace_subscriptions add constraint workspace_subscriptions_coupon_id_fkey foreign key(coupon_id) references public.coupons(id) on delete set null;

create table if not exists public.billing_events (
 id uuid primary key default gen_random_uuid(), provider text not null, provider_event_id text not null,
 workspace_id uuid references public.workspaces(id) on delete set null, event_type text not null,
 processing_status text not null default 'received' check (processing_status in ('received','processing','processed','ignored','failed')),
 payload jsonb not null default '{}'::jsonb, error_message text, received_at timestamptz not null default now(), processed_at timestamptz,
 unique(provider,provider_event_id)
);
create table if not exists public.subscription_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null, event_type text not null,
 from_plan_key text references public.plan_catalog(plan_key), to_plan_key text references public.plan_catalog(plan_key),
 from_status text, to_status text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.subscription_notifications (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 notification_type text not null, channel text not null default 'email' check (channel in ('email','in_app')),
 scheduled_for timestamptz not null default now(), status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
 idempotency_key text not null unique, recipient_email text, payload jsonb not null default '{}'::jsonb,
 attempts integer not null default 0 check (attempts>=0), last_error text, sent_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists workspace_subscriptions_status_trial_end_idx on public.workspace_subscriptions(status,trial_ends_at);
create index if not exists workspace_subscriptions_provider_subscription_idx on public.workspace_subscriptions(billing_provider,provider_subscription_id);
create index if not exists coupon_redemptions_workspace_idx on public.coupon_redemptions(workspace_id,redeemed_at desc);
create index if not exists billing_events_workspace_received_idx on public.billing_events(workspace_id,received_at desc);
create index if not exists subscription_events_workspace_created_idx on public.subscription_events(workspace_id,created_at desc);
create index if not exists subscription_notifications_due_idx on public.subscription_notifications(status,scheduled_for);

alter table public.plan_catalog enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.subscription_events enable row level security;
alter table public.subscription_notifications enable row level security;
drop policy if exists "Public can read public plan catalog" on public.plan_catalog;
create policy "Public can read public plan catalog" on public.plan_catalog for select to anon,authenticated using(is_public=true);
drop policy if exists "Workspace members can read subscription" on public.workspace_subscriptions;
create policy "Workspace members can read subscription" on public.workspace_subscriptions for select to authenticated using(public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can read coupon redemptions" on public.coupon_redemptions;
create policy "Workspace members can read coupon redemptions" on public.coupon_redemptions for select to authenticated using(public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can read subscription events" on public.subscription_events;
create policy "Workspace members can read subscription events" on public.subscription_events for select to authenticated using(public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can read subscription notifications" on public.subscription_notifications;
create policy "Workspace members can read subscription notifications" on public.subscription_notifications for select to authenticated using(public.is_workspace_member(workspace_id));
revoke all on public.coupons from anon,authenticated;
revoke all on public.billing_events from anon,authenticated;
revoke insert,update,delete on public.plan_catalog from anon,authenticated;
revoke insert,update,delete on public.workspace_subscriptions from anon,authenticated;
revoke insert,update,delete on public.coupon_redemptions from anon,authenticated;
revoke insert,update,delete on public.subscription_events from anon,authenticated;
revoke insert,update,delete on public.subscription_notifications from anon,authenticated;
grant select on public.plan_catalog to anon,authenticated;
grant select on public.workspace_subscriptions,public.coupon_redemptions,public.subscription_events,public.subscription_notifications to authenticated;

create or replace function public.sync_siteradar_workspace_plan()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare effective_plan text := 'free';
begin
 if new.status in ('trialing','active','past_due') then
  if (new.status<>'trialing' or new.trial_ends_at is null or new.trial_ends_at>now())
    and (new.current_period_end is null or new.current_period_end>now()) then effective_plan:=new.plan_key; end if;
 elsif new.status='cancel_at_period_end' and (new.current_period_end is null or new.current_period_end>now()) then effective_plan:=new.plan_key;
 end if;
 update public.workspaces set plan_key=effective_plan,updated_at=now() where id=new.workspace_id;
 return new;
end; $function$;
drop trigger if exists sync_siteradar_workspace_plan on public.workspace_subscriptions;
create trigger sync_siteradar_workspace_plan after insert or update of plan_key,status,trial_ends_at,current_period_end on public.workspace_subscriptions for each row execute function public.sync_siteradar_workspace_plan();

create or replace function public.log_siteradar_subscription_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare event_name text;
begin
 if tg_op='INSERT' then
  event_name:=case when new.status='trialing' then 'trial_started' else 'subscription_created' end;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,to_plan_key,to_status,metadata)
  values(new.workspace_id,new.activated_by,event_name,new.plan_key,new.status,jsonb_build_object('activation_source',new.activation_source));
  return new;
 end if;
 if old.plan_key is distinct from new.plan_key or old.status is distinct from new.status or old.trial_ends_at is distinct from new.trial_ends_at or old.current_period_end is distinct from new.current_period_end then
  event_name:=case
   when old.status<>'trialing' and new.status='trialing' then 'trial_started'
   when old.status='trialing' and new.status='expired' then 'trial_expired'
   when new.status='active' and old.status is distinct from 'active' then 'subscription_activated'
   when new.status='past_due' and old.status is distinct from 'past_due' then 'payment_past_due'
   when new.status in ('canceled','cancel_at_period_end') and old.status is distinct from new.status then 'subscription_canceled'
   when old.plan_key is distinct from new.plan_key then 'plan_changed'
   else 'subscription_updated' end;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,from_plan_key,to_plan_key,from_status,to_status,metadata)
  values(new.workspace_id,new.activated_by,event_name,old.plan_key,new.plan_key,old.status,new.status,jsonb_build_object('activation_source',new.activation_source));
 end if;
 return new;
end; $function$;
drop trigger if exists log_siteradar_subscription_event on public.workspace_subscriptions;
create trigger log_siteradar_subscription_event after insert or update on public.workspace_subscriptions for each row execute function public.log_siteradar_subscription_event();

create or replace function public.bootstrap_siteradar_workspace_subscription()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 insert into public.workspace_subscriptions(workspace_id,plan_key,status,activation_source,activated_by)
 values(new.id,'free','free','free_signup',new.created_by) on conflict(workspace_id) do nothing;
 return new;
end; $function$;
drop trigger if exists bootstrap_siteradar_workspace_subscription on public.workspaces;
create trigger bootstrap_siteradar_workspace_subscription after insert on public.workspaces for each row execute function public.bootstrap_siteradar_workspace_subscription();
insert into public.workspace_subscriptions(workspace_id,plan_key,status,activation_source,activated_by)
select w.id,'free','free','migration',w.created_by from public.workspaces w on conflict(workspace_id) do nothing;

create or replace function public.start_siteradar_edition_trial(p_workspace_id uuid,p_plan_key text)
returns public.workspace_subscriptions language plpgsql security definer set search_path=''
as $function$
declare current_sub public.workspace_subscriptions%rowtype; selected_plan public.plan_catalog%rowtype; result_sub public.workspace_subscriptions%rowtype; trial_end timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not public.has_workspace_role(p_workspace_id,array['owner','admin']::public.workspace_role[]) then raise exception 'Workspace owner or admin permission required' using errcode='42501'; end if;
 if p_plan_key not in ('standard','ultimate') then raise exception 'Only Standard or Ultimate can start a trial' using errcode='22023'; end if;
 select * into selected_plan from public.plan_catalog where plan_key=p_plan_key and is_public=true;
 if not found or selected_plan.trial_days<1 then raise exception 'The selected edition is not available for trial' using errcode='22023'; end if;
 select * into current_sub from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
 if not found then raise exception 'Workspace subscription was not initialized' using errcode='P0002'; end if;
 if current_sub.trial_started_at is not null then raise exception 'This workspace has already used its edition trial' using errcode='23505'; end if;
 if current_sub.status in ('active','past_due','cancel_at_period_end') then raise exception 'An active subscription already exists' using errcode='55000'; end if;
 trial_end:=now()+make_interval(days=>selected_plan.trial_days);
 update public.workspace_subscriptions set plan_key=p_plan_key,status='trialing',trial_started_at=now(),trial_ends_at=trial_end,
 current_period_start=now(),current_period_end=trial_end,cancel_at_period_end=false,canceled_at=null,activation_source='trial',
 activated_by=auth.uid(),updated_at=now() where workspace_id=p_workspace_id returning * into result_sub;
 return result_sub;
end; $function$;

create or replace function public.expire_siteradar_trials()
returns integer language plpgsql security definer set search_path=''
as $function$
declare expired_count integer;
begin
 update public.workspace_subscriptions set status='expired',plan_key='free',current_period_end=now(),updated_at=now()
 where status='trialing' and trial_ends_at<=now();
 get diagnostics expired_count=row_count;
 insert into public.subscription_notifications(workspace_id,notification_type,channel,scheduled_for,status,idempotency_key,payload)
 select s.workspace_id,'trial_expired','email',now(),'queued',
 'trial-expired:'||s.workspace_id::text||':'||to_char(s.trial_ends_at at time zone 'UTC','YYYYMMDDHH24MISS'),
 jsonb_build_object('trial_ends_at',s.trial_ends_at)
 from public.workspace_subscriptions s
 where s.status='expired' and s.trial_ends_at is not null and s.trial_ends_at<=now()
 and not exists(select 1 from public.subscription_notifications n where n.workspace_id=s.workspace_id and n.notification_type='trial_expired'
 and n.idempotency_key='trial-expired:'||s.workspace_id::text||':'||to_char(s.trial_ends_at at time zone 'UTC','YYYYMMDDHH24MISS'))
 on conflict(idempotency_key) do nothing;
 return expired_count;
end; $function$;
revoke all on function public.sync_siteradar_workspace_plan() from public,anon,authenticated;
revoke all on function public.log_siteradar_subscription_event() from public,anon,authenticated;
revoke all on function public.bootstrap_siteradar_workspace_subscription() from public,anon,authenticated;
revoke all on function public.start_siteradar_edition_trial(uuid,text) from public,anon;
grant execute on function public.start_siteradar_edition_trial(uuid,text) to authenticated;
revoke all on function public.expire_siteradar_trials() from public,anon,authenticated;
grant execute on function public.expire_siteradar_trials() to service_role;
