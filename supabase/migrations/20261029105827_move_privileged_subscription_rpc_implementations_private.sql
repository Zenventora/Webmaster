CREATE OR REPLACE FUNCTION private.create_siteradar_workspace_setup_impl(p_workspace_name text, p_workspace_slug text, p_site_name text, p_start_url text, p_sitemap_url text DEFAULT NULL::text, p_edition text DEFAULT 'free'::text, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user_id uuid:=auth.uid(); v_workspace_id uuid; v_site_id uuid; v_origin text;
 selected_plan public.plan_catalog%rowtype; coupon_data jsonb; v_coupon_id uuid; coupon_bonus integer:=0; discount_type text; trial_end timestamptz;
begin
 if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_edition not in ('free','standard','ultimate') then raise exception 'Invalid edition selection' using errcode='22023'; end if;
 if p_workspace_name is null or length(trim(p_workspace_name))<1 or length(trim(p_workspace_name))>120 then raise exception 'Workspace name must be between 1 and 120 characters' using errcode='22023'; end if;
 if p_workspace_slug is null or p_workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,60}$' then raise exception 'Workspace slug must use 2-61 lowercase letters, numbers or hyphens' using errcode='22023'; end if;
 if p_site_name is null or length(trim(p_site_name))<1 or length(trim(p_site_name))>160 then raise exception 'Website name must be between 1 and 160 characters' using errcode='22023'; end if;
 if p_start_url is null or length(trim(p_start_url))>2048 or trim(p_start_url) !~* '^https?://[^[:space:]/?#]+([/?#].*)?$' or trim(p_start_url) ~* '^https?://[^/@]+:[^/@]*@' then raise exception 'Enter a valid public website URL starting with https:// or http://' using errcode='22023'; end if;
 if p_sitemap_url is not null and (length(trim(p_sitemap_url))>2048 or trim(p_sitemap_url) !~* '^https?://[^[:space:]/?#]+([/?#].*)?$') then raise exception 'Sitemap URL must be a valid http(s) URL' using errcode='22023'; end if;
 if exists(select 1 from public.workspace_members wm where wm.user_id=v_user_id and wm.joined_at is not null) then raise exception 'Workspace setup is already complete for this account' using errcode='23505'; end if;
 if p_coupon_code is not null and length(trim(p_coupon_code))>0 and p_edition='free' then raise exception 'Coupon codes apply to Standard or Ultimate editions, not Free.' using errcode='22023'; end if;
 v_origin:=lower(regexp_replace(trim(p_start_url),'^((https?://[^/?#]+)).*$','\1','i'));
 v_origin:=regexp_replace(v_origin,'/$','');
 insert into public.workspaces(name,slug,created_by,plan_key) values(trim(p_workspace_name),trim(p_workspace_slug),v_user_id,'free') returning id into v_workspace_id;
 insert into public.sites(workspace_id,name,start_url,normalized_origin,sitemap_url,created_by) values(v_workspace_id,trim(p_site_name),trim(p_start_url),v_origin,nullif(trim(coalesce(p_sitemap_url,'')),''),v_user_id) returning id into v_site_id;

 if p_edition in ('standard','ultimate') then
  if exists(select 1 from public.workspace_subscriptions s join public.workspace_members wm on wm.workspace_id=s.workspace_id where wm.user_id=v_user_id and s.trial_started_at is not null) then raise exception 'This account has already used a Standard or Ultimate trial' using errcode='23505'; end if;
  select * into selected_plan from public.plan_catalog where plan_key=p_edition and is_public=true;
  if not found or selected_plan.trial_days<1 then raise exception 'The selected edition is not currently available for trial' using errcode='22023'; end if;
  if p_coupon_code is not null and length(trim(p_coupon_code))>0 then
   coupon_data:=private.check_siteradar_coupon(v_workspace_id,p_coupon_code,p_edition);
   v_coupon_id:=(coupon_data->>'id')::uuid; discount_type:=coupon_data->>'discount_type';
   if discount_type in ('percent','fixed') then raise exception 'This coupon is valid for paid checkout, but payment checkout is not enabled yet. It has not been applied.' using errcode='0A000'; end if;
   if discount_type='trial_days' then coupon_bonus:=coalesce((coupon_data->>'trial_days_bonus')::integer,0)+ceil((coupon_data->>'discount_value')::numeric)::integer; end if;
  end if;
  if selected_plan.trial_days+coupon_bonus>60 then raise exception 'The trial plus coupon extension exceeds the 60-day limit' using errcode='22023'; end if;
  trial_end:=now()+make_interval(days=>selected_plan.trial_days+coupon_bonus);
  update public.workspace_subscriptions as sub set plan_key=p_edition,status='trialing',trial_started_at=now(),trial_ends_at=trial_end,current_period_start=now(),current_period_end=trial_end,activation_source='trial',activated_by=v_user_id,coupon_id=v_coupon_id,updated_at=now() where sub.workspace_id=v_workspace_id;
  if v_coupon_id is not null then
   insert into public.coupon_redemptions(coupon_id,workspace_id,subscription_plan_key,discount_applied_minor,extra_trial_days,redeemed_by,metadata)
   values(v_coupon_id,v_workspace_id,p_edition,0,coupon_bonus,v_user_id,jsonb_build_object('source','setup_trial','discount_type',discount_type));
  end if;
 end if;
 return jsonb_build_object('workspace_id',v_workspace_id,'site_id',v_site_id,'edition',p_edition,'setup_complete',true,'coupon_applied',v_coupon_id is not null,'extra_trial_days',coupon_bonus);
end; $function$;

