# Repbook project status

Reviewed: 2026-11-12 (America/Los_Angeles).

State Version: 9 — GYM-004 food presets implemented and locally verified; publication pending. GYM-003 remains live.

## Current change

Task `GYM-004`, branch `codex/GYM-004-food-presets`, adds 15 source-linked presets: nine David Gold flavors, two Fairlife Nutrition Plan shakes, Chipotle chicken/steak High Protein Cups, three crispy chicken/cheese/mild-tomato tacos, and a large burrito flour tortilla. The user confirmed Gold bars and crispy corn shells. Presets fill an editable form; fractional quantities scale the original values, and saving creates an ordinary food entry on the selected date. Custom entry remains available. Invalid quantities block saving, rejected journal updates keep the dialog open, and the longer dialog scrolls on small screens.

This update uses the existing journal schema and requires no new migration. It preserves all GYM-003 code and migration 0002, the existing hosting manifest, database, photos, private audience, and notification settings. No production writes or configuration changes have occurred for GYM-004 yet.

### Already deployed behavior

Task `GYM-003`, branch `codex/GYM-003-notification-setup`, removes all speech synthesis, voice controls, and voice guidance. The automatic countdown now sits inside the matching exercise card after a new set, moves when another exercise is logged, and remains floating on other app tabs or while viewing another workout. Deadlines, reload/cross-tab coordination, push scheduling and cancellation are preserved. Editing a set does not restart rest.

The update also corrects QStash's rejected redaction header and adds a shared D1 VAPID authorization cache for Apple's token-reuse requirement. Migration `0002_vapid_token_cache.sql` adds only the cache table; it was included in the release and applied to production. The user chose push notifications without speech after confirming the direct phone test.

Previously released `GYM-002` adds rear-delt fly to new Pull sessions; editable rest defaults (150 seconds compound, 90 seconds isolation/abs); immutable new-set machine, order, and prior-muscle-work context; comparable historical sets; session deletion; and optional private completion photos. Photos include front/back muscle diagrams highlighting all primary and assisting muscles from logged exercises, plus workout and date. The main README is generalized.

Journal schema v2 migrates v1 on read without inventing historical order or modifying old routine snapshots. New writes require v2. Existing records, units (pounds), dates, and machine labels are preserved. The data API continues to serialize client saves and reject conflicting revisions. Browser recovery retains pending edits; this is not a cloud backup.

The owner supplied the EU QStash token through a masked Windows credential prompt; a read-only EU API request authenticated successfully (HTTP 200). All four runtime values were stored as secrets at environment revision 1. No secret values were written to project files or chat. No paid plan or billing was enabled by the agent; the account's billing plan was not independently inspected. See [notification setup and limits](docs/NOTIFICATIONS.md).

## Source and release

- GYM-004 starts from the GYM-003 release receipt `3820fbe0193158798a102406780bd0dfefcbd8bb`. Freshly fetched main and GYM-003 have not changed. The food branch is stacked on GYM-003 because PR #4 is still unmerged; do not deploy main or drop the notification changes. Its implementation and publication receipt will be recorded after commit/deployment. No merge is authorized.

