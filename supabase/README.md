# Supabase setup for RSA Learning Lab

The browser app remains usable as a guest. Supabase stores only explicitly allowed public data: public RSA keys, contacts, practice progress, account preferences and revocable public-key links. Private RSA material (`d`, `p`, `q`, `dp`, `dq`, and `qInv`) is not part of the schema.

## Project setup

1. Create a Supabase project in the **Central EU (Frankfurt)** region (`eu-central-1`). Region cannot be changed after project creation.
2. In the project dashboard, open **Connect** and copy the project URL and publishable key. The publishable key is intended for browser use. Never put a secret/service-role key or database password in the frontend or commit it to Git.
3. Create the local frontend environment file `frontend/.env.local` with the Vite variables below. This file is ignored by Git.

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

4. Apply SQL files in `supabase/migrations/` in filename order using the dashboard SQL Editor, or use the Supabase CLI to link and push migrations. When applying a migration manually in the dashboard, reconcile the CLI migration history as described below so a later `supabase db push` does not try to apply it again.
5. For local database tests, install Docker and the Supabase CLI, run `supabase start`, then `supabase test db`. The RLS tests create two disposable auth users and verify owner isolation, public share lookup, revocation and cloud-data deletion behavior. A second test covers active-row limits for keys, contacts and share links.
6. In **Authentication → URL Configuration**, add the actual local development origin and the deployed Vercel origin to the redirect allowlist before enabling magic-link sign-in. Add the custom domain only when it is available.

The `delete_my_data()` RPC deletes the caller's cloud rows and disables sync on their profile. It does not delete the Supabase Auth account or email address. A future explicit user choice can re-enable sync; clients must not automatically re-upload cleared local records.

The project-creation option **Enable RLS on new tables automatically** is not required: this migration explicitly enables RLS on every app table. If that option was enabled, the migration revokes direct `EXECUTE` from browser roles on Supabase's `rls_auto_enable()` event-trigger function while leaving the event trigger itself intact.

## Recording a migration applied in the dashboard

Running a migration in the SQL Editor changes the database schema but does not add the migration to Supabase's CLI history. After manually applying a migration, use the Supabase CLI from the repository root to record it as applied:

```sh
supabase login
supabase link --project-ref <project-ref>
supabase migration repair 20261123000000 --status applied --remote
supabase migration list --remote
```

Get `<project-ref>` from the project's URL in the Supabase dashboard (the subdomain in `https://<project-ref>.supabase.co`). Confirm the repair prompt. `migration repair` updates migration history only; it does not run the SQL migration again. In the migration list, verify `20261123000000` appears in both the local and remote columns before running `supabase db push`.

## Schema and security rules

- Every table has row-level security. Account-owned rows are readable only by their owner; writes are blocked after cloud-data deletion disables sync.
- The anonymous role has no direct access to `shared_keys`. `get_shared_key(slug)` returns only the public name, modulus, exponent and fingerprint for an active slug.
- Public keys, contacts and share links have per-user active-row limits. Names, decimal RSA values, fingerprints, slug lengths and practice-progress payloads are checked in PostgreSQL.
- Syncable rows carry a server-managed revision and timestamp. Soft deletes remain represented by tombstones; the full-account cloud deletion RPC is a separate operation.
