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
6. In **Authentication → URL Configuration**, set the Site URL to the canonical deployment origin. Allow the exact callback URLs, including `http://127.0.0.1:5173/account` and `https://<approved-vercel-host>/account`. Register `localhost` separately if used. Add domains for approved previews individually and add the custom domain after #41.

The `delete_my_data()` RPC deletes the caller's cloud rows and disables sync on their profile. It does not delete the Supabase Auth account or email address. The deletion marker blocks cloud writes. Issue #22 needs a dedicated, explicit reactivation flow and fresh upload consent. The existing profile switch cannot override the marker.

The project-creation option **Enable RLS on new tables automatically** is not required: this migration explicitly enables RLS on every app table. If that option was enabled, the migration revokes direct `EXECUTE` from browser roles on Supabase's `rls_auto_enable()` event-trigger function while leaving the event trigger itself intact.

## Optional authentication and privacy

- Supply the same public Supabase settings in each approved Vercel environment. Keep the Supabase origin in `frontend/vercel.json` aligned with the selected project. Use your project’s SMTP settings for external recipients and test expired and successful magic links at each approved origin. The app uses PKCE. Open links in the same browser profile and origin that requested them, and keep the standard Supabase confirmation URL in the email template.
- To enable GitHub sign-in, register an OAuth app with GitHub, enter the provider credentials in Supabase Authentication, and use the callback URL supplied by Supabase. Set `VITE_SUPABASE_GITHUB_ENABLED=true` for the relevant frontend deployments.
- Set `VITE_PRIVACY_CONTACT_EMAIL` to a private, monitored administrator mailbox. Verify the mailbox works before enabling the link on a public deployment. Verify the account owner through control of the sign-in address before using Supabase’s administrator tools to remove the Auth user. Review the application's cascade behavior and the provider’s retention practices before processing requests.
- During initial session recovery, users can explicitly continue as guests in that tab and recheck their account from the Account page. Signing in does not migrate guest data. The guest import UI previews counts only. Issue #22 must revalidate the confirmed public payload at submission time, bind it to the current authenticated account, verify that cloud writes are allowed, and use the database constraints as a second boundary. Client-side storage partitioning does not isolate people who share access to browser developer tools or the same browser profile.

From `frontend`, run the mocked account browser tests with disposable credentials:

```sh
VITE_SUPABASE_URL=https://rsa-lab-account-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=mock-publishable-key VITE_PRIVACY_CONTACT_EMAIL=privacy@example.test npm run build
RSA_MOCK_AUTH=1 npm run test:browser -- account.spec.ts
```

Before promoting an authenticated deployment, use two disposable accounts to check
magic links, reload and expiration, tab-to-tab sign-out, account switching, local
data clearing and successful cloud deletion. Confirm that guest tools reopen offline
after an online visit. Check that deleting cloud data disables writes and removes
share links while leaving the login and local data available.

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
