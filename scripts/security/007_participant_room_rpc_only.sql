-- Stage 10 forward security boundary: authenticated room writes are RPC-only.
-- Apply only with an application version that saves through save_participant_room_v3.
begin;

do $$
begin
  if to_regclass('public.participant_room') is null then
    raise exception 'Required table public.participant_room is missing';
  end if;
  if to_regprocedure('public.save_participant_room_v3(uuid,jsonb)') is null then
    raise exception 'Required function public.save_participant_room_v3(uuid,jsonb) is missing';
  end if;
end $$;

alter table public.participant_room enable row level security;

-- Make direct writes unavailable even if an earlier schema granted them to a
-- broad role. SELECT remains available to authenticated owners through the
-- existing participant_room_select_own policy.
revoke insert, update, delete, truncate on table public.participant_room
  from public, anon, authenticated;
grant select on table public.participant_room to authenticated;

-- These policies would be dormant without table grants, but retaining them
-- would silently restore the bypass if a future grant regressed. Remove them
-- so the intended boundary is explicit in both ACLs and RLS policy inventory.
drop policy if exists participant_room_insert_own on public.participant_room;
drop policy if exists participant_room_update_own on public.participant_room;
drop policy if exists participant_room_delete_own on public.participant_room;

-- Reassert the RPC boundary and fixed-search-path SECURITY DEFINER contract.
alter function public.save_participant_room_v3(uuid,jsonb) security definer;
alter function public.save_participant_room_v3(uuid,jsonb) set search_path = '';
revoke all on function public.save_participant_room_v3(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.save_participant_room_v3(uuid,jsonb)
  to authenticated;

commit;
