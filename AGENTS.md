# instapaper-opds

Instapaper → OPDS server for the Xteink X4 (CrossPoint firmware). Deployed on Firebase App Hosting, project `instapaper-opds`; pushes to `main` trigger builds.

## Rules

- **Never `git push` without explicit confirmation** — even as a step inside a larger task. Local commits are fine.
- Commit identity: `hatboysam <hatboysam@gmail.com>` (repo-local git config, already set).

## Environment

- Node 24: `export PATH="$HOME/.nvm/versions/node/v24.20.0/bin:$PATH"` (see `.nvmrc`; the default shell Node is v12 and too old).
- Secrets in `.env.local` (never commit). Never print secret values to chat or logs.

## Verify changes

```sh
npm run typecheck   # tsc --noEmit
npm run smoke       # offline pipeline test
npm run build       # next build
```

Deploy = push to `main` (only with the user's explicit go-ahead).
