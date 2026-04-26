# Claude Code + EchoDev: Best Practices

Practical guidance for using EchoDev inside Claude Code. Every rule below cites two anchors:

- **Why (Claude Code)** — the [official Claude Code best practices](https://code.claude.com/docs/en/best-practices) or [hooks guide](https://code.claude.com/docs/en/hooks-guide) the rule aligns with.
- **Why (EchoDev)** — the design principle (README thesis or specific design decision) the rule reinforces.

If a recommendation can't cite both, it doesn't belong in this guide.

---

## 1. When EchoDev helps (and when it doesn't)

EchoDev surfaces **prior architectural decisions** at the moment you're about to overwrite them. It earns its keep on long-lived multi-engineer codebases where context decays and Claude wastes tokens re-deriving what you already decided.

It does **not** earn its keep on:

- Greenfield prototypes or throwaway scripts (no decisions to remember yet).
- Single-author short-term work (your head is the cache).
- Pure formulaic CRUD without architectural tradeoffs.
- Anything you're tempted to use it for as a wiki replacement — that's an anti-pattern (see §8).

**Why (Claude Code):** The [Best Practices guide](https://code.claude.com/docs/en/best-practices) frames CLAUDE.md as "context Claude can't infer from code alone." EchoDev applies that principle to architectural decisions specifically — which deserve their own retrieval mechanism rather than bloating CLAUDE.md.

**Why (EchoDev):** README thesis: *"Inject the fewest, most load-bearing prior decisions, at the moment the editor needs them, and stay silent otherwise."* If you don't have load-bearing prior decisions, you don't need EchoDev.

---

## 2. Setup

The recommended order:

```bash
npm install -g @hey-echodev/cli
cd /path/to/your-project
echodev init
# echodev init prints the hook recipe to stdout — paste it into .claude/settings.json under the "hooks" key
# Then either restart Claude Code, or run /hooks inside Claude Code to reload
```

### 2.1 Don't let EchoDev auto-edit `.claude/settings.json`

`echodev init` prints the recipe and you paste it. It will not silently mutate `settings.json`.

**Why (Claude Code):** The [hooks guide](https://code.claude.com/docs/en/hooks-guide) is explicit: *"Edit `.claude/settings.json` directly to configure hooks by hand."* That file is yours.

**Why (EchoDev):** Issue [#1](https://github.com/jieyao-MilestoneHub/EchoDev/issues/1) — three undefined states (tracked / untracked / hand-edited) collapse into one (no managed file at all). EchoDev never takes ownership of a slice of your settings.

**How to apply:** Re-running `echodev init` is safe; if `settings.json` already contains `"echodev recall"` it skips printing the recipe.

### 2.2 Restart or `/hooks` after merging

The settings watcher does not auto-reload on file creation.

**Why (Claude Code):** Best practices: *"Run `/hooks` to browse what's configured."* Same mechanism reloads.

**Why (EchoDev):** A merged-but-not-loaded hook gives the impression that EchoDev isn't working — the silent failure mode the project explicitly fights against.

---

## 3. Writing good decisions

A decision is one JSON file under `.echodev/decisions/<id>.json`. The schema is at [`schema/decision.schema.json`](https://github.com/jieyao-MilestoneHub/EchoDev/blob/main/schema/decision.schema.json). Quality of recall depends on quality of the decision text.

### 3.1 Phrase `problem` as a question

```json
✅ "problem": "Where do session tokens live on the client?"
❌ "problem": "Authentication"
```

**Why (Claude Code):** Best practices: *"The more precise your instructions, the fewer corrections you'll need."* Questions encode intent; nouns don't.

**Why (EchoDev):** Recall scoring (file 1.0 → module 0.6 → keyword 0.3) ranks against your `problem`/`decision` text. A noun like "Authentication" matches everything; a question matches the moments where the question actually arises.

### 3.2 Make `expiry_conditions` falsifiable

```json
✅ "expiry_conditions": ["uses localStorage for session tokens"]
❌ "expiry_conditions": ["if architecture changes"]
```

**Why (Claude Code):** Best practices: *"Address root causes, not symptoms."* "Architecture changes" is vapor; "uses localStorage for session tokens" is a code-level signal you can grep.

**Why (EchoDev):** `recall --if-expired-block` tokenizes the condition (≥4 chars per token, ≥2 distinct tokens, ≥50% overlap) and matches against the pending edit's `new_string`. Vague phrasing won't tokenize meaningfully and will never trip the block.

### 3.3 `affected_files` are specific globs, not project-wide

```json
✅ "affected_files": ["src/auth/**", "src/middleware/session.ts"]
❌ "affected_files": ["src/**"]
```

**Why (Claude Code):** Best practices: *"Reference existing patterns. Point Claude to patterns in your codebase."* Specific globs say *which* code the decision governs.

**Why (EchoDev):** File-tier matching scores 1.0 (highest). A whole-project glob makes the file tier indistinguishable from "anything", forcing every recall to fall back on weaker signals (module/keyword).

### 3.4 `future_reminders.who_might_repeat` uses real role names

```json
✅ "who_might_repeat": "engineer adding SSO or a cross-origin client"
❌ "who_might_repeat": "developer"
```

**Why (Claude Code):** Best practices: *"Provide specific context in your prompts."* "Developer" is everyone; "engineer adding SSO" is a future-you query.

**Why (EchoDev):** This field is searchable text. Specific role names give recall a hook for the exact scenario when the decision matters.

---

## 4. Hook discipline

EchoDev ships two hooks (`PreToolUse` on Edit/MultiEdit, `Stop`). Stay disciplined about them.

### 4.1 Trust the silence

If `recall` returns nothing for an edit, the answer is *"there's no relevant prior decision."* Don't lower `--min-score` to force matches.

**Why (Claude Code):** Best practices: *"The trust-then-verify gap. Claude produces a plausible-looking implementation that doesn't handle edge cases."* Forcing weak matches creates exactly that gap — Claude reads decisions that don't actually apply.

**Why (EchoDev):** README thesis #3 *"Prefer silence over noise"* is enforced by the defaults: `--min-score 0.5` drops lone-keyword hits, `--top 5` caps injection, `--quiet` zero-pads empty output. Each guard exists because lower thresholds *were* tried and degraded recall quality.

### 4.2 Guard custom EchoDev-aware hooks with `command -v echodev`

If you write any hook that calls `echodev`, gate it with the same pattern the recipe uses:

```bash
test -d .echodev && command -v echodev >/dev/null 2>&1 && echodev <command> ... || true
```

**Why (Claude Code):** Hooks fire on every matching tool use; stderr from a missing binary lands in transcripts and gets misread as "EchoDev is broken."

**Why (EchoDev):** Issue [#2](https://github.com/jieyao-MilestoneHub/EchoDev/issues/2) — a teammate cloning the repo before `npm install -g`'ing the CLI shouldn't generate noise. The shipped recipe already does this; mirror it in custom hooks.

### 4.3 Use the documented stdin-JSON contract

When wiring custom EchoDev-aware hooks, prefer Claude Code's documented stdin-JSON contract over reading internal env vars.

```bash
# Recommended — uses documented contract
echodev recall --from-stdin --quiet --format text

# Avoid — relies on undocumented internals that have shifted before
echodev recall "$CLAUDE_TOOL_INPUT_file_path" --quiet --format text
```

**Why (Claude Code):** Every example in the [hooks guide](https://code.claude.com/docs/en/hooks-guide) consumes JSON on stdin (e.g. `jq -r '.tool_input.file_path'`). The `$CLAUDE_TOOL_INPUT_*` env vars don't appear in the public docs — they're an internal that has no stability guarantee.

**Why (EchoDev):** Issue [#4](https://github.com/jieyao-MilestoneHub/EchoDev/issues/4) — `recall --from-stdin` parses the documented JSON and extracts the path. The contract surface lives in the CLI so a future Claude Code schema change needs one fix here, not in every consumer's `settings.json`.

### 4.4 Don't disable the `Stop` extract — it's idempotent

The `Stop` hook runs `echodev extract HEAD` after every Claude Code session. This is safe to leave on.

**Why (Claude Code):** Best practices: *"Hooks are deterministic and guarantee the action happens."* Idempotent operations are exactly the right shape for a `Stop` hook.

**Why (EchoDev):** Defaults table: *"`extract` idempotency on. `.last-extracted` marker — safe to bind to `Stop`."* Already-extracted commits produce zero output; only new HEADs do work.

---

## 5. Recall is advisory, not gospel

`recall` is a hint that surfaces the most relevant prior decisions. It's not a substitute for reading code, and it doesn't replace your judgment.

### 5.1 Use `--explain` when debugging score breakdown

If a decision you expected to surface doesn't, run:

```bash
echodev recall src/path/to/file.ts --explain
```

This dumps the per-tier score (file / module / keyword) and the threshold gate.

**Why (Claude Code):** Best practices: *"Investigate before deleting or overwriting."* `--explain` lets you investigate why recall is silent before assuming EchoDev is broken.

**Why (EchoDev):** The `--explain` flag was added (PR [#3](https://github.com/jieyao-MilestoneHub/EchoDev/pull/3) of the v0.2.0 batch) precisely because the silence-by-default posture made it hard to tell *why* recall returned empty — explicit explanation closes that loop.

### 5.2 `--quiet` belongs in hooks, not at the human REPL

The hook recipe uses `--quiet` so zero-match invocations emit nothing. When you're at a terminal asking *"do we have a decision about X?"*, drop the flag — `(no matching decisions)` is useful to humans.

**Why (Claude Code):** Best practices: *"Course-correct early and often."* You can't course-correct a silent answer.

**Why (EchoDev):** `--quiet` is a hook-shaped guard, not a default — humans benefit from explicit empty signals.

### 5.3 Recall doesn't replace reading code

When recall surfaces a decision, read the actual file the decision points to before acting on the snippet. The decision is a pointer; the code is the truth.

**Why (Claude Code):** Best practices: *"Address root causes, not symptoms."* A decision summary is a symptom of the rationale; the code (and its history) is the rationale.

**Why (EchoDev):** Decision text is summary, not source. Every decision points to `affected_files`; treat them as required reading when the decision triggers.

---

## 6. Schema discipline

### 6.1 Run `echodev migrate` after upgrading the CLI

```bash
npm install -g @hey-echodev/cli@latest
cd /path/to/your-project
echodev migrate
```

**Why (Claude Code):** Best practices: *"Address root causes, not symptoms."* If reads start failing after a CLI upgrade, the right fix is migrating the data, not pinning the CLI.

**Why (EchoDev):** Decision files carry `schema_version`. Readers fail-closed on missing/unknown values (see [`packages/core/src/util/validation.ts`](https://github.com/jieyao-MilestoneHub/EchoDev/blob/main/packages/core/src/util/validation.ts)) and direct you to `migrate`. Issue [#5](https://github.com/jieyao-MilestoneHub/EchoDev/issues/5) / PR [#16](https://github.com/jieyao-MilestoneHub/EchoDev/pull/16) shipped a forward-migration chain — adding v2 in the future is one append, not a breaking script.

### 6.2 Don't hand-edit decision JSON

Use `echodev add --stdin` for new decisions. Use `echodev extract` to capture from commits. Avoid editing files under `.echodev/decisions/` directly.

**Why (Claude Code):** Best practices: *"If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost."* Out-of-band edits drift from the schema and land in exactly that "rule got lost" failure mode.

**Why (EchoDev):** Writers (`add`, all extractors) stamp `schema_version` and validate before writing. Hand-edits skip both — your edit might be missing required fields, carry a stale schema, or violate the validation rules `parseDecisionNode` enforces.

### 6.3 Trust fail-closed reads

If a read fails with `unsupported schema_version "X"`, that's the system protecting you from silent corruption.

**Why (Claude Code):** Best practices: *"Always provide verification (tests, scripts, screenshots). If you can't verify it, don't ship it."* Fail-closed reads are verification at the storage boundary.

**Why (EchoDev):** Issue [#5](https://github.com/jieyao-MilestoneHub/EchoDev/issues/5) explicitly chose fail-closed over silent migration — silent migration would be the "trust-then-verify gap" Claude Code best practices warn against.

---

## 7. CLAUDE.md integration

### 7.1 A pointer, not a dump

Your `CLAUDE.md` should mention EchoDev in one or two lines. It should not contain decision content.

```markdown
✅ # Architecture
EchoDev surfaces relevant prior decisions automatically — see `.echodev/`.
Run `echodev recall <file>` if you want them on demand.

❌ # Decisions
- Auth: HttpOnly cookie, never localStorage. (See d-2025-01-10-auth-jwt-in-cookie-001.json)
- Cache: per-service, ...
- ...
```

**Why (Claude Code):** Best practices: *"If your CLAUDE.md is too long, Claude ignores half of it because important rules get lost in the noise."* Decision content is high-volume; dumping it kills CLAUDE.md.

**Why (EchoDev):** The PreToolUse hook auto-recalls when Claude is about to edit. CLAUDE.md doesn't need to carry decision content because EchoDev injects the relevant subset at the moment of the edit. Duplication would actively hurt: CLAUDE.md is loaded *every session*, recall is *targeted per file*.

### 7.2 Don't list decisions in CLAUDE.md

Even as a pointer index. The files under `.echodev/decisions/` are the index; `echodev list` and `echodev graph --format mermaid` produce views on demand.

**Why (Claude Code):** Best practices: *"Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"* A growing list of decision IDs in CLAUDE.md is bloat that Claude has no use for in normal operation.

**Why (EchoDev):** README defaults table: *"Cost scales with decision count, not project size."* That property only holds because decisions live outside the per-session context. Listing them in CLAUDE.md re-couples them.

---

## 8. Anti-patterns

The shape of "things that look reasonable but actively degrade EchoDev's value."

### 8.1 Capturing every commit as a decision

`echodev extract HEAD` is selective for a reason. The LLM behind it is asked to find architectural decisions, not to summarize every diff. Commits without architectural content produce zero decisions, and that's correct.

If you find yourself "manually adding decisions for clarity" on every commit, you're treating decisions as commit messages — which they aren't.

**Why (Claude Code):** Best practices: *"The infinite exploration. You ask Claude to 'investigate' something without scoping it. Claude reads hundreds of files, filling the context."* Decision-per-commit is the storage analog of that pattern.

**Why (EchoDev):** README thesis: *"Decision unit, not document."* Decisions are nodes in a sparse graph, not a commit log.

### 8.2 Disabling hooks because they're "too quiet"

If the PreToolUse hook produces no recall output, that means there's no relevant prior decision for the file you're editing. That's the expected steady state, not a bug.

If you "fix" the silence by lowering `--min-score`, you'll get noisy false matches that train Claude (and you) to ignore recall output entirely.

**Why (Claude Code):** Best practices: *"After two failed corrections, `/clear` and write a better initial prompt."* Lowering the threshold to force matches is the failed-correction loop.

**Why (EchoDev):** README thesis #3 *"Prefer silence over noise"*. The defaults are calibrated; if recall is silent for a file, the answer is "no decision applies", not "the threshold is too high."

### 8.3 Bypassing `migrate` by hand-stamping `schema_version`

When a CLI upgrade introduces v2, you'll be tempted to add `"schema_version": "2.0"` to all your files manually. Don't.

**Why (Claude Code):** Best practices: *"Address root causes, not symptoms."* Hand-stamping treats the version field as the goal; the actual goal is the data shape transformation.

**Why (EchoDev):** A v2 migration in [`packages/cli/src/commands/migrate.ts`](https://github.com/jieyao-MilestoneHub/EchoDev/blob/main/packages/cli/src/commands/migrate.ts) doesn't just bump the version — it transforms the data (e.g. adds new required fields with defaults). Hand-stamping skips the transform; readers will then fail with a different, harder-to-diagnose error.

### 8.4 Treating EchoDev as a wiki

EchoDev is for *load-bearing prior decisions* — choices that, if forgotten, cause Claude to re-derive incorrectly. It is not a place for:

- General onboarding documentation (use README / CONTRIBUTING.md)
- API reference (use the schema / docs)
- Project status updates (use the issue tracker)
- Personal notes (use a notebook)

**Why (Claude Code):** Best practices: *"Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"* The same dilution applies to EchoDev — too many "decisions" makes recall less precise.

**Why (EchoDev):** Recall caps at 5 entries (`--top 5`) by design. If you have 500 "decisions" of which 5 are real, recall will drown the real ones in dilution.

---

## Reference: linked issues and PRs

The reasoning above traces through this user-feedback issue batch:

| Issue | What it grounded in this guide |
|---|---|
| [#1](https://github.com/jieyao-MilestoneHub/EchoDev/issues/1) — drop sidecar | §2.1 (don't auto-edit settings.json) |
| [#2](https://github.com/jieyao-MilestoneHub/EchoDev/issues/2) — `command -v` guard | §4.2 (guard custom hooks) |
| [#3](https://github.com/jieyao-MilestoneHub/EchoDev/issues/3) — bridge auto-prune | §4.4 (idempotent Stop) |
| [#4](https://github.com/jieyao-MilestoneHub/EchoDev/issues/4) — stdin-JSON contract | §4.3 (documented contract) |
| [#5](https://github.com/jieyao-MilestoneHub/EchoDev/issues/5) / [#12](https://github.com/jieyao-MilestoneHub/EchoDev/issues/12) — schema_version chain | §6 (schema discipline) |

If a future change to EchoDev contradicts a rule in this guide, update both the rule *and* its anchors. A recommendation without traceable rationale isn't a best practice — it's an opinion.
