# instapaper-opds

Serves an Instapaper account as an **OPDS catalog**: your Xteink X4 (CrossPoint firmware) browses Unread / Starred / Archive and downloads articles as EPUBs directly over WiFi. No phone or cable involved.

## Using it

1. **Create an account** at `/signup` — pick any username + password, enter the invite code, and your Instapaper email/password (used once to obtain an API token; not stored).
2. **On the X4:** `Settings → System → OPDS Servers → Add Server`
   - URL: `https://instaopds.com/opds` (or `https://instapaper-opds--instapaper-opds.us-central1.hosted.app/opds`)
   - Username / password: the account from step 1
3. **Open the catalog** from the device home screen. Articles are newest-first; download any and it appears in the book picker.

Notes: articles are EPUB 3, images stripped (e-ink friendly). Re-downloading an article is always safe. If an article's full text can't be fetched, you get a stub EPUB with the original link.

## Developing

Requirements: Node 24 (`nvm install` picks it up via `.nvmrc`).

```sh
npm ci
cp .env.example .env.local   # fill in Instapaper consumer key/secret
openssl rand -hex 32         # use as TOKEN_ENCRYPTION_KEY
npm run smoke                # offline pipeline test
npm run dev                  # local server at :3000
```

Local testing without Firebase works while `FIREBASE_PROJECT_ID` is empty: set `INSTAPAPER_TOKEN` / `INSTAPAPER_TOKEN_SECRET` (get them via `npm run login`) and `DEV_BASIC_PASSWORD`, then auth with any username + that password.

### Deploy

Deployed on Firebase App Hosting, project `instapaper-opds`. Pushes to `main` trigger a build.

Secrets live in Secret Manager (`firebase apphosting:secrets:set`), referenced from `apphosting.yaml`: `instapaper-consumer-key`, `instapaper-consumer-secret`, `token-encryption-key`, `signup-code`.

Per-user Instapaper tokens are stored encrypted (AES-256-GCM) in Firestore, collection `users` — that's the only database.

### Layout

- `src/core/` — isomorphic: Readability extraction, EPUB building (`epub-gen-memory`), OPDS feed XML
- `src/server/` — Instapaper OAuth 1.0a + xAuth client, Firestore user store, Basic auth, catalog pipeline
- `app/` — Next.js routes: `/opds`, `/opds/{folder}`, `/opds/book/…`, `/signup`
- `scripts/` — `login.ts` (xAuth CLI), `smoke.ts` (pipeline test)
