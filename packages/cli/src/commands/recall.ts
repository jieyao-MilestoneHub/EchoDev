import { recallDecisions, lineMatchesExpiry, type ExplainedHit, type RetrievalHit } from "@hey-echodev/core";
import type { Services } from "../composition.js";

export interface RecallOptions {
  readonly files: readonly string[];
  readonly modules: readonly string[];
  readonly keywords: readonly string[];
  readonly format: "json" | "text";
  readonly topK: number;
  readonly minScore: number;
  /** When true, emit nothing on zero hits. Used by hooks to avoid polluting context. */
  readonly quiet: boolean;
  /** When true, dump per-candidate score breakdown for debugging. */
  readonly explain: boolean;
  /**
   * When true and the PreToolUse env carries the edit's new content, emit a
   * Claude Code block JSON decision if any matching decision's expiry
   * condition is tripped. Off by default (advisory mode).
   */
  readonly ifExpiredBlock: boolean;
}

export interface RecallOutput {
  readonly text: string;
  readonly hitCount: number;
}

const EXPLAIN_LIMIT = 10;

export async function recall(services: Services, opts: RecallOptions): Promise<RecallOutput> {
  if (opts.explain) {
    return explainMode(services, opts);
  }

  const result = await recallDecisions(services.repo, services.retriever, opts);

  if (opts.ifExpiredBlock) {
    const blocked = detectExpiredBlock(result.hits);
    if (blocked !== undefined) {
      return { text: JSON.stringify(blocked), hitCount: result.hits.length };
    }
  }

  if (opts.format === "json") {
    return { text: JSON.stringify(result, null, 2), hitCount: result.hits.length };
  }
  if (result.hits.length === 0) {
    return { text: opts.quiet ? "" : "(no matching decisions)", hitCount: 0 };
  }

  const text = result.hits
    .flatMap((hit) => [
      `• ${hit.node.id}  [score ${hit.score.toFixed(2)}]`,
      `  problem:  ${hit.node.problem}`,
      `  decision: ${hit.node.decision}`,
      ...(hit.node.expiry_conditions.length > 0
        ? [`  expires-if: ${hit.node.expiry_conditions.join("; ")}`]
        : []),
      `  reasons: ${hit.reasons.join(" | ")}`,
      "",
    ])
    .join("\n");
  return { text, hitCount: result.hits.length };
}

async function explainMode(services: Services, opts: RecallOptions): Promise<RecallOutput> {
  if (services.retriever.explain === undefined) {
    throw new Error("retriever does not implement explain()");
  }
  const result = await services.retriever.explain(opts);
  const limited = result.candidates.slice(0, EXPLAIN_LIMIT);

  if (opts.format === "json") {
    return { text: JSON.stringify({ ...result, candidates: limited }, null, 2), hitCount: limited.filter((c) => c.passedThreshold).length };
  }

  const matched = limited.filter((c) => c.passedThreshold);
  const below = limited.filter((c) => !c.passedThreshold);
  const sections: string[] = [
    `min-score threshold: ${result.minScore}   (top ${EXPLAIN_LIMIT} candidates shown)`,
    "",
    `[matched] ${matched.length}`,
    ...matched.flatMap(formatCandidate),
    `[below threshold] ${below.length}`,
    ...below.flatMap(formatCandidate),
  ];
  return { text: sections.join("\n"), hitCount: matched.length };
}

function detectExpiredBlock(
  hits: readonly RetrievalHit[],
): { decision: "block"; reason: string } | undefined {
  const content = readEditNewContent();
  if (content === undefined || content.length === 0) return undefined;

  const lines = content.split(/\r?\n/);
  for (const hit of hits) {
    for (const expiry of hit.node.expiry_conditions) {
      const tripped = lines.some((line) => lineMatchesExpiry(line, expiry));
      if (tripped) {
        return {
          decision: "block",
          reason:
            `EchoDev: decision ${hit.node.id} has an expiry condition that the pending edit appears to trigger: "${expiry}". ` +
            `Explicitly supersede or revise this decision before proceeding.`,
        };
      }
    }
  }
  return undefined;
}

function readEditNewContent(): string | undefined {
  return (
    process.env["CLAUDE_TOOL_INPUT_new_string"] ??
    process.env["CLAUDE_TOOL_INPUT_new_content"] ??
    process.env["CLAUDE_TOOL_INPUT_content"]
  );
}

function formatCandidate(c: ExplainedHit): readonly string[] {
  const b = c.breakdown;
  return [
    `  • ${c.node.id}  total=${c.score.toFixed(2)}  (file=${b.file.toFixed(2)} module=${b.module.toFixed(2)} keyword=${b.keyword.toFixed(2)})`,
    b.matches.file.length > 0 ? `      file:    ${b.matches.file.join(", ")}` : "",
    b.matches.module.length > 0 ? `      module:  ${b.matches.module.join(", ")}` : "",
    b.matches.keyword.length > 0 ? `      keyword: ${b.matches.keyword.join(", ")}` : "",
  ].filter((s) => s.length > 0);
}
