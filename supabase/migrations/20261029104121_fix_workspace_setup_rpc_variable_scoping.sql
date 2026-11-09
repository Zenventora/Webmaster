-- Fix workspace setup RPC variable scoping; the SQL body is intentionally replaced in place.
create or replace function public.create_siteradar_workspace_setup(
  p_workspace_name text,p_workspace_slug text,p_site_name text,p_start_url text,
  p_sitemap_url text default null,p_edition text default 'free'
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid := auth.uid(); v_workspace_id uuid; v_site_id uuid; v_origin text;
  selected_plan public.plan_catalog%rowtype; trial_end timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_edition not in ('free','standard','ultimate') then raise exception 'Invalid edition selection' using errcode='22023'; end if;
  if p_workspace_name is null or length(trim(p_workspace_name))<1 or length(trim(p_workspace_name))>120 then raise exception 'Workspace name must be between 1 and 120 characters' using errcode='22023'; end if;
  if p_workspace_slug is null or p_workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,60}$' then raise exception 'Workspace slug must use 2-61 lowercase letters, numbers or hyphens' using errcode='22023'; end if;
  if p_site_name is null or length(trim(p_site_name))<1 or length(trim(p_site_name))>160 then raise exception 'Website name must be between 1 and 160 characters' using errcode='22023'; end if;
  if p_start_url is null or length(trim(p_start_url))>2048 or trim(p_start_url) !~* '^https?://[^[:space:]/?#]+([/?#].*)?$' or trim(p_start_url) ~* '^https?://[^/@]+:[^/@]*@' then raise exception 'Enter a valid public website URL starting with https:// or http://' using errcode='22023'; end if;
  if p_sitemap_url is not null and (length(trim(p_sitemap_url))>2048 or trim(p_sitemap_url) !~* '^https?://[^[:space:]/?#]+([/?#].*)?$') then raise exception 'Sitemap URL must be a valid http(s) URL' using errcode='22023'; end if;
  if exists(select 1 from public.workspace_members wm where wm.user_id=v_user_id and wm.joined_at is not null) then raise exception 'Workspace setup is already complete for this account' using errcode='23505'; end if;
  v_origin:=lower(regexp_replace(trim(p_start_url),'^((https?://[^/?#]+)).*$','\1','i'));
  v_origin:=regexp_replace(v_origin,'/$','');
  insert into public.workspaces(name,slug,created_by,plan_key) values(trim(p_workspace_name),trim(p_workspace_slug),v_user_id,'free') returning id into v_workspace_id;
  insert into public.sites(workspace_id,name,start_url,normalized_origin,sitemap_url,created_by) values(v_workspace_id,trim(p_site_name),trim(p_start_url),v_origin,nullif(trim(coalesce(p_sitemap_url,'')),''),v_user_id) returning id into v_site_id;
  if p_edition in ('standard','ultimate') then
    if exists(select 1 from public.workspace_subscriptions s join public.workspace_members wm on wm.workspace_id=s.workspace_id where wm.user_id=v_user_id and s.trial_started_at is not null) then raise exception 'This account has already used a Standard or Ultimate trial' using errcode='23505'; end if;
    select * into selected_plan from public.plan_catalog where plan_key=p_edition and is_public=true;
    if not found or selected_plan.trial_days<1 then raise exception 'The selected edition is not currently available for trial' using errcode='22023'; end if;
    trial_end:=now()+make_interval(days=>selected_plan.trial_days);
    update public.workspace_subscriptions as sub set plan_key=p_edition,status='trialing',trial_started_at=now(),trial_ends_at=trial_end,current_period_start=now(),current_period_end=trial_end,activation_source='trial',activated_by=v_user_id,updated_at=now() where sub.workspace_id=v_workspace_id;
  end if;
  return jsonb_build_object('workspace_id',v_workspace_id,'site_id',v_site_id,'edition',p_edition,'setup_complete',true);
end; $function$;
revoke all on function public.create_siteradar_workspace_setup(text,text,text,text,text,text) from public,anon;
grant execute on function public.create_siteradar_workspace_setup(text,text,text,text,text,text) to authenticated;
