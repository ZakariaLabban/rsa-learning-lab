-- Public-data-only cloud schema for RSA Learning Lab.
-- Private RSA values (d, p, q, dp, dq, qInv) are intentionally absent.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sync_enabled boolean not null default true,
  data_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.public_keys (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  n text not null,
  e text not null,
  fingerprint text not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint public_keys_name_valid check (
    char_length(name) between 1 and 60 and name = btrim(name) and name !~ '[[:cntrl:]]'
  ),
  constraint public_keys_n_valid check (
    char_length(n) between 1 and 1300 and n ~ '^[0-9]+$' and n::numeric > 1
  ),
  constraint public_keys_e_valid check (
    char_length(e) between 1 and 1300 and e ~ '^[0-9]+$' and e::numeric > 1 and e::numeric < n::numeric
  ),
  constraint public_keys_fingerprint_valid check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint public_keys_revision_valid check (revision > 0)
);
create index public_keys_user_updated_idx on public.public_keys (user_id, updated_at desc);

create table public.contacts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  n text not null,
  e text not null,
  fingerprint text not null,
  verified boolean not null default false,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contacts_name_valid check (
    char_length(name) between 1 and 60 and name = btrim(name) and name !~ '[[:cntrl:]]'
  ),
  constraint contacts_n_valid check (char_length(n) between 1 and 1300 and n ~ '^[0-9]+$' and n::numeric > 1),
  constraint contacts_e_valid check (
    char_length(e) between 1 and 1300 and e ~ '^[0-9]+$' and e::numeric > 1 and e::numeric < n::numeric
  ),
  constraint contacts_fingerprint_valid check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint contacts_revision_valid check (revision > 0)
);
create index contacts_user_updated_idx on public.contacts (user_id, updated_at desc);

create function public.is_valid_exam_progress(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  attempts bigint;
  correct bigint;
  streak bigint;
  best bigint;
  item record;
  topic_attempts bigint;
  topic_correct bigint;
  topic_count integer;
  allowed_topics text[] := array[
    'modulus', 'totient', 'private-exponent', 'encrypt', 'decrypt',
    'inverse', 'power', 'miller-rabin', 'crt', 'phi'
  ];
begin
  if value is null or pg_catalog.jsonb_typeof(value) <> 'object'
    or pg_catalog.octet_length(value::text) > 100000
    or value->>'version' is distinct from '1'
    or pg_catalog.jsonb_typeof(value->'seen') is distinct from 'array'
    or pg_catalog.jsonb_array_length(value->'seen') > 128
    or pg_catalog.jsonb_typeof(value->'topics') is distinct from 'object' then
    return false;
  end if;

  select count(*) into topic_count from pg_catalog.jsonb_object_keys(value->'topics');
  if topic_count > 10 then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(value->'seen') as seen(item)
    where pg_catalog.jsonb_typeof(seen.item) <> 'string'
      or pg_catalog.char_length(seen.item #>> '{}') > 100
  ) then
    return false;
  end if;

  if value->>'attempts' is null or value->>'correct' is null
    or value->>'streak' is null or value->>'best' is null
    or pg_catalog.jsonb_typeof(value->'attempts') <> 'number'
    or pg_catalog.jsonb_typeof(value->'correct') <> 'number'
    or pg_catalog.jsonb_typeof(value->'streak') <> 'number'
    or pg_catalog.jsonb_typeof(value->'best') <> 'number'
    or (value->>'attempts') !~ '^[0-9]{1,16}$'
    or (value->>'correct') !~ '^[0-9]{1,16}$'
    or (value->>'streak') !~ '^[0-9]{1,16}$'
    or (value->>'best') !~ '^[0-9]{1,16}$' then
    return false;
  end if;
  attempts := (value->>'attempts')::bigint;
  correct := (value->>'correct')::bigint;
  streak := (value->>'streak')::bigint;
  best := (value->>'best')::bigint;
  if correct > attempts or streak > correct or best > correct then
    return false;
  end if;

  for item in select * from pg_catalog.jsonb_each(value->'topics') loop
    if not item.key = any(allowed_topics)
      or pg_catalog.jsonb_typeof(item.value) <> 'object'
      or item.value->>'attempts' is null or item.value->>'correct' is null
      or pg_catalog.jsonb_typeof(item.value->'attempts') <> 'number'
      or pg_catalog.jsonb_typeof(item.value->'correct') <> 'number'
      or (item.value->>'attempts') !~ '^[0-9]{1,16}$'
      or (item.value->>'correct') !~ '^[0-9]{1,16}$' then
      return false;
    end if;
    topic_attempts := (item.value->>'attempts')::bigint;
    topic_correct := (item.value->>'correct')::bigint;
    if topic_correct > topic_attempts then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create table public.exam_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress jsonb not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint exam_progress_shape_valid check (public.is_valid_exam_progress(progress)),
  constraint exam_progress_revision_valid check (revision > 0)
);

create table public.shared_keys (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  name text not null,
  n text not null,
  e text not null,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1,
  revoked_at timestamptz,
  constraint shared_keys_slug_valid check (slug ~ '^[A-Za-z0-9_-]{32,128}$'),
  constraint shared_keys_name_valid check (
    char_length(name) between 1 and 60 and name = btrim(name) and name !~ '[[:cntrl:]]'
  ),
  constraint shared_keys_n_valid check (char_length(n) between 1 and 1300 and n ~ '^[0-9]+$' and n::numeric > 1),
  constraint shared_keys_e_valid check (
    char_length(e) between 1 and 1300 and e ~ '^[0-9]+$' and e::numeric > 1 and e::numeric < n::numeric
  ),
  constraint shared_keys_fingerprint_valid check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint shared_keys_revision_valid check (revision > 0)
);
create index shared_keys_user_created_idx on public.shared_keys (user_id, created_at desc);

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.touch_profile_updated_at() from public, anon, authenticated;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

