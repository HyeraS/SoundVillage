-- Read-only preflight for 008_multi_village_economy.sql.
do $$
begin
  if to_regclass('public.study_participants') is null then raise exception 'missing study_participants'; end if;
  if to_regclass('public.participant_currency') is null then raise exception 'missing legacy participant_currency'; end if;
  if to_regclass('public.currency_transactions') is null then raise exception 'missing legacy currency_transactions'; end if;
  if to_regprocedure('private.current_participant_id()') is null then raise exception 'missing current_participant_id'; end if;
  if to_regprocedure('public.secure_purchase_admin(uuid,text,text,integer,text,text[],uuid)') is null then
    raise exception 'missing legacy secure_purchase_admin';
  end if;
  if to_regprocedure('public.save_participant_room_v3(uuid,jsonb)') is null then raise exception 'migration 007 is not present'; end if;
end $$;
