# Gym App agent operating guide

This repository is Jayden's personal gym and nutrition app. Keep this guide and the project records useful to a new session without relying on chat history.

## Start every substantive session

1. Read this file, [PROJECT_STATUS.md](PROJECT_STATUS.md), [WORKFLOW.md](WORKFLOW.md), [preferences](docs/PREFERENCES.md), and relevant [decisions](docs/DECISIONS.md).
2. Check the working directory, `git status --short --branch`, exact HEAD, configured remotes, and active branches/PRs. Fetch and compare remote main when available. Preserve unfamiliar changes and investigate before editing overlapping files.
3. Identify the requested scope, relevant implementation, acceptance checks, and next smallest useful action. Read additional code/docs only as needed.

Human instructions determine authorization and scope. For claims about behavior, prefer reproducible implementation/runtime evidence, then checks actually executed, then PROJECT_STATUS, other documents, and chat/model memory. Report discrepancies. A merged commit, successful build, successful deployment, and tested phone experience are separate facts.

## Work and coordinate

- Follow [WORKFLOW.md](WORKFLOW.md). Initial bootstrap may establish main; subsequent changes use a unique `codex/GYM-###-description` branch and PR where practical.
- Do not discard user work, force-push, rewrite published history, switch another session's checkout branch, or perform unrelated cleanup/upgrades.
- Concurrent independent sessions use separate worktrees/branches. Bounded agents in one coordinated implementation may share a checkout only with explicit non-overlapping file ownership and one Git owner.
- Make reasonable reversible choices and document them; do not repeatedly ask permission for already authorized work. Ask for missing facts when inventing them would misrepresent the user.
- Give concise progress updates and a self-contained completion report. State what changed, checks actually run, and remaining limitations plainly.

## Protect the records

- Workout, bodyweight, and food records are private user data. Keep live databases, personal exports, credentials, tokens, and local secrets out of Git and PRs.
- Preserve historical gym, machine, exercise, unit, date, and set context. Never silently substitute demo records for real data or report empty records as measured zero.
- Storage/schema changes must preserve existing data and provide a migration path. Verify persistence failures are visible before calling a save reliable.
- Do not claim durable storage, synchronization, backup/restore, offline support, or physical-device testing without the relevant evidence. See decisions for the current chosen architecture.

## Finish with a durable handoff

Re-read PROJECT_STATUS and reconcile remote changes before a material update. Advance its State Version once for the accepted update; record the exact existing evidence commit when available, source/deployment state, actual command results, unresolved failures/limits, and next task. Never invent a containing commit's own hash. Update relevant decisions/preferences only when supported by the user or implementation. Keep known limits visible until evidence resolves them.
