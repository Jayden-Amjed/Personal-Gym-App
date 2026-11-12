# Development and handoff workflow

This is a small-project adaptation of the Kenautics Co_op workflow, not a copy of its source, data, hardware procedures, or project history. The patterns were read from the local `kenautics_mgps_kmg020` checkout's AGENTS, WORKFLOW, UNIVERSAL_WORKFLOW, and STATUS_PROTOCOL documents on 2026-11-12 (America/Los_Angeles).

## Source ownership and publication

The canonical public repository is [Jayden-Amjed/Personal-Gym-App](https://github.com/Jayden-Amjed/Personal-Gym-App), supplied by the user. Use `https://github.com/Jayden-Amjed/Personal-Gym-App.git` as the canonical GitHub remote. The commands below use `origin` for that remote; inspect `git remote -v` rather than assuming a remote name points there.

Sites has a separate source mirror used by its publishing helper. Preserve its configured remote and credentials mechanism; never replace it blindly with GitHub. Keep the canonical GitHub history and deployed source traceable with exact commit/version evidence. A Sites source push does not itself synchronize GitHub, and a GitHub push does not deploy the app. When the helper assigns a different remote name, use the correct verified remote explicitly instead of renaming it during another active operation.

Source is public; hosted app access is private. Keep personal journals, database state, user exports, local recovery records, and credentials out of both source repositories. Review every staged artifact before publication. The expected private site address is `https://jayden-repbook.lucentflair1.chatgpt.site`; the current deployment result belongs in PROJECT_STATUS.

## Start from known state

Read [AGENTS.md](AGENTS.md), [PROJECT_STATUS.md](PROJECT_STATUS.md), and [preferences](docs/PREFERENCES.md). Inspect current changes before any checkout or synchronization. Use non-paged Git output and preserve all unrelated work.

```text
git status --short --branch
git --no-pager log -5 --oneline
git remote -v
git fetch origin --prune
git --no-pager log --oneline HEAD..origin/main
git --no-pager log --oneline origin/main..HEAD
```

Remote commands apply after GitHub setup. If unavailable, record that limitation; do not imply synchronization. On a clean, exclusively owned main checkout, fast-forward with `git pull --ff-only origin main`. Never reset a dirty or divergent tree to make synchronization succeed.

## One scoped change

After bootstrap, use `codex/GYM-###-short-description` and a PR into main. Check remote branches and open PRs before choosing the next ID; a written suggestion is not a reservation. Keep task intent, acceptance checks, and ownership in the PR or an optional `docs/tasks/GYM-###.md` for larger changes. Separate concurrent independent work into worktrees. One coordinator owns Git operations for delegated edits within a single bootstrap task.

Keep changes reviewable. No force-push, published-history rewriting, or unrelated edits. Treat private repository visibility and private app access as separate settings. Do not claim branch protection is enabled until its actual settings have been verified.

## Verify the changed behavior

Use the app's actual documented commands once present. Record exact commands/results rather than adding unverified checks merely to fill a template. Exercise meaningful affected behavior: persistence/reload, session and gym boundaries, numerical validation, missed-exercise accounting, food totals, and mobile layout as applicable. Isolate test records from live personal data.

A test file is not a passed test. Source inspection is not browser QA; browser emulation is not the connected phone. Keep old evidence dated, and record failures or checks not run.

## Reconcile, publish, and record

1. Fetch main again and compare its status/content before finalization. Preserve published history when incorporating remote changes. Resolve overlapping ownership and rerun affected checks.
2. Review diff, staged files, generated outputs, and sensitive data. Commit scoped source and documentation together where practical.
3. Open a PR describing the problem, resulting behavior, validation, and material limitations. A pushed branch is a candidate; main changes only after confirmed integration. Publishing the app requires its own deployment evidence.
4. Update PROJECT_STATUS with actual source/PR/deployment states, exact existing evidence commit, checks, limits, and next step. Record an exact implementation SHA in a later documentation commit when necessary; never amend a published commit merely to insert its own SHA.

## Status protocol

PROJECT_STATUS is the concise current ledger. Before an accepted material write, reread it and compare freshly fetched remote main when available. Reconcile newer versions and equal versions with different content. Advance State Version by exactly one from the accepted predecessor for the accepted update. Candidate changes must state that status and reconcile before integration. Version numbers help humans; Git/PR review provides the concurrency boundary.

Retain unresolved issues and separate facts, assumptions, and untested behavior. Keep detailed implementation history in Git/PRs, not an ever-growing status file. Use client local dates (America/Los_Angeles), and never refresh old evidence dates without a new check. This is a session workflow, not an unattended synchronization automation.

## Completion receipt

At handoff, PROJECT_STATUS or the PR should answer:

- What changed and why; task, branch, PR, and exact evidence commit.
- What is accepted in source, deployed, or still a candidate.
- Which checks ran, their results, and relevant environment.
- Which failures/limits remain, including any phone verification gap.
- What the next smallest actionable task is.