- Canonical GitHub repository: [Jayden-Amjed/Repbook](https://github.com/Jayden-Amjed/Repbook); older Personal-Gym-App links redirect. Freshly fetched main remains `0bd13e2c69c24863102c1f1be9061eeaaca51252`. [PR #4](https://github.com/Jayden-Amjed/Repbook/pull/4) is open and unmerged; its verified implementation is `9e33f3d7374e5b726f09868d4561314a054eda9e` on the branch above. [GitHub Actions run 43356214875](https://github.com/Jayden-Amjed/Repbook/actions/runs/43356214875) succeeded for that implementation.
- Previous GYM-002 deployed source: `e4cd47edca3b0f35e4ff62b6bed842103d191693`. [PR #2](https://github.com/Jayden-Amjed/Repbook/pull/2) merged as `e7f0476677a94339639f90de0778919fe9743e6d`. [GitHub Actions run 43351764630](https://github.com/Jayden-Amjed/Repbook/actions/runs/43351764630) passed locked install, tests, TypeScript, and build.
- Private deployment `appgdep_6af674a8e8d4819183e304045cb2e9ad` succeeded at 2026-11-13T02:23:45Z (2026-11-12 local), saved version `appgprj_6af63f525dfc8191ad3be9f66bbd141d~appgver_837d2329bc988191bc5ec08c62756290`, environment revision 0. The Sites helper pushed the exact implementation source and packaged the local build before deployment. This later documentation receipt does not change app code or require redeployment.
- Post-deploy read-only database inspection confirms the original `journals` table plus `push_subscriptions`, `push_timers`, and `session_photos`. Browser navigation confirms the private sign-in gate; a fresh authenticated live-app check needs the owner's login in this browser. No production fixtures were created.
- Existing owner-private Site: `appgprj_6af63f525dfc8191ad3be9f66bbd141d`; [live app](https://jayden-repbook.lucentflair1.chatgpt.site). Audience remains owner-only.
- GYM-003 activation: redeployed the same saved version 2 / implementation `e4cd47edca3b0f35e4ff62b6bed842103d191693` with environment revision 1. Deployment `appgdep_6af67907da58819195f74b62c5f12a6f` succeeded at 2026-11-13T02:42:21Z. Credentials are configured; delivery is not inferred from deployment success.
- GYM-003 production release: Sites saved version 3 (`appgprj_6af63f525dfc8191ad3be9f66bbd141d~appgver_b3aeed8374ec8191886d3d1cffd04b33`) deployed successfully as `appgdep_6af683593db48191869c10ebbf333520` at `2026-11-13T03:26:25Z` (November 12, 7:26:25 p.m. PST). Saved source is `a562b81d3274b58272483bd1fbcda51853ce9f7a`. The Sites mirror fast-forwarded from `e4cd47edca3b0f35e4ff62b6bed842103d191693`; GitHub main was untouched and PR #4 remains open. The deployment kept the existing hosting manifest and its D1 `DB` and R2 `BUCKET` bindings.
- A read-only production inspection confirmed one cloud D1 journal (revision 27 at inspection). Journal contents and test photos were not copied into source. No synthetic production records were written.
- D1 stores the journal and photo metadata; private R2 stores original and composite JPEGs. Authenticated ownership checks guard both metadata and bytes. Deletion tombstones hide images before storage cleanup; failed cleanup can retry on later journal saves.

## Verification actually completed

GYM-004, Windows / Node 24.22.1, 2026-11-12:

- `node --experimental-strip-types --test tests/*.test.ts`: 35/35 passed. New checks cover label-preserving fractional scaling, invalid quantities, ordinary journal serialization with old entries unchanged, manual corrections, taco portions, and catalog validation.
- `node node_modules/typescript/bin/tsc --noEmit`, Sites `build-site.mjs` / `npm run build`, and `git diff --check`: passed. The final production build includes the dialog scrolling fix.
- Independent source review found no actionable quantity, date, validation, or historical-data regressions.
- Browser QA used the actual FoodForm and app CSS in an ignored loopback-only harness, with synthetic in-memory saves. Verified double servings with a manual calorie correction, half a bar, invalid quantity blocking, selected-date preservation, manual entry, and rejected-save feedback. At 390 × 844, the dialog scrolls and has no horizontal overflow. Preview/server stopped afterward. This is component QA, not an authenticated full-app persistence or physical-iPhone test. No production journal/photo records were touched.
- Official David/Fairlife product labels and Chipotle menu/ingredient nutrition were checked on this date. Sources and standard-serving assumptions are retained in the catalog and decisions.

Hosted ChatGPT Work, 2026-11-12:

- Verified Linux x86_64, `SITES_MANAGED_LINUX_CONTAINER=1`, Node 24.22.1, Codex CLI 0.167.0-alpha.4, Sites plugin 1.1.6, and runtime bundle 26.1111.10930. Sites granted source access and its helper opened the existing mirror before dependency installation or build, resolving the earlier local-client 409 for this deployment.
- Locked installation and the Sites production build passed. The helper pushed the exact GitHub branch head and packaged the Worker, migration 0002, and Drizzle metadata. Verified the archive's hosting manifest and migration contents against source. Existing Windows and GitHub Actions test evidence is recorded below.
- The read-only D1 overview showed `push_vapid_tokens` after deployment, alongside the four pre-existing tables. Access revision 1 remained owner-only with zero external visitors. Environment revision 1 retained all four notification secrets. No production journal or photo test writes and no notification sends were performed.

Publication retry, Windows / Node 24.22.1, 2026-11-12:

- Confirmed the clean local checkout and fetched GYM-003 branch exactly matched PR #4 implementation `9e33f3d7374e5b726f09868d4561314a054eda9e`; no application source changes were needed.
- Reran `node --experimental-strip-types --test tests/*.test.ts` (the `npm test` script): 31/31 passed. `node node_modules/typescript/bin/tsc --noEmit`, the installed Sites `build-site.mjs` / `npm run build`, and `git diff --check` passed. Worker build output exists at `dist/server/index.js`; migration 0002 and its Drizzle metadata remain in the source.
- Independent read-only review found no data-preservation blocker. An isolated in-memory SQLite check applied 0000/0001, inserted synthetic rows in all four existing tables, applied 0002, and confirmed every prior row remained identical with an empty new cache table. No production records were used.
- Live read-only checks confirmed saved version 2, owner-only access (access revision 1, no external visitors), and all four notification settings still marked secret at environment revision 1. The live `DB` still has `journals`, `push_subscriptions`, `push_timers`, and `session_photos`; `push_vapid_tokens` is absent, confirming 0002 has not been applied there.
- A fresh source-write credential request again returned `sites_git_client_upgrade_required` (HTTP 409): Sites Git is not enabled for this client. No source upload, deployment, production migration, environment/access change, or database/photo write occurred. The supported recovery remains a hosted Work session or an updated Codex/Sites client with Sites Git enabled. No browser or physical-phone check was rerun.

GYM-003, Windows / Node 24.22.1, 2026-11-12:

- `npm test`: 31/31 passed, including real SQLite cache/concurrency/expiry checks, signatures, encrypted push payloads, corrected provider-header assertion, deadline behavior, and service-worker notifications.
- `node node_modules/typescript/bin/tsc --noEmit`, final `build-site.mjs` / `npm run build`, and `git diff --check`: passed.
- Independent source review found no actionable regressions in inline/floating timers, voice removal, push lifecycle, or VAPID caching. No voice/speech/AirPods references remain in `app`, `lib`, or `public`.
- First live app test failed: production `/api/rest-alerts` returned 503. Direct reproduction identified QStash HTTP 400 rejecting `Upstash-Redact-Fields: body, headers`. Corrected direct requests with `body, header[Authorization]` returned 201. The owner confirmed a push arrived during the requested locked-phone/music test, without voice. This confirms direct delivery only; the automatic Log set path still requires the source fix and retest.
- Browser visual QA of the new inline UI was attempted but blocked by local mock sign-in HTTP 403. No visual pass is claimed. The synthetic local fixture was removed and the owned preview server stopped. No production journal fixtures were created.

Previously completed GYM-002 checks, isolated loopback preview, 2026-11-12; not rerun for GYM-003:

- `npm test`: 27/27 passed (migration, routines, actual order/context, comparisons, rest defaults/deadlines, service-worker behavior, push validation/encryption/provider failures).
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Final `build-site.mjs` / `npm run build`: passed; the Sites source/package helper also completed successfully for deployed source `e4cd47edca3b0f35e4ff62b6bed842103d191693`.
- `node --experimental-strip-types tests/api-smoke.mjs http://127.0.0.1:5173`: 19 checks passed, including save/reload, revision conflicts, auth/origin/input limits, and fixture cleanup.
- `node --experimental-strip-types tests/photos-smoke.mjs http://127.0.0.1:5173`: 73 checks passed, including private image access, upload bounds, stale overlay rejection/regeneration, conditional replacement/deletion, and workout/photo deletion.
- Applied and inspected local migrations `0000` and `0001`; the latter adds photo and push tables without replacing the journal table.
- Actual browser QA: gym selection does not create an accidental session; Pull/rear-delt defaults; interleaved exercise order; automatic countdown; editing without restart; expiry; finish cancellation; optional photo upload, download, and reload; desktop/narrow layout without horizontal overflow. A real supplied sample exposed the framework's default 1 MB multipart limit; after raising its envelope to the bounded 9 MB endpoint limit, the sample uploaded successfully and persisted across reload.
- Browser QA also verified that editing a workout flags an outdated photo overlay and rebuilding from its stored original saves the updated muscle map. The compact overlay was checked against the supplied sample.
- The personal photo sample and synthetic workouts stayed in ignored local storage. Local fixtures/photos were removed afterward. A composite download is retained only under ignored `outputs/`.
- Web Push encryption/signing ran in an isolated local Worker harness. GYM-002 did not attempt live provider delivery; the later GYM-003 direct delivery result is recorded above.

## Limits and next action

Next, publish the completed GYM-004 branch through the existing hosted Work chat after its explicitly authorized handoff, verifying cloud execution and Sites Git access before building there. The local desktop client's Sites Git 409 was already verified in GYM-003; a new local retry is not evidence of cloud execution. Preserve the existing Site and settings, then record the deployment result. Separately, verify inline/floating countdowns and the real Log set → Notification scheduled → locked-phone push flow on the iPhone, including replacement and cancellation. The earlier direct provider test remains separate evidence. Voice is no longer requested.

Finishing/deleting on a different device does not yet revoke a notification queued by the first device; cancellation at delivery time or after an unknown provider acknowledgement may still allow an alert. Provider acceptance does not guarantee device delivery.

Internet is required for cloud load/sync; cold-launch offline editing, import, and automatic conflict merging are not implemented. JSON exports omit image files (download photos separately). Journal saves are capped at 1.5 MB; photo uploads at 4 MB each after client resizing. Separate-real-account isolation and injected R2/D1 failures were not exercised. The owner tested direct phone push, but the corrected automatic app path remains untested. Workout suggestions compare matching machine/order/workload context; they do not measure hypothetical fatigue-free strength or prescribe overload timing.

Ordinary logging/photos/timers call no AI model and consume no inference tokens. App data/upload requests and optional notification-provider usage are ordinary network APIs with their own hosting/service limits.
