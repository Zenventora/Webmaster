create or replace function public.start_siteradar_edition_trial(p_workspace_id uuid,p_plan_key text,p_coupon_code text default null)
returns public.workspace_subscriptions language plpgsql security definer set search_path=''
as $function$
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
revoke all on function public.start_siteradar_edition_trial(uuid,text,text) from public,anon;
grant execute on function public.start_siteradar_edition_trial(uuid,text,text) to authenticated;

create or replace function public.validate_siteradar_coupon(p_workspace_id uuid,p_code text,p_plan_key text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
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
revoke all on function public.validate_siteradar_coupon(uuid,text,text) from public,anon;
grant execute on function public.validate_siteradar_coupon(uuid,text,text) to authenticated;
