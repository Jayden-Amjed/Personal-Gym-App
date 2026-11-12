# Initial decisions

Recorded: 2026-11-12 (America/Los_Angeles). This record separates implementation defaults selected under the user's instruction to build a basis from later explicit user decisions. It is not proof of completed implementation. Update defaults when the implementation changes; retain the provenance of user requirements.

| Decision | Reason / boundary |
| --- | --- |
| Build a responsive web app with private hosted access and standalone Home Screen installation. | The user specified iPhone 14 and wants an installed app experience. This foundation uses a web app; see [iPhone installation](IPHONE.md). Publication and actual phone installation must be verified separately. |
| Keep public source and private hosting separate. | The user supplied [Jayden-Amjed/Personal-Gym-App](https://github.com/Jayden-Amjed/Personal-Gym-App) as the canonical public GitHub repository. Sites maintains a separate source mirror for deployment. Public code does not expose or authorize publishing personal journal data. |
| Use one schema-versioned JSON journal per authenticated user in D1. | The stable authenticated user ID is the ownership key. Database revisions reject a stale write with HTTP 409 instead of overwriting another device's changes. Save/reload and conflict behavior still require validation. |
| Keep a user-scoped local recovery draft and support JSON export. | Recovery drafts protect pending edits but are not a cloud backup. JSON exports can be retrieved for analysis; an import/merge screen is not implemented in this foundation. Do not commit exported personal records. Full offline cold launch is not promised. |
| Bound journal writes to a 1.5 MB API request envelope. | The initial JSON document approach has a deliberate size limit, not unlimited storage. Partitioning the journal is future scalability work and must preserve existing history. |
| Fix all schemaVersion 1 weight values to pounds. | Pounds are an assumption, not a user instruction. There is no per-record unit field in v1; a unit change requires a versioned migration and must never reinterpret old numbers. |
| Interpret the weight graph as bodyweight. | Exercise weights are already part of set history. This interpretation was not specified by the user. |
| Use the user-supplied Upper order and make Lower identical to Legs. | A later explicit instruction superseded the initial inferred-routine plan. See [preferences](PREFERENCES.md) for the full ordered lists. |
| Flag a planned exercise with no logged sets when a workout is finished. | Avoid marking an in-progress session as missed prematurely. Record the routine context so later routine edits do not silently rewrite past completion. |
| Count the training week Monday through Sunday. | A clear initial boundary for weekly set totals; local date handling must be tested at day and week boundaries. |
| Start with manual food and macro entry. | Delivers calorie/protein/carbohydrate/fat totals without inventing nutrient values or depending on an external food-data account. Food search/barcode support can be a later change. |
| Keep source and runtime personal records separate. | GitHub holds app code and workflow context; personal workout, bodyweight, and food records stay out of source control. |

Source merging, deployment, persistence verification, browser QA, and phone QA are recorded separately in PROJECT_STATUS. Do not treat a design decision in this file as evidence that a feature works.

Expected private app address: `https://jayden-repbook.lucentflair1.chatgpt.site`. This is a configured target, not deployment evidence; use PROJECT_STATUS for the observed release state.
