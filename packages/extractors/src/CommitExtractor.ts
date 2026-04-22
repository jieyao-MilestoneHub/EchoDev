import type { DecisionNode, Extractor, ExtractionContext, LLMClient } from "@echodev/core";
import { getCommit } from "./git.js";
import { runExtraction } from "./prompt.js";

export class CommitExtractor implements Extractor {
  constructor(private readonly llm: LLMClient) {}

  async extract(ctx: ExtractionContext): Promise<readonly DecisionNode[]> {
    const c = await getCommit(ctx.repoRoot, ctx.ref);
    return runExtraction(
      this.llm,
      { subject: c.subject, body: c.body, diff: c.diff, files: c.changedFiles },
      { type: "commit", ref: c.sha },
      c.date || undefined,
    );
  }
}
