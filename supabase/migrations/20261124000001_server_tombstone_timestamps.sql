-- Keep deletion ordering authoritative across devices; never trust a device clock.
create function public.set_cloud_tombstone_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is not null then
      new.deleted_at := pg_catalog.clock_timestamp();
    end if;
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    new.deleted_at := pg_catalog.clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function public.set_cloud_tombstone_timestamp() from public, anon, authenticated;

create trigger cloud_tombstone_timestamp
  before insert or update on public.public_keys
  for each row execute function public.set_cloud_tombstone_timestamp();
create trigger cloud_tombstone_timestamp
  before insert or update on public.contacts
  for each row execute function public.set_cloud_tombstone_timestamp();
create trigger cloud_tombstone_timestamp
  before insert or update on public.exam_progress
  for each row execute function public.set_cloud_tombstone_timestamp();
