-- Read-only examples. Run as service_role or an auth user registered in
-- private.user_event_researchers. Replace :participant_id / :session_id in the SQL client.

-- 1. Participant sessions: start, explicit completion, and last activity.
select participant_id,id,status,started_at,completed_at,last_activity_at,completion_reason
from public.study_sessions where participant_id=:participant_id order by started_at;

-- 2. Full session timeline (server receipt is a deterministic tie-breaker).
select occurred_at,received_at,client_instance_id,sequence_no,event_name,screen,zone,sound_id,
       target_type,target_id,outcome,close_reason,operation_type,operation_idempotency_key,error_code,metadata
from public.user_events where study_session_id=:session_id
order by occurred_at,received_at,client_instance_id,sequence_no;

-- 3. Estimated screen dwell from each view to its next exit/view event.
with views as (
  select *,lead(occurred_at) over(partition by study_session_id order by occurred_at,received_at,sequence_no) next_at
  from public.user_events where event_name in ('screen_viewed','screen_exited')
)
select screen,count(*) views,sum(extract(epoch from(next_at-occurred_at))) estimated_seconds
from views where event_name='screen_viewed' and next_at is not null group by screen order by screen;

-- 4. Zone entries/exits.
select participant_id,zone,event_name,count(*) events,min(occurred_at) first_at,max(occurred_at) last_at
from public.user_events where event_name in ('zone_entered','zone_entry_succeeded','zone_exited')
group by participant_id,zone,event_name order by participant_id,zone,event_name;

-- 5. Audio starts per sound.
select sound_id,count(*) play_starts,count(distinct study_session_id) sessions
from public.user_events where event_name in ('audio_play_started','museum_audio_play_started')
group by sound_id order by play_starts desc;

-- 6. Annotation modal outcomes and close reasons.
select coalesce(close_reason,'not_closed') close_reason,count(*)
from public.user_events where event_name='annotation_modal_closed' group by close_reason order by count(*) desc;

select count(*) filter(where event_name='annotation_modal_opened') opened,
       count(*) filter(where event_name='annotation_submit_succeeded') submitted,
       count(*) filter(where event_name='annotation_skip_succeeded') skipped,
       count(*) filter(where event_name='annotation_modal_closed' and close_reason in ('close_button','escape','backdrop','navigation')) cancelled
from public.user_events;

-- 7. Confidence first/final value by modal/session and sound.
with changes as (
  select study_session_id,sound_id,occurred_at,value_after->>'confidence' confidence,
    row_number() over(partition by study_session_id,sound_id order by occurred_at,sequence_no) first_rank,
    row_number() over(partition by study_session_id,sound_id order by occurred_at desc,sequence_no desc) last_rank
  from public.user_events where event_name in ('confidence_selected','confidence_changed')
)
select study_session_id,sound_id,max(confidence) filter(where first_rank=1) first_confidence,
       max(confidence) filter(where last_rank=1) final_confidence
from changes group by study_session_id,sound_id;

-- 8. Persistence attempts vs outcomes and retry recovery.
select operation_type,count(*) filter(where event_name like '%_attempted') attempted,
       count(*) filter(where event_name like '%_succeeded') succeeded,
       count(*) filter(where event_name like '%_failed') failed
from public.user_events where operation_idempotency_key is not null group by operation_type;

select operation_type,operation_idempotency_key,
       count(*) filter(where outcome='failed' or event_name like '%_failed') failures,
       bool_or(outcome='succeeded' or event_name like '%_succeeded') eventually_succeeded
from public.user_events where operation_idempotency_key is not null
group by operation_type,operation_idempotency_key having count(*) filter(where event_name like '%_failed')>0;

-- 9. Museum impressions, selection rate, deselection/change count.
select sound_id,count(*) filter(where event_name='museum_expression_impression') impressions,
       count(*) filter(where event_name='museum_expression_selected') selections,
       count(*) filter(where event_name='museum_expression_deselected') deselections,
       count(*) filter(where event_name='museum_expression_changed') changes
from public.user_events group by sound_id;

-- 10. Likely abandonment point (active session with no recent activity).
select distinct on (s.id) s.participant_id,s.id,e.event_name,e.screen,e.zone,e.occurred_at,s.last_activity_at
from public.study_sessions s left join public.user_events e on e.study_session_id=s.id
where s.status='active' and s.last_activity_at < now()-interval '30 minutes'
order by s.id,e.occurred_at desc,e.received_at desc;

-- 11. Operation/result comparison through 003's idempotent result document.
select e.operation_type,e.operation_idempotency_key,e.event_name,e.result_entity_id,
       o.status,o.result
from public.user_events e left join public.idempotent_operations o
  on o.auth_user_id=e.auth_user_id and o.operation_type=e.operation_type and o.idempotency_key=e.operation_idempotency_key
where e.operation_idempotency_key is not null order by e.occurred_at;

-- 12. Sequence gaps/duplicates and client/server clock skew.
with ordered as (
  select *,lag(sequence_no) over(partition by study_session_id,client_instance_id order by sequence_no) previous_sequence
  from public.user_events
)
select study_session_id,client_instance_id,previous_sequence,sequence_no
from ordered where previous_sequence is not null and sequence_no<>previous_sequence+1;

select id,study_session_id,event_name,occurred_at,received_at,
       extract(epoch from(received_at-occurred_at)) clock_delta_seconds
from public.user_events where abs(extract(epoch from(received_at-occurred_at)))>300 order by abs(extract(epoch from(received_at-occurred_at))) desc;

-- 13. Results without success logs, and success logs without result rows.
select a.id,a.participant_id,a.sound_id
from public.annotations a left join public.user_events e
  on e.result_entity_type='annotation' and e.result_entity_id=a.id::text and e.event_name='annotation_submit_succeeded'
where e.id is null;

select v.id,v.participant_id,v.sound_id
from public.votes v left join public.user_events e
  on e.result_entity_type='vote' and e.result_entity_id=v.id::text and e.event_name='museum_vote_submit_succeeded'
where e.id is null;

select e.id,e.event_name,e.result_entity_type,e.result_entity_id
from public.user_events e
where e.event_name in ('annotation_submit_succeeded','museum_vote_submit_succeeded') and not exists (
  select 1 from public.annotations a where e.result_entity_type='annotation' and a.id::text=e.result_entity_id
  union all
  select 1 from public.votes v where e.result_entity_type='vote' and v.id::text=e.result_entity_id
);
