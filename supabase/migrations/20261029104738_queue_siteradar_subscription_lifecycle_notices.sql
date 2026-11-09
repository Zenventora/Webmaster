create or replace function public.log_siteradar_subscription_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare event_name text; notification_key text; notification_payload jsonb;
begin
 if tg_op='INSERT' then
  event_name:=case when new.status='trialing' then 'trial_started' else 'subscription_created' end;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,to_plan_key,to_status,metadata)
  values(new.workspace_id,new.activated_by,event_name,new.plan_key,new.status,jsonb_build_object('activation_source',new.activation_source));
  if event_name='trial_started' then
   notification_key:='trial-started:'||new.workspace_id::text||':'||to_char(new.trial_ends_at at time zone 'UTC','YYYYMMDDHH24MISS');
   insert into public.subscription_notifications(workspace_id,notification_type,channel,scheduled_for,status,idempotency_key,payload)
   values(new.workspace_id,'trial_started','email',now(),'queued',notification_key,jsonb_build_object('plan_key',new.plan_key,'trial_ends_at',new.trial_ends_at)) on conflict(idempotency_key) do nothing;
  end if;
  return new;
 end if;
 if old.plan_key is distinct from new.plan_key or old.status is distinct from new.status or old.trial_ends_at is distinct from new.trial_ends_at or old.current_period_end is distinct from new.current_period_end then
  event_name:=case when old.status<>'trialing' and new.status='trialing' then 'trial_started'
   when old.status='trialing' and new.status='expired' then 'trial_expired'
   when new.status='active' and old.status is distinct from 'active' then 'subscription_activated'
   when new.status='past_due' and old.status is distinct from 'past_due' then 'payment_past_due'
   when new.status in ('canceled','cancel_at_period_end') and old.status is distinct from new.status then 'subscription_canceled'
   when old.plan_key is distinct from new.plan_key then 'plan_changed' else 'subscription_updated' end;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,from_plan_key,to_plan_key,from_status,to_status,metadata)
  values(new.workspace_id,new.activated_by,event_name,old.plan_key,new.plan_key,old.status,new.status,jsonb_build_object('activation_source',new.activation_source));
  if event_name in ('trial_started','subscription_activated','payment_past_due','subscription_canceled') then
   notification_key:='subscription:'||new.workspace_id::text||':'||event_name||':'||to_char(coalesce(new.trial_ends_at,new.current_period_end,new.updated_at) at time zone 'UTC','YYYYMMDDHH24MISS');
   notification_payload:=jsonb_build_object('plan_key',new.plan_key,'status',new.status,'trial_ends_at',new.trial_ends_at,'current_period_end',new.current_period_end);
   insert into public.subscription_notifications(workspace_id,notification_type,channel,scheduled_for,status,idempotency_key,payload)
   values(new.workspace_id,event_name,'email',now(),'queued',notification_key,notification_payload) on conflict(idempotency_key) do nothing;
  end if;
 end if;
 return new;
end; $function$;
revoke all on function public.log_siteradar_subscription_event() from public,anon,authenticated;
