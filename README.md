# EchoDev

> **Persistent design memory for Claude-assisted codebases.**
> Before you edit a file, EchoDev reminds you *why the module was built that way*.
> After you commit, it captures the new rationale — and only that — into a structured decision graph.

## The central idea: **save context, don't spend it**

EchoDev exists to solve one problem: Claude (or any LLM) wastes context re-deriving things
the project already decided. The naive fix — "dump the wiki" — makes it worse.
EchoDev's thesis is the opposite: **inject the fewest, most load-bearing prior decisions,
at the exact moment the editor needs them, and stay silent otherwise.**

Three commitments follow:

1. **Unit of memory is a decision, not a document.** Every node carries `problem`,
   `decision`, `alternatives`, `constraints`, `failures`, `expiry_conditions`,
   `future_reminders{who_might_repeat, revisit_when}`. Documents rot; decisions have a lifecycle.
2. **Retrieval is context-aware, not semantic.** Match on file glob (1.0) → module (0.6) →
   keyword (0.3), then walk one graph hop. Embeddings are an *optional* re-ranker, never the base.
3. **Prefer silence over noise.** Empty queries, weak hits, and already-extracted commits all
   produce zero output. A "helpful" irrelevant decision costs real tokens.

### Context-discipline defaults

| Guard | Default | Why |
|---|---|---|
| `recall --min-score` | `0.5` | Kills lone-keyword hits (0.3). Only file/module/multi-keyword matches survive. |
| `recall --top` | `5` | Hard cap. A recall never injects more than ~5 decisions (~20 lines). |
| Empty query → empty output | yes | `recall` with no paths/modules/keywords returns nothing — never a dump. |
| `recall --quiet` | used by hooks | Zero hits emits nothing. Hooks don't pollute transcripts on every edit. |
| Graph expansion | 1 hop, re-gated by `min-score` | Neighbours inherit `score × 0.5`; under defaults only direct file hits surface a neighbour. |
| `extract` idempotency | on | `.echodev/.last-extracted` marker. Safe to bind to `Stop`. |
| Hook repo gate | `test -d .echodev` | Hooks are silent outside an initialised repo. |
| Hook matcher | `Edit\|MultiEdit` | `Write` excluded — new files have no prior decisions. |

Cost scales with **decision count**, not project size. A 2 M-line repo with 30 decisions is the
same workload as a 2 K-line repo with 30 decisions.

## Quick start (clone → link → use on your project)

```bash
# In a scratch directory
git clone <this-repo> echodev && cd echodev
npm install
npm run build
npm link -w packages/cli        # puts `echodev` on your PATH
echodev help                    # sanity check
```

Now point it at your real project:

```bash
cd /path/to/your-big-project
echodev init                    # creates .echodev/ and .claude/skills/
echodev list                    # (empty — no decisions yet)

# Seed one from stdin to verify the round-trip:
echo '[{
  "slug": "demo",
  "problem": "Where do session tokens live on the client?",
  "decision": "HttpOnly cookie, never localStorage.",
  "affected_files": ["src/auth/**"],
  "future_reminders": {
    "who_might_repeat": "engineer adding SSO",
    "revisit_when":     "we ship a cross-origin client"
  }
}]' | echodev add --stdin

echodev recall src/auth/login.ts     # should surface the seeded decision
echodev graph --format mermaid       # renders the decision graph
```

Unlink later with `npm unlink -g echodev`.

## Decision schema (abridged — full version in [`schema/decision.schema.json`](schema/decision.schema.json))

```jsonc
{
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

Each node is one JSON file under `.echodev/decisions/<id>.json` — diffs cleanly in git and is
readable by any language.

## CLI

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

`--llm`: `auto` (Claude API if `ANTHROPIC_API_KEY`, else Skill Bridge) · `api` · `skill` · `null`.

## Claude Code integration

`echodev init` drops two skills and a hook snippet into `.claude/`:

- `echodev-recall` — trigger ONLY when you are about to make a non-trivial edit to an existing
  source file and the repo has a `.echodev/`. The description actively discourages speculative use.
- `echodev-record` — trigger ONLY when a change embeds a real, falsifiable design choice.
  Records nothing rather than noise.
- Hook snippet (`.claude/echodev.hooks.snippet.json`) — paste into `settings.json`:
  - `PreToolUse` on `Edit|MultiEdit` → `echodev recall … --quiet` (gated on `.echodev/` existing).
  - `Stop` → `echodev extract HEAD` (idempotent via marker — repeated Stops are no-ops).

MIT.
