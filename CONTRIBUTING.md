# Contributing

Use Node 22 (`.nvmrc`) and Python 3.11+. Create a branch per issue using the
`codex/` prefix, or a short descriptive branch name agreed by the team. Open a PR
with the behavior change, validation and `Closes #N` for fully completed issues.
For a partial issue, use `Refs #N` and list what remains. Squash merge after review
and passing CI. Keep private keys, user messages and credentials out of logs and commits;
the committed reference keys are public **test fixtures**, never user keys.

From `frontend`, run `npm ci`, `npm run lint`, `npm run format:check`,
`npm run typecheck`, `npm test`, `npm run build`, and `npm run test:browser`
(install Chromium once with `npx playwright install chromium`). Use `npm run format`
to apply formatting. From the repository root, run `python -m pytest -q` and
`python -m reference.generate_vectors --check` in the project virtual environment.

Do not gate work on whole milestones. Start scaffolding and tests early; use each
issue's actual completion dependencies. Preserve the old Python/API workflows
until browser replacements are accepted in #45.

The intended main-branch policy is one approving reviewer, passing `Frontend checks`
and `Python reference and API checks`, no force pushes or direct pushes, and squash
merges. GitHub currently returns HTTP 403 for branch protection on this private
repository's plan. An owner must enable a plan supporting private-repository
protection before these rules can be enforced. Until then use PRs and reviews by
team agreement; CI alone cannot prevent direct pushes.

The frontend pins a patched minimatch 11 override for the TypeScript ESLint
dependency tree (GHSA-g3hv-75wg-m249). Revisit the override when the upstream parser
requires a patched minimatch itself; lint and browser/build checks cover this setup.
