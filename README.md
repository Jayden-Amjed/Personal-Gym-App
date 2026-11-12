# Repbook

Jayden's gym and nutrition journal, built for iPhone 14 and desktop. Choose El Cajon, Miramar, or your own gym; log sets across Push, Pull, Legs, Upper, and Lower; review bodyweight, nutrition, reps, and missed exercises.

The interface uses black, white, and orange. Workouts retain gym and machine context. Schema v1 uses pounds. Food totals come from manually entered calories, protein, carbs, and fat.

- Canonical public source: [Personal-Gym-App](https://github.com/Jayden-Amjed/Personal-Gym-App).
- Live private app: [Repbook](https://jayden-repbook.lucentflair1.chatgpt.site). Check [PROJECT_STATUS.md](PROJECT_STATUS.md) for actual deployment and verification state.
- Phone setup: [Install on iPhone](docs/IPHONE.md). The installed Home Screen web app uses the hosted service; the computer does not need to remain on.
- Start future work with [AGENTS.md](AGENTS.md), [WORKFLOW.md](WORKFLOW.md), [preferences](docs/PREFERENCES.md), and [decisions](docs/DECISIONS.md).

## Development

Use Node.js 24 for parity with CI (package minimum: 22.13.0). The portable tooling supports Windows, macOS, and Linux. Keep one dependency installation running at a time.

```text
npm run install:ci
npm run build
npm run dev
```

The locked installer runs npm ci with the starter's environment handling. Local development normally starts on `http://localhost:5173`; use the actual URL printed in the terminal. Portable preview supports local sign-in at `/signin-with-chatgpt?return_to=/` using its development identity. This mock authentication is not included in production builds. Keep this development server on loopback; use the hosted private app on the iPhone.

For a built local Worker preview, run `npm start` after building. Local preview state is stored in ignored `.wrangler/state`. Running a local preview does not publish the app.

## Database

The authenticated user's versioned JSON journal is stored in D1. Revision checks reject stale saves with HTTP 409 to prevent silent cross-device overwrite. The write envelope is capped at 1.5 MB. Local recovery drafts and export files are private data, not source code; see [decisions](docs/DECISIONS.md) for limits.

After schema changes, generate migrations:

```text
npx drizzle-kit generate
```

Build to generate `dist/server/wrangler.json`, then apply each pending SQL migration to the local preview database, substituting the actual migration filename:

```text
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_glamorous_puma.sql
```

Do not replay already-applied migrations. This command changes only local preview data; production migration handling belongs to the Sites deployment workflow.

## Checks

```text
node --experimental-strip-types --test tests/model.test.ts
npx tsc --noEmit
npm run build
```

GitHub Actions runs these checks on Node.js 24 after `npm ci`. Check outcomes and browser/phone validation are recorded in PROJECT_STATUS; merely adding CI does not establish a passing run.

## Hosting and source layout

The app uses React/Vinext with the maintained Sites/Cloudflare Worker starter. Application code lives under `app/` and `lib/`; database schema/migrations live under `db/` and `drizzle/`. `.openai/hosting.json` declares the Site and D1 binding. Retain the starter's `scripts/`, `worker/`, and framework configuration when changing app features.

Sites publishes from its own source mirror and deployment artifact. GitHub is the canonical public development repository. Follow [WORKFLOW.md](WORKFLOW.md) to keep their source and release evidence aligned. Never publish `.env*`, `.dev.vars*`, tokens, databases, personal backups, or generated local tool state.
