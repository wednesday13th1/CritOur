# CritOur — Build alone. Grow together.

Make collaborative programming accessible to everyone.

CritOur connects one small contribution to an owner-reviewed improvement:
**Discover → Help → Build Together → See Your Impact.**

This checkout contains local implementation and verification, not a production rollout. Existing accounts, credentials, projects, CMS content and stored files are retained. No OAuth app was registered, no production database was migrated, and nothing was deployed or submitted to a contest.

## Current application

- Four main entries: Home / Explore / Create / Profile.
- Public Build Cards and `/explore` show only owner-confirmed public listings. Signing in is required to submit, not to understand a task.
- Test / Idea / Design / Code requests include time, difficulty, skills and concrete steps. “In progress” means work has been submitted and is being reviewed; an open request can still accept other contributors. Joining the team is a separate invitation flow.
- Submitted → Reviewed → Adopted → Implemented, with immutable review history and optimistic concurrency checks. Only the project owner can review/adopt/record implementation. An improvement description is required; an image is not.
- Approved contributions and implemented improvements appear in the contributor’s portfolio. Mere membership and pending submissions do not become achievements.
- Build Cards and owner-confirmed Impact Cards have share URLs and real PNG Open Graph images. Contributor credit is anonymous unless the contributor chooses a public alias.
- Existing showcase feedback can be linked to a review without copying away or deleting its source. Historical feedback is excluded from public Impact Cards to avoid expanding its original audience.
- Replies, reviews, adoption, implementation, project updates and new tasks have deduplicated in-app notifications and read state.
- CritDay/discovery prioritizes beginner work and projects with fewer responses. Feedback remains open every day.

With `CODEMATE_ENABLED=true`, `/` is the CritOur landing page. `/critour` is an explicit landing entry and `/explore` is public discovery. The original CMS homepage is preserved at `/team`; with the product flag off, the original root homepage remains in place. Existing `/codemate`, `/studio`, `/admin`, project and news routes remain available under their existing authorization rules.

## Stack and an important deployment limitation

The source uses Next-style App Router components, but the **current executable build is Vinext/Vite for Cloudflare Workers**, with D1 and R2 bindings accessed through `cloudflare:workers`. The default `start` script starts a **local Wrangler runtime**; it is not a generic Node production server.

