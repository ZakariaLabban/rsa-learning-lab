# Vercel deployment

Project: `rsa-learning-lab`, framework Vite, root directory `frontend`,
Node 22, install `npm ci`, build `npm run build`, output `dist`.
`frontend/vercel.json` defines SPA fallback, asset caching and security headers.
The deployment needs no environment variables for guest cryptographic features.

Key generation, encryption/decryption, private reveal and existing experiments
run locally in browser workers. No Python API is required for deployment. Python
is retained for independent reference checks and the legacy launcher until #45.

Use preview deployments for PR acceptance, including real workers, direct/deep
links, reload, both themes, mobile sizes, cancellation, wrong-key errors and
1024/2048-bit message recovery. Verify the production domain without Vercel
authentication; previews may retain Vercel authentication protection. Hosted
checks must include CSP response headers, not just local Vite preview.

The default Vercel URL is sufficient for this issue. A custom domain is #41.
GitHub main requires a teammate's approving review and passing CI before merge.
Keep that protection enabled; review deployments can be built from the feature
branch while its PR waits for approval.

No analytics, storage product, domain purchase or paid build upgrade is required
for this static deployment. Future Supabase work must explicitly extend CSP
connect-src and configure preview/production auth redirect URLs.
