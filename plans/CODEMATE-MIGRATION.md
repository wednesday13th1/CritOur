# CodeMate local MVP — migration / rollout proposal

Status: LOCAL ONLY, production migration, grants, external-service configuration and deployment are NOT authorized or performed. `CODEMATE_ENABLED` is disabled by default. No GitHub connection, native app, Simulator build, code editor or AI generation is implemented.

## Before a future rollout

1. Obtain explicit approval for the exact production migration, CMS administrator mapping, CodeMate enablement and deployment. Review active accounts without exporting secrets or message content.
2. Export/backup D1 and confirm restore procedures; preserve R2 content. Record existing CMS rows, accounts/session versions, Studio membership, messages and tasks.
3. Review `plans/codemate-mvp.sql`. It is intentionally outside automatic Drizzle migration discovery. It only creates `cm_*` tables; there are no updates/deletes/renames of legacy data. Existing project members remain creators; new tester grants do not enroll users into legacy Studio membership.
4. Populate `cm_site_admins` ONLY from the approved existing CMS administrator mapping. No grant is inferred from display names or newly accepted CodeMate invites. Do not enable the flag with an unreviewed or empty CMS grant mapping.
5. Set `CODEMATE_ENABLED=true` only after migration and grants pass validation. When false, old CMS authorization and Studio remain unchanged; when true, CMS routes check the explicit CMS grants. New project-scoped tester access does not grant CMS access.
6. Verify site pages unchanged, authenticated CMS access, CodeMate/tester access, nonmember/expired/revoked rejection, private images, invite races, task conversion retries and retest author checks. Review archived project behavior.

## Rollback

Disable the flag and revert the application version to restore original behavior; leave the additive tables and new R2 files intact. Do not blindly restore an older DB after new feedback/tasks have been created. Export/preserve the new records and decide reconciliation before any restore. A schema rollback or table deletion requires separate approval. Do not issue tester accounts under the legacy all-accounts-have-CMS policy if rolling back; suspend new tester enrollment and review access before reverting to that policy.

## Local validation

Local-only fixtures apply the draft SQL to the local Miniflare D1 DB. `CODEMATE_LOCAL_PREVIEW=1` enables the local feature and isolated persistence only in the Vite dev server; disposable fixture users and CMS grants are test-only. `plans/codemate-mvp.sql` is not a deployment migration. Production flags, OAuth configuration and credentials remain untouched.

## MVP scope / limits

Four navigation entries: Home, Projects, Playground, Chat. Existing project chat components and tasks are reused. Testers use Playground feedback/replies; legacy project chat is for creators. Invitations require an already approved login account, expire in seven days and can be consumed once; public account registration is not included. The existing account/public-profile relationship is not migrated.

Web previews use a fixed public-host allowlist, HTTPS, no query/userinfo/custom port and an opaque-origin sandbox; no URL proxy or server fetch is implemented. Some websites/login flows will not work inside the sandbox; the external link is always available. Registered versions are immutable metadata records, but a mutable URL is not a historical deployment guarantee. PNG/JPEG/WebP screenshots are uploaded by the user, kept private, and never fabricated. Native iOS execution and video capture remain unimplemented and labeled accordingly.

GitHub integration and verified Commit bindings are deferred pending external-service approval. Creators can optionally attach a manually entered GitHub commit URL to a version associated with a task; this does not fetch or verify the repository, and the link is hidden from testers. The primary feedback loop functions without GitHub. Pin annotations, screen recording and automatic screenshots are not implemented. Current bounded views return the latest 100 builds/100 events, at most 200 tasks/500 feedback/replies; UI states these limits. Counters use all project tasks. Historical records remain stored. Feedback/task/preview facts are user-authored, not inferred from code.

## Reproduce the local preview

From `motto-release`, with the project's patched Node.js 22.23.4 (or a supported patched line):

```sh
CODEMATE_LOCAL_PREVIEW=1 node scripts/run-framework.mjs dev --host 127.0.0.1 --port 5181 --strictPort
```

In a second terminal, run `python3 tests/codemate-mvp.py`. It initializes only the isolated state under `.sites-runtime/codemate-local-state`, applies the draft to that local database, and adds disposable QA accounts/projects. The final JSON line identifies the fixture, local-only account labels and the fixture login code. Open `http://127.0.0.1:5181/codemate/login`, sign in as the fixture user, then select the login-screen QA project. The supplied QA images only check private image handling, and the demo preview is a real public MDN example, not a project build. No fixture data is loaded by the application automatically.

## Verification performed

- 71 CodeMate local HTTP/D1/R2 assertions, including invitation consumption, reauthorization boundaries, private media, cross-project access, concurrent task conversion, both version records and original tester retest response.
- 22 existing unit tests, TypeScript and local Sites build.
- Browser verified Home → Playground, real sandboxed iframe load, three feedback options, Feedback Journey and Before/After. At 390 and 1280 px the document width matched the viewport, with four navigation items.
- Built Worker smoke test with CodeMate disabled: public home, existing code login, Admin dashboard/API, Studio projects, legacy chat and calendar all work; CodeMate page/API return 404. All 10 checks used only local bindings.
