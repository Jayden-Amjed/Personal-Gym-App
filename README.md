# Repbook

A private workout and nutrition journal for mobile and desktop. Log sets, compare training history, track food and bodyweight, and keep an optional photo of each completed session.

The responsive interface uses black, white, and orange, with Home Screen installation support on iPhone.

## Features

- Configurable gyms and Push, Pull, Legs, Upper, and Lower routines.
- Weight, reps, machine, and actual set order recorded with each new set.
- Muscle-workload context for comparing equivalent sets across sessions. Earlier records retain unknown order.
- Automatic rest countdowns inside the active exercise card, continuing across app tabs.
- Optional Web Push scheduling for locked-screen alerts, when the notification service is configured. Delivery depends on the device and notification settings.
- Session deletion, completion history, and missed-exercise flags.
- Optional private session photos with front/back muscle diagrams and workout/date overlays.
- Food presets with adjustable servings and editable nutrition totals, custom food entry, bodyweight charts, and JSON journal exports.

## Food presets

Choose a preset in **Log food**, set the servings eaten (including fractions), and review or edit its totals before saving. Changing the preset or servings resets the suggested name and nutrition. Existing logged foods keep their saved values.

The initial catalog includes David Gold bars, Fairlife Nutrition Plan chocolate/vanilla shakes, Chipotle chicken/steak High Protein Cups, three crispy chicken tacos with cheese and mild tomato salsa, and a large burrito flour tortilla. Each preset links to its official nutrition source. Values were checked on November 12, 2026; product labels and restaurant portions can differ. The taco preset uses three shells with one total standard portion of each filling across the order. Seasonal cup variants without a current verified label are not included.

## Development

Use Node.js 24 with npm (minimum Node version: 22.13.0). Run commands from this repository's root:

```text
npm run install:ci
npm run build
npm run dev
```

Use the loopback URL printed by the development server, normally `http://127.0.0.1:5173`. Local sign-in is simulated at `/signin-with-chatgpt?return_to=/`; its identity and database are separate from production. Keep local preview on loopback.

For a built local Worker preview, run `npm start` after building. Local state is stored in ignored `.wrangler/state`.

## Storage and privacy

The authenticated journal is stored in Cloudflare D1. Revision checks reject stale writes instead of silently overwriting another device's changes. Browser recovery drafts protect pending edits; they are not a cloud backup. Session images are stored privately in R2, with ownership and workout metadata in D1. Image requests require authentication.

Workout logging, charts, photo overlays, and rest alerts do not call an AI model. Normal use does call the app's data API. Optional push notifications use a configured delivery service; hosting, storage, and notification-provider limits are separate from AI token usage.

Keep credentials, personal exports, photos, database files, and recovery data out of Git. JSON export contains journal records; download session photos separately. Import and automatic conflict merging are not implemented. Internet is required for cloud load/sync, and full offline cold-launch editing is not available. All recorded weights use pounds.

## Database setup

Build first to generate `dist/server/wrangler.json`. For a new local database, apply the committed SQL migrations in order, replacing the filename below with each unapplied migration:

```text
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/<migration>.sql
```

Never replay applied migrations or use `--remote` for local testing. Intentional schema changes use `npm run db:generate`. Production migrations run through the Sites publishing workflow.

## Checks

```text
npm test
npx tsc --noEmit
npm run build
```

The loopback-only API smoke scripts in `tests/` create synthetic fixtures and restore the empty test journal. Run them sequentially against an isolated local preview, with no simultaneous editing. Never run them against personal records.

## Project guide

- [Onboarding](ONBOARDING.md): setup, synchronization, and publication.
- [Agent instructions](AGENTS.md) and [workflow](WORKFLOW.md): contribution and handoff rules.
- [Project status](PROJECT_STATUS.md): actual source, release, verification, and known limits.
- [iPhone installation](docs/IPHONE.md).
- [Rest notification setup and limitations](docs/NOTIFICATIONS.md).

Application code lives in `app/` and `lib/`; database declarations and migrations live in `db/` and `drizzle/`. The app uses React/Vinext and a Cloudflare Worker. Preserve the hosting starter's `scripts/`, `worker/`, and framework configuration when changing features.

GitHub source, the Sites source mirror, and the live release are separate. Publishing requires an explicit Sites deployment; a GitHub push or local build alone does not update the hosted app.
