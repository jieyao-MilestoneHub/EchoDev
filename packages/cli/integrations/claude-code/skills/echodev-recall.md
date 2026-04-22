---
name: echodev-recall
description: Surface the prior design decisions that govern a file you are about to modify. Trigger ONLY when (a) you are about to make a non-trivial edit to an existing source file, and (b) EchoDev has decisions indexed for a matching path or module. Do NOT trigger for whitespace/formatting changes, renames, new files with no prior decisions, dependency bumps, test-only edits that don't change behaviour, tool/config files, documentation, or any action in a repo without a `.echodev/` directory.
---

# EchoDev Recall

Run ONCE per file you are about to modify — not once per tool call, not as a
warm-up, not speculatively.

```bash
echodev recall <path-you-are-editing> --quiet --format text
```

- Pass the exact file path.
- `--quiet` means: if EchoDev has nothing relevant, you will see empty output.
  Treat empty output as "no prior constraints on this file, proceed normally."
- If the output contains decisions, read the `decision:` line and the
  `expires-if:` list. If your change trips an `expires-if` condition, the
  earlier decision must be explicitly superseded — say so in your commit
  message and record a new decision.

## Do not spam

The whole point of EchoDev is to **save context**, not spend it. Rules:

- Never call recall just "to be safe" before reading a file you haven't
  committed to editing.
- Never call recall on a directory or a glob — it expects concrete paths.
- Never cite a decision id the CLI did not return.
- Per edited file, one recall per session is enough — results don't change
  mid-session unless you write a new decision yourself.
