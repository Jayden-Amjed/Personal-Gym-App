# Repbook project status

Reviewed: 2026-11-12 (America/Los_Angeles).

State Version: 5 — candidate session-feedback update, based on accepted version 4 at `33644b88322910c8ae23285da80b45fb5d8f3b95`.

## Current change

Task `GYM-002`, branch `codex/GYM-002-session-feedback`, adds rear-delt fly to new Pull sessions; automatic editable rest defaults (150 seconds compound, 90 seconds isolation/abs); immutable new-set machine, order, and prior-muscle-work context; comparable historical sets; session deletion; and optional private completion photos. Photos include front/back muscle diagrams highlighting all primary and assisting muscles from logged exercises, plus workout and date. The main README is generalized.

Journal schema v2 migrates v1 on read without inventing historical order or modifying old routine snapshots. New writes require v2. Existing records, units (pounds), dates, and machine labels are preserved. The data API continues to serialize client saves and reject conflicting revisions. Browser recovery retains pending edits; this is not a cloud backup.

The local rest timer starts only for a new logged set, survives reload by deadline, and can use an available on-device voice while Repbook is visible. Editing a set does not restart rest. The Web Push/QStash implementation is present but **disabled until configured**: production environment revision 0 has no entries. No scheduler account or billing was enabled. See [notification setup and limits](docs/NOTIFICATIONS.md). Locked iPhone/music/AirPods delivery remains untested.

## Source and release

- Canonical GitHub repository: [Jayden-Amjed/Repbook](https://github.com/Jayden-Amjed/Repbook); older Personal-Gym-App links redirect. The fetched main remained at `33644b88322910c8ae23285da80b45fb5d8f3b95` before finalization.
- This update is a local candidate until a source/PR/deployment receipt below records otherwise. Never infer deployment from a Git push or build.
- Previous deployed application: `c4ae3a96a8a2ed3cf89b946e3a8b1c6fc8619153`, saved version 1, deployment `appgdep_6af64410056881919019358ee1192e65`.
- Existing owner-private Site: `appgprj_6af63f525dfc8191ad3be9f66bbd141d`; [live app](https://jayden-repbook.lucentflair1.chatgpt.site). Audience remains owner-only.
- A read-only production inspection confirmed one cloud D1 journal (revision 27 at inspection). Journal contents and test photos were not copied into source. No synthetic production records were written.
- D1 stores the journal and photo metadata; private R2 stores original and composite JPEGs. Authenticated ownership checks guard both metadata and bytes. Deletion tombstones hide images before storage cleanup; failed cleanup can retry on later journal saves.

## Verification actually completed

Windows / Node 24.22.1, isolated loopback preview, 2026-11-12:

- `npm test`: 27/27 passed (migration, routines, actual order/context, comparisons, rest defaults/deadlines, service-worker behavior, push validation/encryption/provider failures).
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Local `npm run build`: passed during implementation; final Sites build/package evidence is recorded in the release receipt.
- `node --experimental-strip-types tests/api-smoke.mjs http://127.0.0.1:5173`: 19 checks passed, including save/reload, revision conflicts, auth/origin/input limits, and fixture cleanup.
- `node --experimental-strip-types tests/photos-smoke.mjs http://127.0.0.1:5173`: 73 checks passed, including private image access, upload bounds, stale overlay rejection/regeneration, conditional replacement/deletion, and workout/photo deletion.
- Applied and inspected local migrations `0000` and `0001`; the latter adds photo and push tables without replacing the journal table.
- Actual browser QA: gym selection does not create an accidental session; Pull/rear-delt defaults; interleaved exercise order; automatic countdown; editing without restart; expiry; finish cancellation; optional photo upload, download, and reload; desktop/narrow layout without horizontal overflow. A real supplied sample exposed the framework's default 1 MB multipart limit; after raising its envelope to the bounded 9 MB endpoint limit, the sample uploaded successfully and persisted across reload.
- Browser QA also verified that editing a workout flags an outdated photo overlay and rebuilding from its stored original saves the updated muscle map. The compact overlay was checked against the supplied sample.
- The personal photo sample and synthetic workouts stayed in ignored local storage. Local fixtures/photos were removed afterward. A composite download is retained only under ignored `outputs/`.
- Web Push encryption/signing ran in an isolated local Worker harness. No live QStash/provider delivery was attempted.

## Limits and next action

Finish source review, final build/package, PR checks, and private deployment; append exact implementation/release evidence after those operations complete. State Version remains 5 for this single accepted update.

Then connect the owner's free scheduler account through secret runtime settings and perform the physical iPhone/AirPods test. Web Push acceptance cannot guarantee delivery or Siri speech. Finishing/deleting on a different device does not yet revoke a notification queued by the first device; cancellation at delivery time or after an unknown provider acknowledgement may still allow an alert. These limits must be resolved or accepted before promising that behavior.

Internet is required for cloud load/sync; cold-launch offline editing, import, and automatic conflict merging are not implemented. JSON exports omit image files (download photos separately). Journal saves are capped at 1.5 MB; photo uploads at 4 MB each after client resizing. Separate-real-account isolation, injected R2/D1 failures, physical iPhone installation, notification delivery, and AirPods audio were not exercised. Workout suggestions compare matching machine/order/workload context; they do not measure hypothetical fatigue-free strength or prescribe overload timing.

Ordinary logging/photos/timers call no AI model and consume no inference tokens. App data/upload requests and optional notification-provider usage are ordinary network APIs with their own hosting/service limits.
