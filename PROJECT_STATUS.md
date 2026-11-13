# Repbook project status

Reviewed: 2026-11-12 (America/Los_Angeles).

State Version: 5 — session-feedback update merged and deployed, based on accepted version 4 at `33644b88322910c8ae23285da80b45fb5d8f3b95`.

## Current change

Task `GYM-002`, branch `codex/GYM-002-session-feedback`, adds rear-delt fly to new Pull sessions; automatic editable rest defaults (150 seconds compound, 90 seconds isolation/abs); immutable new-set machine, order, and prior-muscle-work context; comparable historical sets; session deletion; and optional private completion photos. Photos include front/back muscle diagrams highlighting all primary and assisting muscles from logged exercises, plus workout and date. The main README is generalized.

Journal schema v2 migrates v1 on read without inventing historical order or modifying old routine snapshots. New writes require v2. Existing records, units (pounds), dates, and machine labels are preserved. The data API continues to serialize client saves and reject conflicting revisions. Browser recovery retains pending edits; this is not a cloud backup.

The local rest timer starts only for a new logged set, survives reload by deadline, and can use an available on-device voice while Repbook is visible. Editing a set does not restart rest. The Web Push/QStash implementation is present but **disabled until configured**: production environment revision 0 has no entries. No scheduler account or billing was enabled. See [notification setup and limits](docs/NOTIFICATIONS.md). Locked iPhone/music/AirPods delivery remains untested.

## Source and release

- Canonical GitHub repository: [Jayden-Amjed/Repbook](https://github.com/Jayden-Amjed/Repbook); older Personal-Gym-App links redirect. The fetched main remained at `33644b88322910c8ae23285da80b45fb5d8f3b95` before finalization.
- Implementation/deployed source: `e4cd47edca3b0f35e4ff62b6bed842103d191693`. [PR #2](https://github.com/Jayden-Amjed/Repbook/pull/2) merged as `e7f0476677a94339639f90de0778919fe9743e6d`. [GitHub Actions run 43351764630](https://github.com/Jayden-Amjed/Repbook/actions/runs/43351764630) passed locked install, tests, TypeScript, and build.
- Private deployment `appgdep_6af674a8e8d4819183e304045cb2e9ad` succeeded at 2026-11-13T02:23:45Z (2026-11-12 local), saved version `appgprj_6af63f525dfc8191ad3be9f66bbd141d~appgver_837d2329bc988191bc5ec08c62756290`, environment revision 0. The Sites helper pushed the exact implementation source and packaged the local build before deployment. This later documentation receipt does not change app code or require redeployment.
- Post-deploy read-only database inspection confirms the original `journals` table plus `push_subscriptions`, `push_timers`, and `session_photos`. Browser navigation confirms the private sign-in gate; a fresh authenticated live-app check needs the owner's login in this browser. No production fixtures were created.
- Existing owner-private Site: `appgprj_6af63f525dfc8191ad3be9f66bbd141d`; [live app](https://jayden-repbook.lucentflair1.chatgpt.site). Audience remains owner-only.
- A read-only production inspection confirmed one cloud D1 journal (revision 27 at inspection). Journal contents and test photos were not copied into source. No synthetic production records were written.
- D1 stores the journal and photo metadata; private R2 stores original and composite JPEGs. Authenticated ownership checks guard both metadata and bytes. Deletion tombstones hide images before storage cleanup; failed cleanup can retry on later journal saves.

## Verification actually completed

Windows / Node 24.22.1, isolated loopback preview, 2026-11-12:

- `npm test`: 27/27 passed (migration, routines, actual order/context, comparisons, rest defaults/deadlines, service-worker behavior, push validation/encryption/provider failures).
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Final `build-site.mjs` / `npm run build`: passed; the Sites source/package helper also completed successfully for deployed source `e4cd47edca3b0f35e4ff62b6bed842103d191693`.
- `node --experimental-strip-types tests/api-smoke.mjs http://127.0.0.1:5173`: 19 checks passed, including save/reload, revision conflicts, auth/origin/input limits, and fixture cleanup.
- `node --experimental-strip-types tests/photos-smoke.mjs http://127.0.0.1:5173`: 73 checks passed, including private image access, upload bounds, stale overlay rejection/regeneration, conditional replacement/deletion, and workout/photo deletion.
- Applied and inspected local migrations `0000` and `0001`; the latter adds photo and push tables without replacing the journal table.
- Actual browser QA: gym selection does not create an accidental session; Pull/rear-delt defaults; interleaved exercise order; automatic countdown; editing without restart; expiry; finish cancellation; optional photo upload, download, and reload; desktop/narrow layout without horizontal overflow. A real supplied sample exposed the framework's default 1 MB multipart limit; after raising its envelope to the bounded 9 MB endpoint limit, the sample uploaded successfully and persisted across reload.
- Browser QA also verified that editing a workout flags an outdated photo overlay and rebuilding from its stored original saves the updated muscle map. The compact overlay was checked against the supplied sample.
- The personal photo sample and synthetic workouts stayed in ignored local storage. Local fixtures/photos were removed afterward. A composite download is retained only under ignored `outputs/`.
- Web Push encryption/signing ran in an isolated local Worker harness. No live QStash/provider delivery was attempted.

## Limits and next action

Next, connect the owner's free scheduler account through secret runtime settings and perform the physical iPhone/AirPods test. Web Push acceptance cannot guarantee delivery or Siri speech. Finishing/deleting on a different device does not yet revoke a notification queued by the first device; cancellation at delivery time or after an unknown provider acknowledgement may still allow an alert. These limits must be resolved or accepted before promising that behavior. State Version remains 5 for this single accepted update.

Internet is required for cloud load/sync; cold-launch offline editing, import, and automatic conflict merging are not implemented. JSON exports omit image files (download photos separately). Journal saves are capped at 1.5 MB; photo uploads at 4 MB each after client resizing. Separate-real-account isolation, injected R2/D1 failures, physical iPhone installation, notification delivery, and AirPods audio were not exercised. Workout suggestions compare matching machine/order/workload context; they do not measure hypothetical fatigue-free strength or prescribe overload timing.

Ordinary logging/photos/timers call no AI model and consume no inference tokens. App data/upload requests and optional notification-provider usage are ordinary network APIs with their own hosting/service limits.
