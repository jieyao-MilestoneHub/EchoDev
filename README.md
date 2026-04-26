# EchoDev

[![npm](https://img.shields.io/npm/v/@hey-echodev/cli?label=%40hey-echodev%2Fcli)](https://www.npmjs.com/package/@hey-echodev/cli)
[![license](https://img.shields.io/npm/l/@hey-echodev/cli)](LICENSE)

**Persistent design memory for Claude-assisted codebases.**
Before you edit a file, EchoDev surfaces *why the module was built that way*.
After you commit, it records the new rationale into a structured decision graph.

## Install

```bash
npm install -g @hey-echodev/cli
echodev --help
```

Or one-off without installing:

```bash
npx --package=@hey-echodev/cli echodev <command>
```

## 60-second tour

```bash
cd /path/to/your-project
echodev init                      # creates .echodev/ and .claude/skills/
echodev list                      # (empty — no decisions yet)

# Seed a decision:
echo '[{
  "slug": "auth-jwt-cookie",
  "problem": "Where do session tokens live on the client?",
  "decision": "HttpOnly cookie, never localStorage.",
  "affected_files": ["src/auth/**"],
  "future_reminders": {
    "who_might_repeat": "engineer adding SSO",
    "revisit_when":     "a cross-origin client needs tokens in JS"
  }
}]' | echodev add --stdin

echodev recall src/auth/login.ts  # returns the seeded decision
echodev graph --format mermaid    # renders the decision graph
```

## Commands

```
echodev init [--no-claude]
echodev recall <paths...> [--modules a,b] [--keywords x,y]
                          [--top K] [--min-score N] [--quiet] [--format json|text]
echodev extract <ref>     [--kind commit|diff|pr|manual] [--llm auto|api|skill|null] [--force]
echodev add    --stdin    [--ref <label>]
echodev check  <diff-file>
echodev list              [--status active|superseded|expired] [--format json|text]
echodev graph             [--format mermaid|json]
```

## Claude Code integration

`echodev init` drops two skills into `.claude/skills/` and prints a hook recipe to stdout for you to paste into `.claude/settings.json`:

- **`echodev-recall`** — `echodev recall <file>` before any non-trivial edit.
- **`echodev-record`** — captures decisions from a completed change.

EchoDev never auto-edits `.claude/settings.json` — Claude Code [best practices](https://code.claude.com/docs/en/best-practices) recommend you own that file. Re-running `echodev init` is safe; it detects an existing `echodev recall` entry and skips the recipe.

### Hook recipe

Copy these entries into your `.claude/settings.json` (under the top-level `"hooks"` key):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "test -d .echodev && command -v echodev >/dev/null 2>&1 && echodev recall --from-stdin --quiet --format text || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "test -d .echodev && command -v echodev >/dev/null 2>&1 && git rev-parse HEAD >/dev/null 2>&1 && echodev extract HEAD --kind commit --llm auto || true"
          }
        ]
      }
    ]
  }
}
```

- `PreToolUse` on `Edit|MultiEdit` → silent recall (gated on `.echodev/` and `command -v echodev`)
- `Stop` → idempotent `extract HEAD` (same gates + `git rev-parse HEAD`)

#### Hook contract

PreToolUse consumes Claude Code's [documented hook input](https://code.claude.com/docs/en/hooks-guide) — a JSON object on stdin with a `tool_input.file_path` field. `recall --from-stdin` parses it; the contract surface lives inside this CLI so the recipe stays POSIX-pure (no `jq` dependency) and so a future Claude Code schema change needs one fix here, not in every consumer's `settings.json`. The `command -v echodev` guard keeps the hook silent on machines where the CLI isn't installed.

**Tested against Claude Code as of 2026-04.** If the hook stops returning recall results after a Claude Code update, the contract may have shifted — open an issue or check `recall --from-stdin` against the latest [hooks reference](https://code.claude.com/docs/en/hooks).

After merging, run `/hooks` inside Claude Code to verify (or restart Claude Code).

## Why EchoDev

Claude wastes context re-deriving what your project already decided.
The naive fix ("dump the wiki") makes it worse.

**Thesis: inject the fewest, most load-bearing prior decisions, at the moment the editor needs them, and stay silent otherwise.**

Three commitments:

1. **Decision unit, not document.** Each node has `problem`, `decision`,
   `alternatives`, `constraints`, `failures`, `expiry_conditions`,
   `future_reminders{who_might_repeat, revisit_when}`.
2. **Context-aware retrieval.** File glob (1.0) → module (0.6) → keyword (0.3)
   → one graph hop. Embeddings are an optional re-ranker, never the base.
3. **Prefer silence over noise.** Empty queries, weak hits, and already-extracted
   commits all produce zero output.

### Defaults that enforce #3

| Guard | Default | Why |
|---|---|---|
| `recall --min-score` | `0.5` | Drops lone-keyword hits (0.3). File/module/multi-keyword survive. |
| `recall --top` | `5` | Hard cap. Never injects more than ~5 decisions (~20 lines). |
| Empty query → empty output | always | No paths/modules/keywords → no dump. |
| `recall --quiet` | used by hooks | Zero hits print nothing — no breadcrumb on every edit. |
| Graph expansion | 1 hop, re-gated by `min-score` | Neighbours score × 0.5. |
| `extract` idempotency | on | `.last-extracted` marker — safe to bind to `Stop`. |
| Hook repo gate | `test -d .echodev` | No cross-project leakage. |
| Hook matcher | `Edit\|MultiEdit` | `Write` excluded — new files have no prior decisions. |

**Cost scales with decision count, not project size.**

## Decision schema

Each decision is one JSON file under `.echodev/decisions/<id>.json`:

```jsonc
{
  "schema_version":   "1.0",
  "id":               "d-YYYY-MM-DD-<slug>",
  "status":           "active | superseded | expired",
  "problem":          "...", "decision": "...",
  "alternatives":     ["..."], "constraints": ["..."], "failures": ["..."],
  "expiry_conditions":["falsifiable signals this no longer applies"],
  "affected_files":   ["globs"], "affected_modules": ["logical"],
  "relations": {
    "inherits": [...], "conflicts_with": [...], "fills_gap_of": [...],
    "shared_premise": [...], "superseded_by": null
  },
  "future_reminders": { "who_might_repeat": "...", "revisit_when": "..." },
  "source": { "type": "commit|pr|issue|manual", "ref": "..." }
}
```

Full schema: [`schema/decision.schema.json`](https://github.com/jieyao-MilestoneHub/EchoDev/blob/main/schema/decision.schema.json) — language-agnostic, any tool can read/write.

### Schema versioning

Every decision file carries `schema_version`. The current version is `"1.0"`.

- **Writers stamp it.** `echodev add` and `echodev extract` set `schema_version: "1.0"` on every decision they produce.
- **Readers fail-closed.** Any decision missing `schema_version`, or carrying a value the running CLI doesn't know, is rejected with an error pointing to `echodev migrate`. This prevents silent corruption when the schema evolves.
- **`echodev migrate` walks a forward chain.** `packages/cli/src/commands/migrate.ts` declares a `MIGRATIONS` registry — currently one step (`undefined → "1.0"`, backfilling pre-versioned legacy files). The walker applies whatever steps lead from the file's current version to the target.
- **Adding v2 is one append.** When a future schema change ships, add a `{from: "1.0", to: "1.1", apply: ...}` entry to the chain. `echodev migrate` picks it up; existing files migrate forward in a single pass; no other code changes.
- **No downgrade.** A file carrying a version newer than the running CLI knows about has no chain step → migrate refuses with a clear error rather than corrupting it. Upgrade the CLI instead.

### What to commit

- Commit: `.echodev/decisions/`, `.echodev/.gitignore`
- Ignore (auto-managed, per-clone): `.echodev/index/`, `.echodev/bridge/` — these are rebuilt from `decisions/` on demand and include a local idempotency marker; they should never be shared.

## LLM modes

`--llm auto|api|skill|null`:

- **auto** (default) — Claude API if `ANTHROPIC_API_KEY` is set, else Skill Bridge
- **api** — force Claude API
- **skill** — force Skill Bridge (no API key; skill fills the prompt from Claude Code)
- **null** — never call an LLM (CI smoke tests)

## Contributing / forking

Clone the repo, run the bundled sample:

```bash
git clone https://github.com/jieyao-MilestoneHub/EchoDev
cd EchoDev
npm install
npm run build
node packages/cli/dist/index.js --repo examples/sample-repo list
```

The core logic is free functions behind typed ports (`DecisionReader`,
`DecisionWriter`, `Extractor`, `Retriever`, `LLMClient`). Adapters live in
`packages/{storage-fs,extractors,retriever,llm}`. The composition root is
`packages/cli/src/composition.ts` — add a new LLM client or storage backend
by writing a new adapter and wiring it there.

MIT © jieyao-MilestoneHub
