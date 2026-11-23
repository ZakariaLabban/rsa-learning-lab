begin;

select plan(3);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'limits@example.test', '', now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

insert into public.public_keys (id, user_id, name, n, e, fingerprint)
select gen_random_uuid(), auth.uid(), 'Key ' || i, '187', '7', lpad(to_hex(i), 64, 'a')
from generate_series(1, 100) as numbers(i);
select throws_ok($$insert into public.public_keys (id, user_id, name, n, e, fingerprint)
  values (gen_random_uuid(), auth.uid(), 'Key 101', '187', '7', repeat('f', 64))$$,
  '23514', null, 'active public keys are capped at 100 per account');

insert into public.contacts (id, user_id, name, n, e, fingerprint)
select gen_random_uuid(), auth.uid(), 'Contact ' || i, '187', '7', lpad(to_hex(i), 64, 'b')
from generate_series(1, 500) as numbers(i);
select throws_ok($$insert into public.contacts (id, user_id, name, n, e, fingerprint)
  values (gen_random_uuid(), auth.uid(), 'Contact 501', '187', '7', repeat('f', 64))$$,
  '23514', null, 'contacts are capped at 500 per account');

insert into public.shared_keys (id, user_id, slug, name, n, e, fingerprint)
select gen_random_uuid(), auth.uid(), lpad(to_hex(i), 32, 'c'), 'Share ' || i, '187', '7', lpad(to_hex(i), 64, 'd')
from generate_series(1, 100) as numbers(i);
select throws_ok($$insert into public.shared_keys (id, user_id, slug, name, n, e, fingerprint)
  values (gen_random_uuid(), auth.uid(), repeat('z', 32), 'Share 101', '187', '7', repeat('f', 64))$$,
  '23514', null, 'active share links are capped at 100 per account');

select * from finish();
rollback;
