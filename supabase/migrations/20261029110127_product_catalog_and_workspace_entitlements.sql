create table if not exists public.product_catalog (
 product_key text primary key, display_name text not null, description text not null default '', app_url text,
 is_available boolean not null default false, public_listing boolean not null default true, sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint product_catalog_key_check check (product_key ~ '^[a-z0-9][a-z0-9-]{1,40}$')
);
alter table public.product_catalog enable row level security;
drop policy if exists "Public can read listed products" on public.product_catalog;
create policy "Public can read listed products" on public.product_catalog for select to anon,authenticated using (public_listing=true);
grant select on public.product_catalog to anon,authenticated;
revoke insert,update,delete on public.product_catalog from anon,authenticated;
insert into public.product_catalog(product_key,display_name,description,app_url,is_available,public_listing,sort_order) values
 ('siteradar','SiteRadar','Website auditing, technical SEO and reporting.',null,true,true,1),
 ('e1','E1','Product integration and shared account launch.',null,false,true,2),
 ('inventory','Inventory','Inventory management product integration.',null,false,true,3)
on conflict(product_key) do update set display_name=excluded.display_name,description=excluded.description,app_url=excluded.app_url,is_available=excluded.is_available,public_listing=excluded.public_listing,sort_order=excluded.sort_order,updated_at=now();

create table if not exists public.workspace_product_entitlements (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 product_key text not null references public.product_catalog(product_key) on delete restrict,
 edition_key text not null references public.plan_catalog(plan_key) on delete restrict,
 status text not null default 'free' check (status in ('free','trialing','active','past_due','cancel_at_period_end','expired','canceled','suspended')),
 trial_started_at timestamptz,trial_ends_at timestamptz,current_period_end timestamptz,
 limits_snapshot jsonb not null default '{}'::jsonb,features_snapshot jsonb not null default '{}'::jsonb,
 entitlement_source text not null default 'catalog',updated_at timestamptz not null default now(),created_at timestamptz not null default now(),
 primary key(workspace_id,product_key)
);
alter table public.workspace_product_entitlements enable row level security;
drop policy if exists "Workspace members can read product entitlements" on public.workspace_product_entitlements;
create policy "Workspace members can read product entitlements" on public.workspace_product_entitlements for select to authenticated using (private.is_workspace_member(workspace_id));
grant select on public.workspace_product_entitlements to authenticated;
revoke insert,update,delete on public.workspace_product_entitlements from anon,authenticated;
create index if not exists workspace_product_entitlements_product_status_idx on public.workspace_product_entitlements(product_key,status);

create or replace function private.sync_siteradar_product_entitlement()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare selected_plan public.plan_catalog%rowtype;
begin
 select * into selected_plan from public.plan_catalog where plan_key=new.plan_key;
 insert into public.workspace_product_entitlements(workspace_id,product_key,edition_key,status,trial_started_at,trial_ends_at,current_period_end,limits_snapshot,features_snapshot,entitlement_source,updated_at)
 values(new.workspace_id,'siteradar',new.plan_key,new.status,new.trial_started_at,new.trial_ends_at,new.current_period_end,coalesce(selected_plan.limits,'{}'::jsonb),coalesce(selected_plan.features,'{}'::jsonb),coalesce(new.activation_source,'catalog'),now())
 on conflict(workspace_id,product_key) do update set edition_key=excluded.edition_key,status=excluded.status,trial_started_at=excluded.trial_started_at,trial_ends_at=excluded.trial_ends_at,current_period_end=excluded.current_period_end,limits_snapshot=excluded.limits_snapshot,features_snapshot=excluded.features_snapshot,entitlement_source=excluded.entitlement_source,updated_at=now();
 return new;
end; $function$;
revoke all on function private.sync_siteradar_product_entitlement() from public,anon,authenticated;
drop trigger if exists sync_siteradar_product_entitlement on public.workspace_subscriptions;
create trigger sync_siteradar_product_entitlement after insert or update of plan_key,status,trial_started_at,trial_ends_at,current_period_end,activation_source on public.workspace_subscriptions for each row execute function private.sync_siteradar_product_entitlement();

update public.product_catalog set app_url=null where app_url='';
insert into public.workspace_product_entitlements(workspace_id,product_key,edition_key,status,trial_started_at,trial_ends_at,current_period_end,limits_snapshot,features_snapshot,entitlement_source)
select s.workspace_id,'siteradar',s.plan_key,s.status,s.trial_started_at,s.trial_ends_at,s.current_period_end,coalesce(p.limits,'{}'::jsonb),coalesce(p.features,'{}'::jsonb),coalesce(s.activation_source,'catalog')
from public.workspace_subscriptions s join public.plan_catalog p on p.plan_key=s.plan_key
on conflict(workspace_id,product_key) do update set edition_key=excluded.edition_key,status=excluded.status,trial_started_at=excluded.trial_started_at,trial_ends_at=excluded.trial_ends_at,current_period_end=excluded.current_period_end,limits_snapshot=excluded.limits_snapshot,features_snapshot=excluded.features_snapshot,entitlement_source=excluded.entitlement_source,updated_at=now();
