import { recallDecisions } from "@hey-echodev/core";
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
}

export interface RecallOutput {
  readonly text: string;
  readonly hitCount: number;
}

export async function recall(services: Services, opts: RecallOptions): Promise<RecallOutput> {
  const result = await recallDecisions(services.repo, services.retriever, opts);

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
