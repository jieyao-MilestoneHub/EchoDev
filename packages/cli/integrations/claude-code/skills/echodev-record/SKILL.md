---
name: echodev-record
description: Capture a design decision from a just-completed change. Trigger ONLY when a change embeds a real design choice — new abstraction, new policy, new contract, new constraint, chosen trade-off — and the work is logically complete. Do NOT trigger for: formatting/whitespace, dep bumps, renames, test-only changes that don't alter behaviour, documentation edits, WIP commits, or reverts. If the change has nothing falsifiable to record, do nothing.
---

# EchoDev Record

A decision worth recording answers a **non-obvious question** that a future
reader could plausibly re-ask. If the change would not surprise a future reader,
there is no decision to record — stop here.

## Option A — extract from a completed commit (CI / post-commit flow)

```bash
echodev extract <commit-sha> --kind commit --llm api   # idempotent: same SHA is skipped
```

Requires `ANTHROPIC_API_KEY`. `extract` uses a `.echodev/.last-extracted` marker
so calling it twice on the same commit is a no-op — this is what makes it safe
to bind to a `Stop` hook.

## Option B — record interactively (no API key, still conservative)

1. Read the staged diff (`git diff --staged` or `HEAD~1..HEAD`).
2. If you cannot name at least one (problem, decision, expiry_condition)
   triple, STOP — the change is not decision-bearing.
3. Otherwise, emit a JSON array of drafts:

```json
[
  {
    "slug": "short-kebab-slug",
    "problem": "the non-obvious question the change answers",
    "decision": "the chosen answer",
    "alternatives": ["what you rejected, briefly"],
    "constraints": ["preconditions under which this holds"],
    "failures": ["failure modes this prevents"],
    "expiry_conditions": ["falsifiable signals this is no longer valid"],
    "affected_files": ["src/...", "packages/.../*.ts"],
    "affected_modules": ["logical module"],
    "future_reminders": {
      "who_might_repeat": "future reader most likely to hit this again",
      "revisit_when":     "the signal that should trigger re-examination"
    }
  }
]
```

```bash
echo '<json-above>' | echodev add --stdin --ref <sha-or-label>
```

## Rules

- One node per distinct design choice. Don't bundle unrelated rationales.
- `future_reminders` fields are mandatory. If you cannot name a future reader
  or a revisit signal, the decision is too vague — skip it.
- `expiry_conditions` must be falsifiable (no "if requirements change").
- Prefer zero records over speculative ones. The cost of a bad decision node is
  that it will be retrieved on a future edit and spend context for no gain.
