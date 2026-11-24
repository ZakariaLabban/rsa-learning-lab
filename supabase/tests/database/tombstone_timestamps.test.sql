begin;

select plan(3);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'tombstones@example.test', '', now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

insert into public.public_keys (id, user_id, name, n, e, fingerprint)
values ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', auth.uid(), 'Key', '187', '7', repeat('a', 64));
update public.public_keys set deleted_at = '1970-01-01T00:00:00Z' where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
select ok(
  (select deleted_at > now() - interval '1 hour' from public.public_keys where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
  'public key tombstone timestamp is assigned by the server'
);

insert into public.contacts (id, user_id, name, n, e, fingerprint)
values ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', auth.uid(), 'Contact', '187', '7', repeat('b', 64));
update public.contacts set deleted_at = '1970-01-01T00:00:00Z' where id = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
select ok(
  (select deleted_at > now() - interval '1 hour' from public.contacts where id = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'),
  'contact tombstone timestamp is assigned by the server'
);

insert into public.exam_progress (user_id, progress)
values (auth.uid(), '{"version":1,"attempts":0,"correct":0,"streak":0,"best":0,"seen":[],"topics":{}}');
update public.exam_progress set deleted_at = '1970-01-01T00:00:00Z' where user_id = auth.uid();
select ok(
  (select deleted_at > now() - interval '1 hour' from public.exam_progress where user_id = auth.uid()),
  'practice progress tombstone timestamp is assigned by the server'
);

select * from finish();
rollback;
