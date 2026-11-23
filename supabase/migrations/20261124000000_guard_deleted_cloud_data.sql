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
begin
  perform 1 from public.profiles
  where user_id = new.user_id and sync_enabled and data_deleted_at is null
  for share;
  if not found then
    raise exception 'cloud writes disabled for this account' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.require_cloud_writes_enabled() from public, anon, authenticated;

create trigger public_keys_require_cloud_writes before insert or update on public.public_keys
  for each row execute function public.require_cloud_writes_enabled();
create trigger contacts_require_cloud_writes before insert or update on public.contacts
  for each row execute function public.require_cloud_writes_enabled();
create trigger exam_progress_require_cloud_writes before insert or update on public.exam_progress
  for each row execute function public.require_cloud_writes_enabled();
create trigger shared_keys_require_cloud_writes before insert or update on public.shared_keys
  for each row execute function public.require_cloud_writes_enabled();

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
