# Start here: Repbook on a new device or workspace

Use this guide when opening this project on another computer, starting a new editor/agent session, or handing the work to a new collaborator. The repository is the shared source of project context; the previous chat is not required.

## What connects to what

| Item | Where / purpose |
| --- | --- |
| GitHub source | [Jayden-Amjed/Personal-Gym-App](https://github.com/Jayden-Amjed/Personal-Gym-App). Canonical code, documentation, history, and pull requests. Public. |
| Live app | [Repbook](https://jayden-repbook.lucentflair1.chatgpt.site). Private hosted app; sign in with the owner's ChatGPT account. The computer can be off. |
| Current status | [PROJECT_STATUS.md](PROJECT_STATUS.md). Actual release, checks, known limits, and next action. Read this instead of assuming GitHub main is the deployed version. |
| Hosting identity | `.openai/hosting.json`, project ID `appgprj_6af63f525dfc8191ad3be9f66bbd141d`. Reuse this existing Site when updating Repbook. |
| Saved journal | Hosted D1 database, binding `DB`, scoped to the signed-in user. Workout, food, and bodyweight records are not stored in GitHub. |
| Hosting source mirror | A separate Sites-managed Git repository used during publication. It does not automatically pull GitHub changes. |

**Editing files, pushing to GitHub, and publishing the app are separate actions.** GitHub Actions currently tests and builds; it does not deploy. After publication, the phone receives the new application on a fresh load. An already-open or suspended app may need a reload or a full close/reopen. No reinstall is normally needed. Check that edits are saved before closing.

## Start every session

Read these in order, then inspect the relevant implementation:

1. [AGENTS.md](AGENTS.md): operating rules and data protection.
2. [PROJECT_STATUS.md](PROJECT_STATUS.md): latest verified state and outstanding work.
3. [WORKFLOW.md](WORKFLOW.md): branches, checks, publication, and handoffs.
4. [docs/PREFERENCES.md](docs/PREFERENCES.md): Jayden's actual requirements, routines, and preferences.
5. [docs/DECISIONS.md](docs/DECISIONS.md): chosen defaults and their limits.

Preserve existing user changes. Check the working directory, branch, remotes, and open PRs before editing. Prefer implementation and executed checks over stale documentation. Keep the interface black with white text and orange accents; preserve the requested exercise order and gym/machine history.

## Set up another computer

Use Git and Node.js 24 with npm. Internet is needed for dependency installation and remote operations. Cloning this public source does not require write access; pushing requires a GitHub account with access to the repository. Publishing requires access to the existing private Site through Sites in the owning account.

In a terminal opened in the parent folder where you want the project:

```text
git clone https://github.com/Jayden-Amjed/Personal-Gym-App.git
cd Personal-Gym-App
git status --short --branch
git remote -v
node --version
npm --version
npm run install:ci
npm run build
```

If the clone already exists, inspect it and use the synchronization steps below instead of cloning over it. The original Windows checkout is `C:\Users\JUJU\Documents\ChatGPT\Gym App\gym-app`; run commands in that inner app folder. New clones can live anywhere and do not need the same folder name. Open the folder containing `package.json` and `AGENTS.md` in your editor/agent workspace.

The initial build generates the configuration used by local database tools. For a **fresh local database only**, apply the committed initial migration once:

```text
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_glamorous_puma.sql
npm run dev
```

Open the loopback URL printed by the server, normally `http://127.0.0.1:5173/`. Portable development simulates sign-in through `/signin-with-chatgpt?return_to=/` using a local test identity. That identity and database are separate from the hosted journal. Keep the development server on loopback. Use the live app link on the phone.

Do not replay the initial migration on an existing database. If later migrations exist, inspect and apply only unapplied migrations in order. Do not run `db:generate` just to set up a clone; it is for intentional schema changes. Never add `--remote` to local testing commands. See [README.md](README.md) for further commands.

Clean clones default to the portable execution profile. The original setup used an ignored, checkout-local npm launcher because this computer's bundled Node did not provide npm on PATH. Do not copy that temporary setup or machine-specific paths to another device; use a Node installation that supplies npm, or let the agent set up its supported runtime.

## Move work between devices

On the device where you worked, review changes, commit the intended files, and push the active task branch. Uncommitted files do not travel through GitHub. Do not add personal exports, credentials, or databases just to move them between devices.

On the receiving device, first inspect the checkout:

```text
git status --short --branch
git remote -v
git fetch origin --prune
git --no-pager log -5 --oneline
```

For a clean, exclusively owned main checkout:

```text
git switch main
git pull --ff-only origin main
```

For unfinished work, resume the verified task branch rather than assuming it is on main. If histories diverge or there are unfamiliar changes, reconcile them; do not reset, force-push, or overwrite them. Independent concurrent sessions use separate branches/worktrees. `.wrangler/`, `.sites-runtime/`, `node_modules/`, and browser recovery drafts are local and are not synchronized by Git. Reinstall locked dependencies when package inputs change, and apply new local migrations when needed.

Any device with a browser can use the hosted app and read these docs. Editing, building, and publishing source needs a suitable development environment on a computer or remote workspace; installing Repbook on an iPhone does not create that environment.

## Make and release a change

1. Start from the current source and status. Check remote branches and open PRs, then select an unused `codex/GYM-###-short-description` branch. Keep the task scoped.
2. Implement the change and preserve existing records. Update preferences only when supported by the user's instructions; document implementation assumptions separately.
3. Run relevant checks. For an application change, the standard checks are:

   ```text
   npm test
   npx tsc --noEmit
   npm run build
   ```

   Check changed screens and persistence in the local preview as appropriate. The optional `node --experimental-strip-types tests/api-smoke.mjs http://127.0.0.1:5173` test writes synthetic fixtures and restores its initial state; it refuses non-loopback targets and nonempty journals. Run it only against an isolated empty test journal, without simultaneous browser editing. Never run tests against personal production records.

4. Review the diff, commit, push, and open a PR into main using [WORKFLOW.md](WORKFLOW.md). Confirm checks and integration. No force-push or rewritten published history. A pushed task branch is not automatically accepted main.
5. **For live app changes, publish separately.** In a session with Sites access, read the installed Sites skill and reuse the project ID from `.openai/hosting.json`. Reconcile canonical GitHub source with the Site's existing mirror; retain its history. Use the supported source helper to build/package and push the exact release source, then save/deploy it to the same private Site. Keep credentials in memory and use the helper's credential input; never put tokens in files, Git, or chat. Preserve the private audience and existing database binding. Do not create a replacement Site just because this is a new computer or chat.
6. Wait for a successful deployment result and verify affected live behavior without seeding personal data. Record the deployed source SHA, version/deployment result, checks, and limits in PROJECT_STATUS. Do not claim a GitHub push or local build is a deployment. If Sites access is unavailable, the source work can still be pushed; explicitly leave publication pending.
7. For documentation-only work, push the docs and update the handoff; there is no application change to publish. Before finishing any task, reconcile the latest status and increment its State Version once for that accepted update. Preserve unresolved limitations and cite only checks actually run.

Normal application publication retains the hosted database. Intentional schema changes need reviewed, data-preserving migrations. A local clone is not a backup of the production journal. Export JSON from the app for a separate backup; an import/merge screen is not implemented yet.

## Phone and current limits

For iPhone 14 installation, follow [docs/IPHONE.md](docs/IPHONE.md): Safari, sign in, Share, Add to Home Screen, and enable Open as Web App if offered. The app runs independently of the computer. Internet is required to load and sync the journal; complete offline cold-launch editing is not implemented. Weights are pounds in schema version 1; food and macros are entered manually; save requests are capped at 1.5 MB. See PROJECT_STATUS for the latest changes to these limits and actual phone-test evidence.

## Prompt for a new session

> This is the existing Repbook project at https://github.com/Jayden-Amjed/Personal-Gym-App. Read ONBOARDING.md, AGENTS.md, PROJECT_STATUS.md, WORKFLOW.md, docs/PREFERENCES.md, and docs/DECISIONS.md. Inspect the checkout and synchronize safely with GitHub. Preserve my data and existing changes. Continue my requested task using the repository workflow. For app changes, test and publish to the existing private Site, then record the actual source, deployment, checks, and remaining limits. Do not create a replacement app or database.

Give the session the specific change you want after that prompt. These documents carry project context; they do not schedule automatic work or keep every device's checkout synchronized in the background.

If you reuse this workflow for a genuinely different project, carry over the documentation structure and operating practices only. Establish that project's own repository, status, requirements, hosting identity, and data storage. Do not copy Repbook's Site ID, private records, release history, or app-specific preferences into another product.
