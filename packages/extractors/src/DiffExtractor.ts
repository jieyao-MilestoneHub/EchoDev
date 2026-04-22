import * as fs from "node:fs/promises";
import type { DecisionNode, Extractor, ExtractionContext, LLMClient } from "@hey-echodev/core";
import { runExtraction } from "./prompt.js";

export class DiffExtractor implements Extractor {
  constructor(private readonly llm: LLMClient) {}

  async extract(ctx: ExtractionContext): Promise<readonly DecisionNode[]> {
    const diff = await fs.readFile(ctx.ref, "utf8");
    const files = [
      ...new Set(
        [...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)]
          .map((m) => m[1])
          .filter((n): n is string => n !== undefined && n !== "/dev/null"),
      ),
    ];
    return runExtraction(
      this.llm,
      { subject: `diff:${ctx.ref}`, body: "", diff, files },
      { type: "commit", ref: ctx.ref },
    );
  }
}
