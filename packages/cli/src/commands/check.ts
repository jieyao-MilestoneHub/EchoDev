import * as fs from "node:fs/promises";
import { findConflicts, type DiffSummary } from "@echodev/core";
import type { Services } from "../composition.js";

export interface CheckOptions {
  readonly diffPath: string;
}

export interface CheckResult {
  readonly output: string;
  readonly conflictCount: number;
}

export async function check(services: Services, opts: CheckOptions): Promise<CheckResult> {
  const diff = summariseDiff(await fs.readFile(opts.diffPath, "utf8"));
  const findings = await findConflicts(services.repo, diff);
  if (findings.length === 0) {
    return { output: "✓ no conflicts with active decisions", conflictCount: 0 };
  }
  const output = findings
    .map((f) => `✗ ${f.decision.id}\n  ${f.decision.decision}\n  → ${f.reason}`)
    .join("\n\n");
  return { output, conflictCount: findings.length };
}

function summariseDiff(diff: string): DiffSummary {
  const changedFiles: string[] = [];
  const addedLines: string[] = [];
  const removedLines: string[] = [];
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      const file = line.slice(6);
      if (file !== "/dev/null") changedFiles.push(file);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      addedLines.push(line.slice(1));
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      removedLines.push(line.slice(1));
    }
  }
  return { changedFiles, addedLines, removedLines };
}
