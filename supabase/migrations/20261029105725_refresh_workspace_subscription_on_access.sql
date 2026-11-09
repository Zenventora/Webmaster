create or replace function private.refresh_siteradar_subscription_impl()
returns public.workspace_subscriptions language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid:=auth.uid(); v_workspace_id uuid; result_sub public.workspace_subscriptions%rowtype; expired_trial_end timestamptz;
begin
 if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select wm.workspace_id into v_workspace_id from public.workspace_members wm where wm.user_id=v_user_id and wm.joined_at is not null limit 1;
 if v_workspace_id is null then raise exception 'Workspace setup is not complete' using errcode='P0002'; end if;
 select trial_ends_at into expired_trial_end from public.workspace_subscriptions where workspace_id=v_workspace_id and status='trialing' and trial_ends_at<=now() for update;
 if expired_trial_end is not null then
  update public.workspace_subscriptions set status='expired',plan_key='free',current_period_end=now(),updated_at=now() where workspace_id=v_workspace_id returning * into result_sub;
  insert into public.subscription_notifications(workspace_id,notification_type,channel,scheduled_for,status,idempotency_key,payload)
   values(v_workspace_id,'trial_expired','email',now(),'queued','trial-expired:'||v_workspace_id::text||':'||to_char(expired_trial_end at time zone 'UTC','YYYYMMDDHH24MISS'),jsonb_build_object('trial_ends_at',expired_trial_end))
   on conflict(idempotency_key) do nothing;
  return result_sub;
 end if;
 update public.workspace_subscriptions set status='expired',plan_key='free',updated_at=now() where workspace_id=v_workspace_id and status in ('active','past_due') and current_period_end is not null and current_period_end<=now();
 update public.workspace_subscriptions set status='canceled',plan_key='free',updated_at=now() where workspace_id=v_workspace_id and status='cancel_at_period_end' and current_period_end is not null and current_period_end<=now();
 select * into result_sub from public.workspace_subscriptions where workspace_id=v_workspace_id;
 return result_sub;
end; $function$;
revoke all on function private.refresh_siteradar_subscription_impl() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.refresh_siteradar_subscription_impl() to authenticated;
create or replace function public.refresh_siteradar_subscription()
returns public.workspace_subscriptions language sql security invoker set search_path=''
as $function$ select * from private.refresh_siteradar_subscription_impl(); $function$;
revoke all on function public.refresh_siteradar_subscription() from public,anon;
grant execute on function public.refresh_siteradar_subscription() to authenticated;