create function public.set_sync_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new)->>'user_id') is distinct from (to_jsonb(old)->>'user_id')
      or (tg_table_name <> 'exam_progress'
        and (to_jsonb(new)->>'id') is distinct from (to_jsonb(old)->>'id')) then
      raise exception 'row identity and owner cannot be changed';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  else
    new.revision := 1;
    new.created_at := coalesce(new.created_at, pg_catalog.clock_timestamp());
  end if;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.set_sync_revision() from public, anon, authenticated;
create trigger public_keys_revision before insert or update on public.public_keys
  for each row execute function public.set_sync_revision();
create trigger contacts_revision before insert or update on public.contacts
  for each row execute function public.set_sync_revision();
create trigger exam_progress_revision before insert or update on public.exam_progress
  for each row execute function public.set_sync_revision();
create trigger shared_keys_revision before insert or update on public.shared_keys
  for each row execute function public.set_sync_revision();

create function public.enforce_user_row_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_limit integer;
  active_count bigint;
  active_predicate text;
  active_column text;
begin
  if tg_table_name = 'public_keys' then
    row_limit := 100;
    active_predicate := 'deleted_at is null';
    active_column := 'deleted_at';
  elsif tg_table_name = 'contacts' then
    row_limit := 500;
    active_predicate := 'deleted_at is null';
    active_column := 'deleted_at';
  elsif tg_table_name = 'shared_keys' then
    row_limit := 100;
    active_predicate := 'revoked_at is null';
    active_column := 'revoked_at';
  else
    raise exception 'row limit is not configured for %', tg_table_name;
  end if;

  if tg_op = 'UPDATE' then
    if (to_jsonb(old)->>active_column) is null then
      return new;
    end if;
  end if;
  if (to_jsonb(new)->>active_column) is not null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  execute pg_catalog.format(
    'select count(*) from public.%I where user_id = $1 and %s',
    tg_table_name,
    active_predicate
  ) into active_count using new.user_id;
  if active_count >= row_limit then
    raise exception 'per-user limit of % active % rows reached', row_limit, tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_user_row_limit() from public, anon, authenticated;
create trigger public_keys_limit before insert or update on public.public_keys
  for each row execute function public.enforce_user_row_limit();
create trigger contacts_limit before insert or update on public.contacts
  for each row execute function public.enforce_user_row_limit();
create trigger shared_keys_limit before insert or update on public.shared_keys
  for each row execute function public.enforce_user_row_limit();

alter table public.profiles enable row level security;
alter table public.public_keys enable row level security;
alter table public.contacts enable row level security;
alter table public.exam_progress enable row level security;
alter table public.shared_keys enable row level security;

create policy "profiles are private to their owner" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owners can update their profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "owners can read their public keys" on public.public_keys
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owners can add public keys while sync is enabled" on public.public_keys
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.sync_enabled
    )
  );
create policy "owners can update public keys while sync is enabled" on public.public_keys
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.sync_enabled
  ));

create policy "owners can read their contacts" on public.contacts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owners can add contacts while sync is enabled" on public.contacts
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.sync_enabled
    )
  );
create policy "owners can update contacts while sync is enabled" on public.contacts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.sync_enabled
  ));

create policy "owners can read their exam progress" on public.exam_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owners can add exam progress while sync is enabled" on public.exam_progress
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.sync_enabled
    )
  );
create policy "owners can update exam progress while sync is enabled" on public.exam_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.sync_enabled
  ));

create policy "owners can read their shared keys" on public.shared_keys
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owners can create shared keys while sync is enabled" on public.shared_keys
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.sync_enabled
    )
  );
create policy "owners can update shared keys while sync is enabled" on public.shared_keys
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.sync_enabled
  ));

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.public_keys to authenticated;
grant select, insert, update on public.contacts to authenticated;
grant select, insert, update on public.exam_progress to authenticated;
grant select, insert, update on public.shared_keys to authenticated;
revoke all on function public.is_valid_exam_progress(jsonb) from public, anon;
grant execute on function public.is_valid_exam_progress(jsonb) to authenticated, service_role;
revoke all on public.profiles, public.public_keys, public.contacts, public.exam_progress, public.shared_keys from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (sync_enabled) on public.profiles to authenticated;

create function public.get_shared_key(share_slug text)
returns table (name text, n text, e text, fingerprint text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.name, s.n, s.e, s.fingerprint
  from public.shared_keys as s
  where s.slug = share_slug and s.revoked_at is null
  limit 1;
$$;
revoke all on function public.get_shared_key(text) from public;
grant execute on function public.get_shared_key(text) to anon, authenticated;

create function public.delete_my_data()
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

  delete from public.shared_keys where user_id = owner_id;
  delete from public.exam_progress where user_id = owner_id;
  delete from public.contacts where user_id = owner_id;
  delete from public.public_keys where user_id = owner_id;
  update public.profiles
    set sync_enabled = false, data_deleted_at = pg_catalog.clock_timestamp()
    where user_id = owner_id;
end;
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- Project creation can install this SECURITY DEFINER event-trigger function when
-- "Enable RLS on new tables automatically" is selected. It must remain callable
-- by its event trigger, but browser roles do not need direct EXECUTE permission.
do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
