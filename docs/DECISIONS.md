# Implementation decisions

Recorded: 2026-11-12 (America/Los_Angeles). This record separates implementation defaults selected under the user's instruction to build a basis from later explicit user decisions. It is not proof of completed implementation. Update defaults when the implementation changes; retain the provenance of user requirements.

| Decision | Reason / boundary |
| --- | --- |
| Build a responsive web app with private hosted access and standalone Home Screen installation. | The user specified iPhone 14 and wants an installed app experience. This foundation uses a web app; see [iPhone installation](IPHONE.md). Publication and actual phone installation must be verified separately. |
| Keep public source and private hosting separate. | The existing canonical repository is now [Jayden-Amjed/Repbook](https://github.com/Jayden-Amjed/Repbook). Sites maintains a separate source mirror for deployment. Public code does not expose or authorize publishing personal journal data or photos. |
| Use one schema-versioned JSON journal per authenticated user in D1. | The stable authenticated user ID is the ownership key. Database revisions reject a stale write with HTTP 409 instead of overwriting another device's changes. Save/reload and conflict behavior still require validation. |
| Keep a user-scoped local recovery draft and support JSON export. | Recovery drafts protect pending edits but are not a cloud backup. JSON exports can be retrieved for analysis; an import/merge screen is not implemented in this foundation. Do not commit exported personal records. Full offline cold launch is not promised. |
| Bound journal writes to a 1.5 MB API request envelope. | The initial JSON document approach has a deliberate size limit, not unlimited storage. Partitioning the journal is future scalability work and must preserve existing history. |
| Keep schema versions 1 and 2 weight values in pounds. | Pounds remain an initial implementation assumption. The v2 migration preserves existing numbers; any future unit change needs a versioned migration and must never reinterpret old values. |
| Interpret the weight graph as bodyweight. | Exercise weights are already part of set history. This interpretation was not specified by the user. |
| Use the user-supplied Upper order and make Lower identical to Legs. | A later explicit instruction superseded the initial inferred-routine plan. See [preferences](PREFERENCES.md) for the full ordered lists. |
| Flag a planned exercise with no logged sets when a workout is finished. | Avoid marking an in-progress session as missed prematurely. Record the routine context so later routine edits do not silently rewrite past completion. |
| Count the training week Monday through Sunday. | A clear initial boundary for weekly set totals; local date handling must be tested at day and week boundaries. |
| Start with manual food and macro entry. | Delivers calorie/protein/carbohydrate/fat totals without inventing nutrient values or depending on an external food-data account. Food search/barcode support can be a later change. |
| Keep source and runtime personal records separate. | GitHub holds app code and workflow context; personal workout, bodyweight, and food records stay out of source control. |

## GYM-002: session feedback

Recorded: 2026-11-12 (America/Los_Angeles). These choices implement the feedback in [preferences](PREFERENCES.md); source completion, deployment, and device testing are separate evidence.

| Decision | Reason / boundary |
| --- | --- |
| Migrate journals to schema v2 on read; require v2 writes. | Preserve every v1 workout, machine, unit, and exercise snapshot. Older sets retain unknown order; no timestamps or workload history are invented. Old clients must export pending edits and refresh before saving. |
| Snapshot sequence, time, machine, muscle mapping, and prior muscle-set counts when a set is logged. | The sequence follows actual entry order, including interleaved exercises. Editing/deleting a set does not rewrite later snapshots. New snapshots use the records retained at entry time. Comparable sets require matching gym, exercise, machine, set position, and prior muscle workload; this is context, not an estimate of true strength or an automatic overload prescription. |
| Use rear-delt fly in new Pull routines and editable 150/90-second rest defaults. | Compound movements default to 150 seconds; isolation/abs to 90. An override belongs to that session exercise. Start only for a new set, replace the previous timer, and cancel the matching timer on current-device set/session deletion or finish. |
| Separate the open-app timer from scheduled Web Push. | Local deadlines survive reload and avoid drift; delayed returns are labelled. GYM-003 removes speech and voice controls at the user's request, placing the countdown in the matching exercise card while preserving it on other tabs. Locked-screen push requires a configured scheduler, device permission, and connectivity. |
| Use QStash to deliver encrypted Web Push at the deadline. | Sites does not provide a verified per-set scheduling facility here. Only a generic ready message is sent; no workout, gym, weight, food, or photo content goes to the scheduler. Subscription endpoints and delivery timing are still service metadata. Credentials were connected in GYM-003; see [NOTIFICATIONS.md](NOTIFICATIONS.md) for activation and test limits. |
| Save optional session photos in private R2, with D1 session metadata. | Keep image bytes outside the bounded JSON journal. Save a resized original and the composited image, strip image metadata through browser re-encoding, and require authenticated owner-scoped reads. Photos are separate from journal JSON export. Replacement/deletion uses concurrency checks; deleting a session hides/removes its associated photo. |
| Draw the front/back overlay in the browser from logged muscle mappings. | Include primary and substantial assisting muscles, as requested; omit missed exercises. Red indicates the mapping of logged work, not measured activation. No image-recognition or generative AI call is made when using this feature. |
| Require confirmation for session deletion and keep the README general. | Prevent accidental removal of recorded sessions while supporting cleanup of empty starts. Keep personal test photos, exports, credentials, and database state out of public Git. |

Notification limits remain explicit: delivery can be late or fail; cancellation at the deadline can race delivery; unresolved provider acknowledgements must not be reported as confirmed cancellation. Finishing/deleting a session on a different device does not currently revoke another device's already queued push.

Source merging, deployment, persistence verification, browser QA, and phone QA are recorded separately in PROJECT_STATUS. Do not treat a design decision in this file as evidence that a feature works.

Expected private app address: `https://jayden-repbook.lucentflair1.chatgpt.site`. This is a configured target, not deployment evidence; use PROJECT_STATUS for the observed release state.
