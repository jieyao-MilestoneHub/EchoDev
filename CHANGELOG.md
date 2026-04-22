# Changelog

All notable changes to `@hey-echodev/cli` are documented here. The format is
loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project follows [SemVer](https://semver.org/).

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
