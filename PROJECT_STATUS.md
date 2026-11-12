# Repbook project status

Reviewed: 2026-11-12 (America/Los_Angeles).

State Version: 2 — implemented and locally verified foundation; publishing in progress.

## Current state

Repbook implements the requested black/white/orange gym and nutrition app. Dashboard: completed workout logs, sets and reps this week, bodyweight graph, calorie graph, daily reps, nutrition totals, gym chooser, and recent sessions with missed-exercise flags. El Cajon/Miramar/custom gyms lead to five routine tabs. Upper follows the user's supplied order; Lower equals Legs. Every saved set retains its gym and exercise machine label. Finished sessions can be reopened; in-progress routines are preserved.

The private authenticated app stores a versioned JSON journal in D1. Writes are serialized in the client and use atomic revision checks on the server. Stale saves return 409; pending edits have user-scoped local recovery and JSON export. No personal or demo data is seeded in production.

## Source and release

- Canonical repository: [Jayden-Amjed/Personal-Gym-App](https://github.com/Jayden-Amjed/Personal-Gym-App), public, initially empty; origin points there. Initial bootstrap establishes main; later work uses scoped branches/PRs.
- Implementation commit: to be recorded in the subsequent release receipt, after this initial commit exists.
- Private Site ID: appgprj_6af63f525dfc8191ad3be9f66bbd141d.
- Expected app address: https://jayden-repbook.lucentflair1.chatgpt.site; deployment is not yet verified in this version of the record.
- Co_op workflow patterns were adapted from actual local operating docs; no Kenautics app code, recordings, firmware, or history was copied.

## Verification actually completed

- node --experimental-strip-types --test tests/model.test.ts: 6/6 passed, including requested ordered routines, week boundaries, missed flags, input validation, and historical context.
- node node_modules/typescript/bin/tsc --noEmit: passed after final UI typing repairs.
- Sites build-site.mjs / npm run build: final application build passed on Windows/Node 24.22.1.
- Generated and inspected drizzle/0000_glamorous_puma.sql; applied once to the isolated local D1 preview.
- node --experimental-strip-types tests/api-smoke.mjs http://127.0.0.1:5173: 19 checks passed: authentication rejection, spoofed identity rejection, saved-record round trip, stale/concurrent-write conflict protection, invalid/type/origin/size rejection, export, and fixture cleanup.
- Browser QA in local preview: mobile and desktop layouts; Upper 45 lb x 10 set with named machine; finish showing eight missed exercises; food entry and 500 kcal/40 g protein/55 g carbs/15 g fat totals; weigh-in chart; custom gym; downloaded JSON export; full reload retained entries. Synthetic QA records are confined to the ignored local preview database/download, never production or Git.
- Manifest, Apple touch icon, standalone mode, service worker, and iPhone install help implemented. Physical iPhone 14 installation has not been performed or verified.
- GitHub Actions workflow added for model tests, type checking, and build; a remote run is not yet recorded here.

## Limits and next action

Weights use pounds in schema v1. Food values are entered manually. Internet is required for journal load/sync; cold-launch offline editing is not implemented. JSON export works; import/automatic conflict merging is future work. Save requests are capped at 1.5 MB. The local auth simulator has one identity, so separate-account isolation was source-reviewed but not exercised with two real accounts.

Next: push the checked source, publish the private Site, verify the deployed page, then update this record with exact commit/deployment/CI evidence. The owner installs it on iPhone using [these steps](docs/IPHONE.md).
