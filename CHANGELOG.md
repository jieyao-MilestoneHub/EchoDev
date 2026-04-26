# Changelog

All notable changes to `@hey-echodev/cli` are documented here. The format is
loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project follows [SemVer](https://semver.org/).

## [0.3.0] - 2026-04-26

Best-practices audit follow-up batch. A production user reported five
concerns after a month of integrated use; investigation surfaced five more
follow-up gaps. Closes 10 issues across 9 PRs (#1-#5 reported, #10-#13 +
#18 follow-up). Every change is anchored in [Claude Code's official best
practices](https://code.claude.com/docs/en/best-practices) and the project's
"prefer silence over noise" thesis — see `docs/best_practice.md` (new) for
the consolidated reasoning.

### Fixed (P0 — installation hygiene)

- **No more sidecar file in `.claude/`.** `echodev init` no longer writes
  `.claude/echodev.hooks.snippet.json`. The Claude Code best-practices guide
  is explicit that `.claude/settings.json` is the user's file ("Edit
  `.claude/settings.json` directly to configure hooks by hand"). EchoDev now
  prints the hook recipe to stdout for the user to paste; the recipe also
  lives in README's "Hook recipe" section. `init` detects an existing
  `echodev recall` entry and skips printing on re-run. `uninstall` keeps the
  one-line cleanup for legacy sidecars from prior versions. (#1)
- **Hook recipe stays silent on machines without the CLI.** Both PreToolUse
  and Stop hooks now wrap their `echodev` call with
  `command -v echodev >/dev/null 2>&1` so a teammate cloning the repo before
  `npm install -g`'ing the CLI no longer fills their Claude Code transcript
  with `echodev: command not found` stderr. (#2)
- **args parser no longer hijacks positionals after boolean flags.** A
  pre-existing greedy-lookahead in `parseArgs` consumed the next non-`--`
  token as a value for any flag, so `recall --from-stdin "src/foo.ts"`
  parsed as `{from-stdin: "src/foo.ts"}` instead of
  `{from-stdin: true, positional: "src/foo.ts"}`. Fixed by allowlisting
  known boolean flags. (#11)

### Fixed (P0 — hook contract robustness)

- **PreToolUse contract switched to documented stdin JSON.** The old recipe
  read `$CLAUDE_TOOL_INPUT_file_path` — an undocumented Claude Code
  internal that doesn't appear in the
  [hooks guide](https://code.claude.com/docs/en/hooks-guide). The
  documented contract is JSON on stdin (every official example uses
  `jq -r '.tool_input.file_path'`). New `echodev recall --from-stdin` flag
  parses the documented JSON; the contract surface lives inside this CLI so
  a future Claude Code schema change needs one fix here, not in every
  consumer's `settings.json`. README adds a "Hook contract" subsection and
  a "Tested against Claude Code as of 2026-04" line so freshness is
  visible. (#4, #10)
- **`--if-expired-block` no longer reads any undocumented env var.** The
  feature previously read `CLAUDE_TOOL_INPUT_new_string` /
  `_new_content` / `_content`. All three are now sourced from the same
  parsed stdin JSON: `tool_input.new_string` for Edit, `tool_input.content`
  for Write, joined `tool_input.edits[].new_string` for MultiEdit. With
  this, no `CLAUDE_TOOL_INPUT_*` env var is read anywhere in the
  codebase. (#10)

### Added — user-facing improvements

- **Bridge artifacts auto-prune on every successful skill call.**
  `.echodev/bridge/` was growing unbounded — one production user reported
  70+ files after a month. The class that creates the files
  (`SkillBridgeClient`) now keeps the newest 10 stamps (paired
  request+response) on each successful `complete()`. Best-effort: any IO
  error is swallowed so a stale-state directory never blocks an LLM
  call. (#3)
- **`echodev recall --from-stdin`** — see "hook contract" above. The flag
  is the migration path for hooks coming off the old env-var contract.
- **`echodev migrate` is now a forward-migration chain.** The previous
  single-step procedure (`undefined → "1.0"`) would have forced a rewrite
  to handle a v2; now a `MIGRATIONS: Migration[]` registry walked by
  `migrateForward` makes adding v2 a one-line append. The "refuse to
  downgrade" semantic survives — unknown future versions have no chain
  step and throw with a clear message. README's "Decision schema" example
  now includes `"schema_version": "1.0"` (was missing) and a new "Schema
  versioning" subsection documents the policy. (#5, #12)
- **`docs/best_practice.md`** — new user-facing best-practices guide. 8
  sections covering when EchoDev helps, setup order, writing good
  decisions, hook discipline, recall posture, schema discipline, CLAUDE.md
  integration, and anti-patterns. Every rule cites both a Claude Code
  anchor and an EchoDev design anchor; the introduction states this
  constraint so future additions stay disciplined. README's "Claude Code
  integration" section gains a one-line pointer. (#18)

### Internal — testability

- **Vitest setup + 42 regression tests.** Previous releases verified
  manually because there was no test runner. This release introduces
  `vitest` (root devDep, single root `vitest.config.ts` aliasing
  `@hey-echodev/*` to source so tests skip the build step) and converts
  the manual scenarios from the recent PRs into vitest suites:
  `args.test.ts` (boolean flag handling), `migrate.test.ts` (chain
  walker + filesystem migrate), `init.test.ts` (recipe contents +
  side-effect assertions), `SkillBridgeClient.test.ts`
  (`pruneBridgeArtifacts` + end-to-end). `tsconfig.base.json` excludes
  `**/*.test.ts` from the production build. (#13)

### Upgrading from 0.2.0

**Direct upgrade is safe.** The new CLI binary works against your existing
decisions, hooks, and `.claude/settings.json` without forced changes:

```bash
npm install -g @hey-echodev/cli@latest
```

That said, two of the changes above benefit from a hook-recipe refresh —
one is **required** *if* you use `recall --if-expired-block`, the other is
recommended for everyone.

#### Required if you use `recall --if-expired-block`

`--if-expired-block` previously read the pending edit's content from
`CLAUDE_TOOL_INPUT_*` env vars. Those reads have been removed (#10); the
feature now consumes the same documented stdin-JSON contract `recall
--from-stdin` reads. **If your `.claude/settings.json` still has the old
env-var-based recipe, `--if-expired-block` will silently no-op.** Refresh
the recipe (see below).

If you don't use `--if-expired-block` (it's off by default), you can skip
this concern.

#### Recommended for everyone: refresh the hook recipe

Two improvements wait behind a fresh recipe regardless of
`--if-expired-block`:

- **`command -v echodev` guard** (#2) — silences `echodev: command not
  found` stderr on teammates' machines without the CLI installed.
- **`--from-stdin` flag** (#4) — switches the contract from an
  undocumented Claude Code internal env var (`$CLAUDE_TOOL_INPUT_file_path`)
  to the documented stdin-JSON contract. More stable across Claude Code
  releases; also tested against Claude Code as of 2026-04 (see README).

Old hooks keep working as long as Claude Code still emits the env var, so
this isn't an emergency — it's forward-proofing.

#### How to refresh

```bash
cd /path/to/your-project
echodev init
```

`init` prints the new recipe to stdout. Open `.claude/settings.json` and
replace your existing EchoDev `PreToolUse` and `Stop` hook entries with
the printed JSON. Then restart Claude Code or run `/hooks` inside it to
reload.

If `init` says `Hooks already installed in .claude/settings.json —
skipping recipe.` you're already on a recipe that contains
`echodev recall`; check whether it's the new `--from-stdin` form. If not,
edit by hand or delete the EchoDev entries and re-run `init`.

#### No action needed for these

- **Decision data** — `schema_version` machinery shipped in 0.2.0; existing
  decisions are already at `"1.0"`. If you upgraded from a pre-0.2.0
  version, run `echodev migrate` once (idempotent).
- **Bridge artifacts** — if `.echodev/bridge/` has accumulated old
  `*.request.json` / `*.response.txt` files, the next successful
  skill-bridge extract trims it to the newest 10 stamps automatically (#3).

### Closed in this release

- **Reported issues**: #1, #2, #3, #4, #5
- **Follow-up issues**: #10, #11, #12, #13, #18
- **PRs**: #6, #7, #8, #9, #14, #15, #16, #17, #19

## [0.2.0] - 2026-04-22

User-feedback-driven bug-fix and UX batch. Reported by an admin after first
end-to-end integration; see commit range `cd7d53b..a2bc37d` for the full diff.

### Fixed (P0 — data integrity & integration)

- **Skills now register with Claude Code.** The bundled skills ship under
  `integrations/claude-code/skills/<name>/SKILL.md` subdirs, which is what the
  Claude Code skill scanner actually picks up. The previous flat `.md` layout
  meant the `echodev-recall` / `echodev-record` skills never loaded after
  `init`.
- **`echodev extract --llm null` is a probe again.** It no longer advances
  `.echodev/.last-extracted`, so a null-LLM dry run can no longer poison the
  idempotency marker and cause a later `--llm auto` run to skip the commit.
- **`.last-extracted` moved to `.echodev/index/.last-extracted`.** The marker
  now lives inside the already-gitignored `index/` dir, so it can't be
  committed across clones (which produced cross-clone race conditions). A
  silent one-time migration relocates any legacy marker.
- **`.echodev/decisions/` survives fresh clones.** `init` drops a `.gitkeep`
  so the empty directory is tracked.

### Fixed (P0 — hang protection)

- **Skill bridge wait is now 30 s (was 5 min).** A Stop-hook invocation no
  longer hangs the terminal for five minutes when Claude is no longer reading
  the bridge. Override with `--skill-timeout <seconds>`. On timeout the client
  falls back to `NullLLMClient`; the request payload is never logged, only the
  timing status.
- **Callers can detect the fallback.** `LLMClient` grew an optional
  `didFallback()` that `extract` checks before advancing the idempotency
  marker, so a timed-out Stop-hook doesn't write a bad cache entry.

### Added — install / teardown UX

- **`init` prints Next steps.** A post-install message explains that the
  snippet still needs to be merged into `.claude/settings.json` and that
  Claude Code's settings watcher will not auto-reload on file creation —
  restart or `/hooks`.
- **`init` skips the snippet on already-integrated repos.** Re-running
  `init` no longer clobbers a user's merged config.
- **New `echodev uninstall [--no-claude] [--purge]`.** Reverses `init`: pulls
  our hook entries out of `.claude/settings.json` (everything else stays
  byte-identical), removes the skills and snippet, and clears
  `.echodev/index` / `.echodev/bridge`. `--purge` additionally drops
  `.echodev/decisions/`. Default preserves user data.

### Added — schema evolution

- **`schema_version: "1.0"` is now a required field on every decision.**
  `parseDecisionNode` fails closed on missing or unrecognised versions, so a
  future schema change can't silently corrupt existing files.
- **New `echodev migrate`.** Backfills `schema_version: "1.0"` on every
  decision JSON under `.echodev/decisions/`. Idempotent; refuses to
  downgrade an unknown future version (exits 2).

### Added — recall / show power tools

- **`recall --explain`** dumps per-candidate score breakdowns
  (`file` / `module` / `keyword` weights + matched terms) in both text and
  JSON, including candidates below `--min-score`, so you can see why a
  near-miss was excluded.
- **`recall --if-expired-block`** (off by default) emits a Claude Code
  `{"decision":"block","reason":"..."}` JSON on PreToolUse when the pending
  edit content (from `CLAUDE_TOOL_INPUT_new_string`) trips a matched
  decision's `expiry_conditions`. The reason names only the decision id,
  not its full payload.
- **New `echodev show <id> [--format json|text]`** prints the full decision
  payload, including schema_version, relations, and future_reminders. Id is
  regex-validated before touching the filesystem.

### Deferred

- Cross-repo decision sharing (`.echodev/sources/`) is scoped for a later
  release with a dedicated RFC covering pin-by-SHA, signing, and
  fail-closed schema-version checks on fetched payloads.
