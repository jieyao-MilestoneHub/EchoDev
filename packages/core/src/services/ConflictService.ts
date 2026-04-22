import type { DecisionReader } from "../ports/DecisionReader.js";
import type { DecisionNode } from "../entities/DecisionNode.js";
import { matchesGlob } from "../util/glob.js";

export interface DiffSummary {
  readonly changedFiles: readonly string[];
  readonly addedLines: readonly string[];
  readonly removedLines: readonly string[];
}

export interface ConflictFinding {
  readonly decision: DecisionNode;
  readonly reason: string;
}

export async function findConflicts(
  reader: DecisionReader,
  diff: DiffSummary,
): Promise<readonly ConflictFinding[]> {
  const active = (await reader.list()).filter((d) => d.status === "active");
  return active.flatMap((decision) => {
    const touched = diff.changedFiles.some((f) =>
      decision.affected_files.some((p) => matchesGlob(f, p)),
    );
    if (!touched) return [];
    return decision.expiry_conditions.flatMap((expiry) => {
      const signal = diff.addedLines.find((line) => lineMatchesExpiry(line, expiry));
      return signal === undefined
        ? []
        : [{
            decision,
            reason: `added line "${signal.trim().slice(0, 80)}" triggers expiry condition: ${expiry}`,
          }];
    });
  });
}

const STOPWORDS = new Set([
  "that", "this", "with", "from", "into", "when", "will", "must",
  "have", "been", "they", "them", "than", "then", "some", "move", "make",
]);

function lineMatchesExpiry(line: string, condition: string): boolean {
  const tokens = condition
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  if (tokens.length < 2) return false;
  const lower = line.toLowerCase();
  const hits = tokens.filter((t) => lower.includes(t)).length;
  return hits >= 2 && hits / tokens.length >= 0.5;
}