CREATE OR REPLACE FUNCTION private.start_siteradar_edition_trial_impl(p_workspace_id uuid, p_plan_key text, p_coupon_code text DEFAULT NULL::text)
 RETURNS workspace_subscriptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_sub public.workspace_subscriptions%rowtype; selected_plan public.plan_catalog%rowtype; result_sub public.workspace_subscriptions%rowtype;
 coupon_data jsonb; v_coupon_id uuid; coupon_bonus integer:=0; discount_type text; trial_end timestamptz;
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
 if p_coupon_code is not null and length(trim(p_coupon_code))>0 then
  coupon_data:=private.check_siteradar_coupon(p_workspace_id,p_coupon_code,p_plan_key);
  v_coupon_id:=(coupon_data->>'id')::uuid; discount_type:=coupon_data->>'discount_type';
  if discount_type in ('percent','fixed') then raise exception 'This coupon is valid for paid checkout, but payment checkout is not enabled yet. It has not been applied.' using errcode='0A000'; end if;
  if discount_type='trial_days' then coupon_bonus:=coalesce((coupon_data->>'trial_days_bonus')::integer,0)+ceil((coupon_data->>'discount_value')::numeric)::integer; end if;
 end if;
 if selected_plan.trial_days+coupon_bonus>60 then raise exception 'The trial plus coupon extension exceeds the 60-day limit' using errcode='22023'; end if;
 trial_end:=now()+make_interval(days=>selected_plan.trial_days+coupon_bonus);
 update public.workspace_subscriptions as sub set plan_key=p_plan_key,status='trialing',trial_started_at=now(),trial_ends_at=trial_end,current_period_start=now(),current_period_end=trial_end,cancel_at_period_end=false,canceled_at=null,activation_source='trial',activated_by=auth.uid(),coupon_id=v_coupon_id,updated_at=now()
 where sub.workspace_id=p_workspace_id returning sub.* into result_sub;
 if v_coupon_id is not null then
  insert into public.coupon_redemptions(coupon_id,workspace_id,subscription_plan_key,discount_applied_minor,extra_trial_days,redeemed_by,metadata)
  values(v_coupon_id,p_workspace_id,p_plan_key,0,coupon_bonus,auth.uid(),jsonb_build_object('source','trial','discount_type',discount_type));
 end if;
 return result_sub;
end; $function$;

CREATE OR REPLACE FUNCTION private.validate_siteradar_coupon_impl(p_workspace_id uuid, p_code text, p_plan_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare coupon_data jsonb; discount_type text; bonus integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not public.has_workspace_role(p_workspace_id,array['owner','admin']::public.workspace_role[]) then raise exception 'Workspace owner or admin permission required' using errcode='42501'; end if;
 if p_plan_key not in ('standard','ultimate') then raise exception 'Choose Standard or Ultimate to validate this coupon' using errcode='22023'; end if;
 coupon_data:=private.check_siteradar_coupon(p_workspace_id,p_code,p_plan_key);
 discount_type:=coupon_data->>'discount_type';
 if discount_type='trial_days' then bonus:=coalesce((coupon_data->>'trial_days_bonus')::integer,0)+ceil((coupon_data->>'discount_value')::numeric)::integer; end if;
 return jsonb_build_object('valid',true,'code',coupon_data->>'code','discount_type',discount_type,'discount_value',coupon_data->'discount_value','trial_days_bonus',bonus,'applies_to_trial',discount_type='trial_days' and bonus>0,'checkout_enabled',false,
 'message',case when discount_type='trial_days' and bonus>0 then 'Valid. The trial extension will be applied when you start the selected trial.' else 'Valid for paid checkout, but checkout is not enabled yet. No discount has been applied.' end);
end; $function$;

CREATE OR REPLACE FUNCTION public.create_siteradar_workspace_setup(p_workspace_name text, p_workspace_slug text, p_site_name text, p_start_url text, p_sitemap_url text DEFAULT NULL::text, p_edition text DEFAULT 'free'::text, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.create_siteradar_workspace_setup_impl($1,$2,$3,$4,$5,$6,$7); $function$;

CREATE OR REPLACE FUNCTION public.start_siteradar_edition_trial(p_workspace_id uuid, p_plan_key text, p_coupon_code text DEFAULT NULL::text)
 RETURNS workspace_subscriptions
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select * from private.start_siteradar_edition_trial_impl($1,$2,$3); $function$;

CREATE OR REPLACE FUNCTION public.validate_siteradar_coupon(p_workspace_id uuid, p_code text, p_plan_key text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.validate_siteradar_coupon_impl($1,$2,$3); $function$;


grant usage on schema private to authenticated;
revoke all on function private.create_siteradar_workspace_setup_impl(text,text,text,text,text,text,text) from public,anon;
revoke all on function private.start_siteradar_edition_trial_impl(uuid,text,text) from public,anon;
revoke all on function private.validate_siteradar_coupon_impl(uuid,text,text) from public,anon;
grant execute on function private.create_siteradar_workspace_setup_impl(text,text,text,text,text,text,text) to authenticated;
grant execute on function private.start_siteradar_edition_trial_impl(uuid,text,text) to authenticated;
grant execute on function private.validate_siteradar_coupon_impl(uuid,text,text) to authenticated;
revoke all on function public.create_siteradar_workspace_setup(text,text,text,text,text,text,text) from public,anon;
revoke all on function public.start_siteradar_edition_trial(uuid,text,text) from public,anon;
revoke all on function public.validate_siteradar_coupon(uuid,text,text) from public,anon;
grant execute on function public.create_siteradar_workspace_setup(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.start_siteradar_edition_trial(uuid,text,text) to authenticated;
grant execute on function public.validate_siteradar_coupon(uuid,text,text) to authenticated;
