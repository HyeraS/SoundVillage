-- SoundVillage Stage 5.1 production-data preflight.
-- READ ONLY: run after migration 014 verification and before enabling cutover.
-- Expected result: every blocking_summary issue_count and the final
-- blocking_issue_count are zero. active_duo_session rows are not blockers by
-- themselves, but every row must be resolved or explicitly accepted by an
-- operator before cutover. This file never repairs, deletes, or updates data.
begin transaction read only;

with
expected_catalog(alias_count,canonical_count) as (values (1000::bigint,995::bigint)),
character_catalog(item_id,slot) as (values
  ('basic','outfit'),
  ('overalls','outfit'),('sailor','outfit'),('sporty','outfit'),('suit','outfit'),
  ('witch','outfit'),('clown','outfit'),('dress','outfit'),('floral','outfit'),
  ('pants','outfit'),('pants_suit','outfit'),('pumpkin','outfit'),('sailor_bow','outfit'),
  ('shoes','outfit'),('skirt','outfit'),('skull','outfit'),('spaghetti','outfit'),
  ('spooky','outfit'),('stripe','outfit'),
  ('acc_beard','accessory'),('acc_earring_emerald','accessory'),
  ('acc_earring_red','accessory'),('acc_glasses','accessory'),
  ('acc_sunglasses','accessory'),('acc_hat_cowboy','accessory'),
  ('acc_hat_lucky','accessory'),('acc_mask_spooky','accessory')
),
participant_id_duplicates as (
  select
    'participant_id_duplicate'::text as issue_key,
    'normalized_participant_id_duplicate'::text as condition_key,
    jsonb_build_object(
      'normalizedParticipantId',upper(btrim(participant_id)),
      'rowCount',count(*),
      'participantIds',array_agg(participant_id order by participant_id)
    ) as detail
  from public.study_participants
  group by upper(btrim(participant_id))
  having count(*)>1
),
auth_user_duplicates as (
  select
    'auth_user_multiple_participants'::text as issue_key,
    'auth_user_id_multiple_participants'::text as condition_key,
    jsonb_build_object(
      'authUserId',auth_user_id,
      'rowCount',count(*),
      'participantIds',array_agg(participant_id order by participant_id)
    ) as detail
  from public.study_participants
  where auth_user_id is not null
  group by auth_user_id
  having count(*)>1
),
auth_mapping_missing as (
  select
    'auth_user_mapping_missing'::text as issue_key,
    case when p.auth_user_id is null
      then 'missing_auth_user_id' else 'missing_auth_users_row' end::text as condition_key,
    jsonb_build_object(
      'participantId',p.participant_id,
      'participantStatus',p.status,
      'authUserId',p.auth_user_id
    ) as detail
  from public.study_participants p
  left join auth.users u on u.id=p.auth_user_id
  where p.auth_user_id is null or u.id is null
),
catalog_counts as (
  select count(*)::bigint as alias_count,
    count(distinct canonical_audio_id)::bigint as canonical_count
  from public.study_sound_catalog
),
catalog_count_issues as (
  select
    'sound_catalog_integrity'::text as issue_key,
    'alias_count_mismatch'::text as condition_key,
    jsonb_build_object('actual',c.alias_count,'expected',e.alias_count) as detail
  from catalog_counts c cross join expected_catalog e
  where c.alias_count<>e.alias_count
  union all
  select
    'sound_catalog_integrity',
    'canonical_count_mismatch',
    jsonb_build_object('actual',c.canonical_count,'expected',e.canonical_count)
  from catalog_counts c cross join expected_catalog e
  where c.canonical_count<>e.canonical_count
),
catalog_required_field_issues as (
  select
    'sound_catalog_integrity'::text as issue_key,
    'required_field_missing'::text as condition_key,
    jsonb_build_object(
      'soundId',sound_id,
      'missingFields',array_remove(array[
        case when nullif(btrim(sound_id),'') is null then 'sound_id' end,
        case when nullif(btrim(zone),'') is null then 'zone' end,
        case when nullif(btrim(canonical_audio_id),'') is null then 'canonical_audio_id' end,
        case when nullif(btrim(file_path),'') is null then 'file_path' end,
        case when nullif(btrim(source_dataset),'') is null then 'source_dataset' end,
        case when nullif(btrim(original_filename),'') is null then 'original_filename' end
      ],null)
    ) as detail
  from public.study_sound_catalog
  where nullif(btrim(sound_id),'') is null
     or nullif(btrim(zone),'') is null
     or nullif(btrim(canonical_audio_id),'') is null
     or nullif(btrim(file_path),'') is null
     or nullif(btrim(source_dataset),'') is null
     or nullif(btrim(original_filename),'') is null
),
catalog_canonical_conflicts as (
  select
    'sound_catalog_integrity'::text as issue_key,
    'canonical_mapping_conflict'::text as condition_key,
    jsonb_build_object(
      'canonicalAudioId',canonical_audio_id,
      'filePaths',array_agg(distinct file_path order by file_path),
      'sourceIdentities',array_agg(distinct source_dataset||':'||original_filename
        order by source_dataset||':'||original_filename),
      'zones',array_agg(distinct zone order by zone),
      'groupIds',array_agg(distinct coalesce(group_id,'*') order by coalesce(group_id,'*'))
    ) as detail
  from public.study_sound_catalog
  group by canonical_audio_id
  having count(distinct file_path)>1
      or count(distinct source_dataset||':'||original_filename)>1
      or count(distinct zone)>1
      or count(distinct coalesce(group_id,'*'))>1
),
catalog_source_conflicts as (
  select
    'sound_catalog_integrity'::text as issue_key,
    'source_identity_canonical_conflict'::text as condition_key,
    jsonb_build_object(
      'sourceDataset',source_dataset,
      'originalFilename',original_filename,
      'canonicalAudioIds',array_agg(distinct canonical_audio_id order by canonical_audio_id)
    ) as detail
  from public.study_sound_catalog
  group by source_dataset,original_filename
  having count(distinct canonical_audio_id)>1
),
catalog_file_path_conflicts as (
  select
    'sound_catalog_integrity'::text as issue_key,
    'file_path_canonical_conflict'::text as condition_key,
    jsonb_build_object(
      'filePath',file_path,
      'canonicalAudioIds',array_agg(distinct canonical_audio_id order by canonical_audio_id)
    ) as detail
  from public.study_sound_catalog
  group by file_path
  having count(distinct canonical_audio_id)>1
),
study_session_issues as (
  select
    'study_session_completion_contradiction'::text as issue_key,
    case when status='active'
      then 'active_session_has_completion_evidence'
      else 'completed_session_missing_completed_at' end::text as condition_key,
    jsonb_build_object(
      'studySessionId',id,
      'participantId',participant_id,
      'status',status,
      'startedAt',started_at,
      'lastActivityAt',last_activity_at,
      'completedAt',completed_at,
      'completionAnnotationId',completion_annotation_id,
      'completionOperationKey',completion_operation_key
    ) as detail
  from public.study_sessions
  where (status='active' and (
      completed_at is not null
      or completion_annotation_id is not null
      or completion_operation_key is not null
    ))
    or (status='completed' and completed_at is null)
),
duo_lease_issues as (
  select
    'duo_lease_invalid'::text as issue_key,
    'stale_terminal_expired_or_left_member_lease'::text as condition_key,
    jsonb_build_object(
      'sessionId',l.session_id,
      'authUserId',l.auth_user_id,
      'clientId',l.client_id,
      'leaseState',l.state,
      'screen',l.screen,
      'heartbeatAt',l.heartbeat_at,
      'heartbeatAgeSeconds',extract(epoch from now()-l.heartbeat_at),
      'sessionStatus',s.status,
      'sessionExpiresAt',s.expires_at,
      'memberLeftAt',m.left_at,
      'reasons',array_remove(array[
        case when l.heartbeat_at<=now()-interval '45 seconds' then 'stale_lease' end,
        case when s.status<>'active' then 'lease_on_terminal_session' end,
        case when s.expires_at<=now() then 'lease_on_expired_session' end,
        case when m.left_at is not null then 'lease_for_left_member' end
      ],null)
    ) as detail
  from public.duo_v2_leases l
  join public.duo_v2_sessions s on s.id=l.session_id
  join public.duo_v2_session_members m
    on m.session_id=l.session_id and m.auth_user_id=l.auth_user_id
  where l.state='active' and (
    l.heartbeat_at<=now()-interval '45 seconds'
    or s.status<>'active'
    or s.expires_at<=now()
    or m.left_at is not null
  )
),
active_loadout_missing as (
  select
    'active_participant_loadout_missing'::text as issue_key,
    'active_participant_has_no_character_loadout'::text as condition_key,
    jsonb_build_object('participantId',p.participant_id,'participantStatus',p.status) as detail
  from public.study_participants p
  left join public.participant_multi_village_character_loadouts l using(participant_id)
  where p.status='active' and l.participant_id is null
),
loadout_catalog_issues as (
  select
    'loadout_catalog_invalid'::text as issue_key,
    'outfit_outside_catalog'::text as condition_key,
    jsonb_build_object('participantId',l.participant_id,'slot','outfit','itemId',l.outfit_id) as detail
  from public.participant_multi_village_character_loadouts l
  left join character_catalog c on c.item_id=l.outfit_id and c.slot='outfit'
  where c.item_id is null
  union all
  select
    'loadout_catalog_invalid',
    'accessory_outside_catalog',
    jsonb_build_object('participantId',l.participant_id,'slot','accessory','itemId',l.accessory_id)
  from public.participant_multi_village_character_loadouts l
  left join character_catalog c on c.item_id=l.accessory_id and c.slot='accessory'
  where l.accessory_id is not null and c.item_id is null
),
loadout_ownership_issues as (
  select
    'loadout_item_not_owned'::text as issue_key,
    'equipped_outfit_not_owned'::text as condition_key,
    jsonb_build_object('participantId',l.participant_id,'slot','outfit','itemId',l.outfit_id) as detail
  from public.participant_multi_village_character_loadouts l
  where l.outfit_id<>'basic' and not exists (
    select 1 from public.participant_catalog_items i
    where i.participant_id=l.participant_id and i.item_id=l.outfit_id
  )
  union all
  select
    'loadout_item_not_owned',
    'equipped_accessory_not_owned',
    jsonb_build_object('participantId',l.participant_id,'slot','accessory','itemId',l.accessory_id)
  from public.participant_multi_village_character_loadouts l
  where l.accessory_id is not null and not exists (
    select 1 from public.participant_catalog_items i
    where i.participant_id=l.participant_id and i.item_id=l.accessory_id
  )
),
blocking_issues as (
  select * from participant_id_duplicates
  union all select * from auth_user_duplicates
  union all select * from auth_mapping_missing
  union all select * from catalog_count_issues
  union all select * from catalog_required_field_issues
  union all select * from catalog_canonical_conflicts
  union all select * from catalog_source_conflicts
  union all select * from catalog_file_path_conflicts
  union all select * from study_session_issues
  union all select * from duo_lease_issues
  union all select * from active_loadout_missing
  union all select * from loadout_catalog_issues
  union all select * from loadout_ownership_issues
),
blocking_keys(issue_key) as (values
  ('participant_id_duplicate'),
  ('auth_user_multiple_participants'),
  ('auth_user_mapping_missing'),
  ('sound_catalog_integrity'),
  ('study_session_completion_contradiction'),
  ('duo_lease_invalid'),
  ('active_participant_loadout_missing'),
  ('loadout_catalog_invalid'),
  ('loadout_item_not_owned')
),
blocking_counts as (
  select k.issue_key,count(i.issue_key)::bigint as issue_count
  from blocking_keys k left join blocking_issues i using(issue_key)
  group by k.issue_key
),
active_duo_sessions as (
  select
    s.id as session_id,
    jsonb_build_object(
      'sessionId',s.id,
      'hostAuthUserId',s.host_auth_user_id,
      'status',s.status,
      'createdAt',s.created_at,
      'expiresAt',s.expires_at,
      'joinedMemberCount',count(distinct m.auth_user_id) filter(where m.left_at is null),
      'activeLeaseCount',count(distinct l.auth_user_id) filter(where l.state='active'),
      'staleLeaseCount',count(distinct l.auth_user_id) filter(
        where l.state='active' and l.heartbeat_at<=now()-interval '45 seconds')
    ) as detail
  from public.duo_v2_sessions s
  left join public.duo_v2_session_members m on m.session_id=s.id
  left join public.duo_v2_leases l
    on l.session_id=s.id and l.auth_user_id=m.auth_user_id
  where s.status='active'
  group by s.id
),
totals as (
  select
    coalesce((select sum(issue_count) from blocking_counts),0)::bigint as blocking_issue_count,
    (select count(*) from active_duo_sessions)::bigint as operator_review_count
),
report as (
  select
    1 as sort_order,
    'blocking_detail'::text as result_type,
    issue_key,
    condition_key,
    null::bigint as issue_count,
    null::bigint as blocking_issue_count,
    null::bigint as operator_review_count,
    detail
  from blocking_issues
  union all
  select
    2,
    'blocking_summary',
    issue_key,
    null,
    issue_count,
    null,
    null,
    null
  from blocking_counts
  union all
  select
    3,
    'operator_review_detail',
    'active_duo_session',
    'active_duo_session_requires_operator_review',
    null,
    null,
    null,
    detail
  from active_duo_sessions
  union all
  select
    4,
    'final_summary',
    'all_preflight_checks',
    null,
    null,
    blocking_issue_count,
    operator_review_count,
    null
  from totals
)
select result_type,issue_key,condition_key,issue_count,
  blocking_issue_count,operator_review_count,detail
from report
order by sort_order,issue_key,condition_key,detail::text;

rollback;