A successful `npm run build` verifies the current Worker artifact. It does **not** prove Deploy Now compatibility. The [official Deploy Now Next.js guide](https://deploy.lolipop.jp/docs/frameworks/nextjs) requires `.next/standalone` and `output: 'standalone'`. Merely changing `next.config.ts` would not make D1/R2 bindings work in Node.

Before publishing there, choose and validate a Node deployment adapter and a persistent storage connection. The least disruptive candidate is to retain existing D1/R2 and expose a narrowly authenticated server-to-server bridge that preserves D1 batch transaction semantics. A standard Next standalone build would then use that adapter. This is a proposal, not an implemented or deployed bridge. Moving to another database is a larger migration and requires a separately reviewed backup, reconciliation and rollback plan.

Do not point the existing local `start` command at Deploy Now, copy a local SQLite database into an ephemeral runtime, or treat a static export as this server-backed application.

## Local development and verification

Use a Node release matching `package.json` (`22.23.4` is the verified version). The pnpm version is pinned and `pnpm-lock.yaml` remains the dependency authority.

```sh
corepack pnpm install --frozen-lockfile
npm run typecheck
npm test
npm run build
```

`npm run install:ci` also selects the existing pnpm lockfile. It no longer sends npm-only arguments to pnpm.

Start an isolated preview:

```sh
CODEMATE_LOCAL_PREVIEW=1 npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
```

In another terminal:

```sh
npm run test:flow
```

The HTTP suite initializes only `.sites-runtime/codemate-local-state`, applies the local additive drafts, and creates clearly named disposable QA accounts/projects. It exercises actual API handlers, local D1 persistence and R2 media access. It prints local-only sign-in information. Never copy these fixtures or their sign-in codes into production. The one-pixel fixture image tests access control, not product design or evidence of a real project improvement.

The OAuth tests run the real account/session/callback logic and SQL against an in-memory SQLite database with test provider responses and signed test JWTs. They include a Google-owner/GitHub-contributor integration flow with independent sessions. **They do not constitute a live Google/GitHub integration test.**

## Environment variables and OAuth callbacks

All secrets are server-side. Never use a `NEXT_PUBLIC_` prefix for these credentials.

| Name | Purpose |
| --- | --- |
| `CODEMATE_ENABLED` | Existing product flag. Public cards and new product routes require `true`. |
| `CRITOUR_OAUTH_ENABLED` | New OAuth registration/linking flag. Keep disabled until schema, grants and live provider tests are approved and verified. |
| `AUTH_BASE_URL` | Exact canonical HTTPS origin, e.g. `https://your-app.lolipop-now.app`; no path, query or fragment. |
| `PUBLIC_BASE_URL` | Canonical public HTTPS origin for OG URLs; falls back to `AUTH_BASE_URL`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google web application OAuth client. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub identity-only OAuth application. |
| `DB` / `BUCKET` | Current Cloudflare D1 / R2 bindings, not ordinary string URLs. |

Register these exact new callback paths on the approved canonical origin:

```text
https://YOUR_ORIGIN/api/auth/oauth/google/callback
https://YOUR_ORIGIN/api/auth/oauth/github/callback
```

The original `/api/auth/google/callback` route is retained for existing administrator/reauthentication flows. Do not remove its registered callback during migration.

### Google

Use a web application client with `openid email profile`. The new flow checks the ID token with the existing `jose` library: signature, RS256, issuer, audience, required expiry/issued-at claims, nonce, verified email and immutable `sub`. General verified Google accounts are supported by the new flow; the original Gmail allowlist behavior is unchanged on the old routes.

### GitHub

Use an identity-only OAuth application. The requested scope is empty: no `repo`, private repository, `user:email` or code access. PKCE S256 and browser-bound state are used. The server reads only `https://api.github.com/user` and stores GitHub’s numeric immutable ID. A public email is unnecessary. Tokens with unexpected inherited scopes are rejected; use a dedicated identity-only application rather than reusing a repository integration.

Provider access/refresh tokens are not stored or sent to the browser. Profile image import is intentionally optional and is not automatically fetched. Users can edit their display name and bio in Profile.

### Existing users and account linking

1. Sign in with the existing code or existing Google method first.
2. Open Profile → Account & sign-in.
3. Within five minutes of sign-in, explicitly select the provider to connect.
4. Authenticate with the provider, then review the returned provider account and confirm the connection in CritOur.

A pending link is bound to the original account and still-valid session. The final confirmation checks the same session, same origin, expiration and uniqueness again. Matching email addresses never merge accounts. A provider identity already linked elsewhere cannot be moved. An exact existing Google `sub` can reuse its original account; existing IDs and work remain unchanged.

Sessions use HttpOnly/Secure/SameSite=Strict cookies and server-side hashed tokens, version and expiry checks. OAuth state cookies use SameSite=Lax for provider callbacks. Flows expire after ten minutes, pending links after five, application sessions after twelve hours. Login regenerates the session; logout invalidates the current server session and pending browser flows. Legacy credentials stay until a separately approved, verified migration can retire them without lockout.

Google Cloud/GitHub app registration, consent settings, terms acceptance, secret entry, paid services and deployment require the owner’s approval and have not been performed.

## Data protection and migration drafts

No application startup applies production migrations.

Existing `drizzle/` migrations and the older `plans/codemate-mvp.sql`, `show-and-grow.sql`, `our-canvas.sql`, `virtual-playground.sql` remain intact. The new drafts are:

- `plans/critour-gallery.sql`: additive gallery tags and crop position. Apply after the Showcase schema. Existing works default to a centered crop.
- `plans/critour-showcase.sql`: additive Showcase media table. Apply after `plans/show-and-grow.sql` and before serving the updated app. Legacy listings keep their existing build cover and demo URL. Existing visibility and contribution records are unchanged.
- `plans/critour-collaboration.sql`: requests, submissions, history, notifications, public consent, optional analytics, source feedback links and request skills.
- `plans/critour-oauth.sql`: provider identities, short-lived flows and pending confirmations.

The new drafts are additive `CREATE TABLE/INDEX IF NOT EXISTS`. Do not blindly rerun the older non-idempotent drafts against an existing database. Before production: inspect actual schema/migration history, back up D1 and R2, confirm restoration, explicitly map existing CMS administrators, and rehearse on a copy. No account/member becomes public or gains CMS access through signup. Once the explicit `cm_site_admins` table exists, disabling the product flag no longer restores the legacy “all active workspace users can enter CMS” fallback.

Rollback must retain newly created accounts, identities, feedback, approvals and files. Disabling new OAuth leaves legacy methods in place, but users who enrolled exclusively through OAuth still need their provider route supported; do not deploy an older version that cannot recognize their accounts.

## Sharing and analytics privacy

Publishing a Build Card requires an owner confirmation covering its curated listing, screenshot, preview and open tasks. Disabling publication revokes anonymous access to the page, image, Impact Cards and OG endpoints. No internal team messages, membership list, credentials or private task bodies are included.

The owner must separately confirm publication of an implemented Impact Card. Credit defaults to “A CritOur collaborator”; the contributor can opt into or revoke an alias immediately. An implemented status is an owner-authored record of a change, **not automatic verification that external project code was modified**. A real demonstration must use a genuinely made improvement and an honest description/evidence.

Analytics is optional and uses a random expiring browser ID. The analytics table stores only allowlisted events, publication IDs, direct/share source and time; no IP, email, account ID, user agent, arbitrary URL or contribution text. Server acceptance/submission events are tied to successful database writes. Client requests cannot manufacture accepted contributions. The 90-day reporting window excludes older events; old rows are removed on the next analytics write. Small browser cohorts are suppressed. D7 and D30 use mature cohorts and one-day return windows; these are opt-in browser metrics, not cross-device user identity or proof of product retention.

## Verification status and remaining gates

Type checking, unit/provider-mocked integration, local two-user HTTP/D1/R2 flow and current Worker build are verified in the implementation report. Browser checks cover anonymous cards, draft restoration after legacy sign-in, narrow mobile layouts, keyboard submission, copy feedback and connection failure/retry. New feature files have zero lint errors; inherited repository-wide lint debt is reported separately.

Before a production launch, complete:

- Real Google and GitHub authorization on the final HTTPS origin, including cancellation, linking, expiry and two independent browsers.
- Approved production migrations, explicit CMS grants, backup/restore rehearsal and persistent storage verification.
- The Deploy Now Node/runtime/storage adapter and standalone build/start smoke tests.
- Formal accessibility/security/load review, broader device testing and stronger image decoding/metadata controls.
- At least one genuinely completed collaboration with consenting users; QA fixture descriptions are not real-world proof.
- An external SNS preview check after an approved public deployment.

## Contest and 60-second demonstration

See `plans/CRITOUR-DEMO.md` for the honest demo script and release gates. As checked on 2026-11-07, the [official contest page](https://wordpress.lolipop.jp/deploy-now/contest/) lists the deadline as **2026-12-08 23:59**, requires a Deploy Now public URL submitted through its form, limits applicants to residents of Japan, and requires guardian consent for minors. SNS posting alone is not entry. Keep the app public through judging and avoid changes after the deadline as directed by the official rules. No contest entry or terms acceptance has been made by this task.

Official authentication references: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [GitHub OAuth web flow and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
