# Repbook project status

Reviewed: 2026-11-12 (America/Los_Angeles).

State Version: 6 — push-only inline timer and notification fixes prepared; direct phone push confirmed, new source publication blocked.

## Current change

Task `GYM-003`, branch `codex/GYM-003-notification-setup`, removes all speech synthesis, voice controls, and voice guidance. The automatic countdown now sits inside the matching exercise card after a new set, moves when another exercise is logged, and remains floating on other app tabs or while viewing another workout. Deadlines, reload/cross-tab coordination, push scheduling and cancellation are preserved. Editing a set does not restart rest.

The candidate also corrects QStash's rejected redaction header and adds a shared D1 VAPID authorization cache for Apple's token-reuse requirement. Migration `0002_vapid_token_cache.sql` adds only the cache table; it must accompany this source. The user chose push notifications without speech after confirming the direct phone test. New source has not been published.

Previously released `GYM-002` adds rear-delt fly to new Pull sessions; editable rest defaults (150 seconds compound, 90 seconds isolation/abs); immutable new-set machine, order, and prior-muscle-work context; comparable historical sets; session deletion; and optional private completion photos. Photos include front/back muscle diagrams highlighting all primary and assisting muscles from logged exercises, plus workout and date. The main README is generalized.

Journal schema v2 migrates v1 on read without inventing historical order or modifying old routine snapshots. New writes require v2. Existing records, units (pounds), dates, and machine labels are preserved. The data API continues to serialize client saves and reject conflicting revisions. Browser recovery retains pending edits; this is not a cloud backup.

The owner supplied the EU QStash token through a masked Windows credential prompt; a read-only EU API request authenticated successfully (HTTP 200). All four runtime values were stored as secrets at environment revision 1. No secret values were written to project files or chat. No paid plan or billing was enabled by the agent; the account's billing plan was not independently inspected. See [notification setup and limits](docs/NOTIFICATIONS.md).

## Source and release

- Canonical GitHub repository: [Jayden-Amjed/Repbook](https://github.com/Jayden-Amjed/Repbook); older Personal-Gym-App links redirect. Freshly fetched main is `0bd13e2c69c24863102c1f1be9061eeaaca51252` before GYM-003 finalization. GYM-003 remains a source candidate on the branch above.
- Implementation/deployed source: `e4cd47edca3b0f35e4ff62b6bed842103d191693`. [PR #2](https://github.com/Jayden-Amjed/Repbook/pull/2) merged as `e7f0476677a94339639f90de0778919fe9743e6d`. [GitHub Actions run 43351764630](https://github.com/Jayden-Amjed/Repbook/actions/runs/43351764630) passed locked install, tests, TypeScript, and build.
- Private deployment `appgdep_6af674a8e8d4819183e304045cb2e9ad` succeeded at 2026-11-13T02:23:45Z (2026-11-12 local), saved version `appgprj_6af63f525dfc8191ad3be9f66bbd141d~appgver_837d2329bc988191bc5ec08c62756290`, environment revision 0. The Sites helper pushed the exact implementation source and packaged the local build before deployment. This later documentation receipt does not change app code or require redeployment.
- Post-deploy read-only database inspection confirms the original `journals` table plus `push_subscriptions`, `push_timers`, and `session_photos`. Browser navigation confirms the private sign-in gate; a fresh authenticated live-app check needs the owner's login in this browser. No production fixtures were created.
- Existing owner-private Site: `appgprj_6af63f525dfc8191ad3be9f66bbd141d`; [live app](https://jayden-repbook.lucentflair1.chatgpt.site). Audience remains owner-only.
- GYM-003 activation: redeployed the same saved version 2 / implementation `e4cd47edca3b0f35e4ff62b6bed842103d191693` with environment revision 1. Deployment `appgdep_6af67907da58819195f74b62c5f12a6f` succeeded at 2026-11-13T02:42:21Z. Credentials are configured; delivery is not inferred from deployment success.
- Source-publication blocker: `create_source_repository_write_credential` returned `sites_git_client_upgrade_required` (409), requiring a hosted Work session or a supported updated Codex/Sites client. The earlier source credential is expired. New application source has not been uploaded or deployed. The live app still has the voice UI, separate timer card, rejected redaction header, and per-set VAPID signing. This is a client/backend compatibility error, not an approval rejection.
- A read-only production inspection confirmed one cloud D1 journal (revision 27 at inspection). Journal contents and test photos were not copied into source. No synthetic production records were written.
- D1 stores the journal and photo metadata; private R2 stores original and composite JPEGs. Authenticated ownership checks guard both metadata and bytes. Deletion tombstones hide images before storage cleanup; failed cleanup can retry on later journal saves.

## Verification actually completed

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

Next, publish the GYM-003 source and migration using a supported Sites client, preserving the existing private Site, audience, database, bucket, and environment revision. Credentials are already configured; do not collect them again. Then verify inline/floating countdowns and the real Log set → Notification scheduled → locked-phone push flow, including replacement/cancellation. Do not infer automatic scheduling success from the direct provider test. Voice is no longer requested.

Finishing/deleting on a different device does not yet revoke a notification queued by the first device; cancellation at delivery time or after an unknown provider acknowledgement may still allow an alert. Provider acceptance does not guarantee device delivery.

Internet is required for cloud load/sync; cold-launch offline editing, import, and automatic conflict merging are not implemented. JSON exports omit image files (download photos separately). Journal saves are capped at 1.5 MB; photo uploads at 4 MB each after client resizing. Separate-real-account isolation and injected R2/D1 failures were not exercised. The owner tested direct phone push, but the corrected automatic app path remains untested. Workout suggestions compare matching machine/order/workload context; they do not measure hypothetical fatigue-free strength or prescribe overload timing.

Ordinary logging/photos/timers call no AI model and consume no inference tokens. App data/upload requests and optional notification-provider usage are ordinary network APIs with their own hosting/service limits.
