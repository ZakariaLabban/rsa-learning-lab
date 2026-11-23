-- Clear legacy inconsistent profiles before making the deletion marker authoritative.
update public.profiles
set sync_enabled = false
where data_deleted_at is not null and sync_enabled;

alter table public.profiles add constraint deleted_cloud_data_disables_sync
  check (data_deleted_at is null or not sync_enabled);

-- Serialize application writes with deletion. RLS still verifies ownership.
-- A writer that starts after deletion must see the updated profile even if its
-- statement snapshot predates the deletion.
create function public.require_cloud_writes_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  owner_id uuid;
begin
  if tg_level = 'STATEMENT' then
    if caller_id is null then return null; end if;
    owner_id := caller_id;
  else
    if caller_id is not null and new.user_id is distinct from caller_id then
      raise exception 'cloud writes require account ownership' using errcode = '42501';
    end if;
    owner_id := new.user_id;
  end if;

  perform 1 from public.profiles
  where user_id = owner_id and sync_enabled and data_deleted_at is null
  for share;
  if not found then
    raise exception 'cloud writes disabled for this account' using errcode = '42501';
  end if;
  if tg_level = 'STATEMENT' then return null; end if;
  return new;
end;
$$;
revoke all on function public.require_cloud_writes_enabled() from public, anon, authenticated;

-- Acquire the caller's profile lock before UPDATE can lock any target row.
-- Run the row guard before the existing per-owner quota triggers.
do $$
declare
  target text;
begin
  foreach target in array array['public_keys', 'contacts', 'exam_progress', 'shared_keys'] loop
    execute pg_catalog.format(
      'create trigger cloud_write_lock before update on public.%I
         for each statement execute function public.require_cloud_writes_enabled()', target
    );
    execute pg_catalog.format(
      'create trigger a_cloud_write_guard before insert or update on public.%I
         for each row execute function public.require_cloud_writes_enabled()', target
    );
  end loop;
end;
$$;

-- Preserve legacy rows while restricting every new or updated progress payload.
create function public.is_public_exam_progress(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when public.is_valid_exam_progress(value) then
      value->'version' = '1'::jsonb
      and greatest(
        (value->>'attempts')::bigint,
        (value->>'correct')::bigint,
        (value->>'streak')::bigint,
        (value->>'best')::bigint
      ) <= 9007199254740991
      and value - array['version', 'attempts', 'correct', 'streak', 'best', 'seen', 'topics'] = '{}'::jsonb
      and not exists (
        select 1 from pg_catalog.jsonb_each(value->'topics') as topics(topic, stats)
        where stats - array['attempts', 'correct'] <> '{}'::jsonb
          or greatest((stats->>'attempts')::bigint, (stats->>'correct')::bigint) > 9007199254740991
      )
      and not exists (
        select 1 from pg_catalog.jsonb_array_elements_text(value->'seen') as ids(id)
        where id !~ '^practice[.]v1:(intro|exam):(0|[1-9][0-9]{0,9}):(modulus|totient|private-exponent|encrypt|decrypt|inverse|power|miller-rabin|crt|phi)$'
          or case when pg_catalog.split_part(id, ':', 3) ~ '^[0-9]{1,10}$'
            then pg_catalog.split_part(id, ':', 3)::bigint > 4294967295 else true end
      )
    else false
  end;
$$;
revoke all on function public.is_public_exam_progress(jsonb) from public, anon;
grant execute on function public.is_public_exam_progress(jsonb) to authenticated, service_role;

alter table public.exam_progress add constraint exam_progress_public_payload
  check (public.is_public_exam_progress(progress)) not valid;

create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.profiles
    set sync_enabled = false, data_deleted_at = pg_catalog.clock_timestamp()
    where user_id = owner_id;
  if not found then
    raise exception 'cloud profile missing' using errcode = 'P0002';
  end if;
  delete from public.shared_keys where user_id = owner_id;
  delete from public.exam_progress where user_id = owner_id;
  delete from public.contacts where user_id = owner_id;
  delete from public.public_keys where user_id = owner_id;
end;
$$;
