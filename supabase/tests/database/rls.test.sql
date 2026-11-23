begin;

select plan(40);

select hasnt_column('public', 'public_keys', 'd', 'public key rows have no private exponent column');
select hasnt_column('public', 'public_keys', 'p', 'public key rows have no p prime column');
select hasnt_column('public', 'public_keys', 'q', 'public key rows have no q prime column');
select ok(
  not public.is_valid_exam_progress('{"version":1,"attempts":1,"correct":2,"streak":0,"best":0,"seen":[],"topics":{}}'::jsonb),
  'invalid progress counters are rejected'
);

-- The auth trigger should create one private profile per new account.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'rls-a@example.test', '', now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'rls-b@example.test', '', now())
on conflict (id) do nothing;

select ok(
  exists (select 1 from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  'new account A receives a profile'
);
select ok(
  exists (select 1 from public.profiles where user_id = '22222222-2222-4222-8222-222222222222'),
  'new account B receives a profile'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select lives_ok($$insert into public.public_keys (id, user_id, name, n, e, fingerprint)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'Alice key', '187', '7', repeat('a', 64))$$,
  'account A can insert its public key');
select lives_ok($$insert into public.contacts (id, user_id, name, n, e, fingerprint)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', auth.uid(), 'Bob', '187', '7', repeat('b', 64))$$,
  'account A can insert its contact');
select lives_ok($$insert into public.exam_progress (user_id, progress)
  values (auth.uid(), '{"version":1,"attempts":0,"correct":0,"streak":0,"best":0,"seen":[],"topics":{}}'::jsonb)$$,
  'account A can insert valid practice progress');
select lives_ok($$insert into public.shared_keys (id, user_id, slug, name, n, e, fingerprint)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', auth.uid(), 'abcdefghijklmnopqrstuvwxyz123456', 'Alice key', '187', '7', repeat('c', 64))$$,
  'account A can create a share link');
select throws_ok($$update public.exam_progress
  set progress = progress || '{"d":"private value"}'::jsonb$$,
  '23514', null, 'progress rejects unexpected top-level fields');
select throws_ok($$update public.exam_progress
  set progress = jsonb_set(progress, '{topics,modulus}', '{"attempts":1,"correct":1,"d":"private value"}')$$,
  '23514', null, 'progress rejects unexpected nested fields');
select throws_ok($$update public.exam_progress
  set progress = jsonb_set(progress, '{seen}', '["unexpected-id"]')$$,
  '23514', null, 'progress accepts only generated question IDs');
select throws_ok($$update public.exam_progress
  set progress = jsonb_set(progress, '{version}', '"1"')$$,
  '23514', null, 'progress requires a numeric version');
select throws_ok($$update public.exam_progress
  set progress = jsonb_set(progress, '{attempts}', '9007199254740992')$$,
  '23514', null, 'progress counters fit the browser safe integer range');
select throws_ok($$update public.exam_progress
  set progress = jsonb_set(progress, '{topics,modulus}', '{"attempts":9007199254740992,"correct":0}')$$,
  '23514', null, 'per-topic counters fit the browser safe integer range');
select lives_ok($$update public.exam_progress
  set progress = jsonb_set(progress, '{seen}', '["practice.v1:exam:4294967295:modulus"]')$$,
  'progress accepts generated question IDs');

select is((select count(*) from public.public_keys), 1::bigint, 'account A can read its public key');
select is((select count(*) from public.contacts), 1::bigint, 'account A can read its contact');
select is((select count(*) from public.exam_progress), 1::bigint, 'account A can read its progress');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select throws_ok($$insert into public.public_keys (id, user_id, name, n, e, fingerprint)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '11111111-1111-4111-8111-111111111111',
    'Other owner', '187', '7', repeat('e', 64))$$,
  '42501', 'cloud writes require account ownership', 'foreign owner state stays private');
select is((select count(*) from public.profiles), 1::bigint, 'account B sees only its own profile');
select is((select count(*) from public.public_keys), 0::bigint, 'account B cannot read account A public keys');
select is((select count(*) from public.contacts), 0::bigint, 'account B cannot read account A contacts');
select is((select count(*) from public.exam_progress), 0::bigint, 'account B cannot read account A progress');
select is((select count(*) from public.shared_keys), 0::bigint, 'account B cannot read account A share-link rows');

reset role;
set local role anon;
select throws_ok($$select * from public.shared_keys$$, '42501', null,
  'anonymous users cannot read the shared_keys table directly');
select is((select name from public.get_shared_key('abcdefghijklmnopqrstuvwxyz123456')), 'Alice key'::text,
  'anonymous lookup returns only the approved public key name');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok($$update public.shared_keys set revoked_at = now()
  where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$, 'owner can revoke its share link');
reset role;
set local role anon;
select is((select count(*) from public.get_shared_key('abcdefghijklmnopqrstuvwxyz123456')), 0::bigint,
  'revoked share link no longer resolves');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok($$select public.delete_my_data()$$, 'owner can delete its cloud data');
select is((select count(*) from public.public_keys), 0::bigint, 'cloud deletion removes public keys');
select is((select count(*) from public.profiles where not sync_enabled and data_deleted_at is not null), 1::bigint,
  'cloud deletion disables sync and records a deletion marker');
select throws_ok($$insert into public.public_keys (id, user_id, name, n, e, fingerprint)
  values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', auth.uid(), 'Reupload', '187', '7', repeat('d', 64))$$,
  '42501', null, 'deleted cloud data cannot be silently uploaded again');

select is((select count(*) from public.contacts), 0::bigint, 'cloud deletion removes contacts');
select is((select count(*) from public.exam_progress), 0::bigint, 'cloud deletion removes practice progress');
select is((select count(*) from public.shared_keys), 0::bigint, 'cloud deletion removes sharing rows');
select throws_ok($$update public.profiles set sync_enabled = true where user_id = auth.uid()$$,
  '23514', null, 'direct profile updates cannot reopen writes after deletion');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select throws_ok($$insert into public.public_keys (id, user_id, name, n, e, fingerprint)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '11111111-1111-4111-8111-111111111111',
    'Other owner', '187', '7', repeat('e', 64))$$,
  '42501', 'cloud writes require account ownership', 'foreign owner state stays private');
select is((select count(*) from public.profiles where sync_enabled and data_deleted_at is null),
  1::bigint, 'account A deletion leaves account B enabled');

select * from finish();
rollback;
