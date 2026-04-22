import type { DecisionNode, Extractor, ExtractionContext } from "@hey-echodev/core";
import { draftsToNodes, parseDraftsJson } from "./mapping.js";

export class ManualExtractor implements Extractor {
  constructor(private readonly readJsonStdin: () => Promise<string>) {}

  async extract(ctx: ExtractionContext): Promise<readonly DecisionNode[]> {
    const drafts = parseDraftsJson(await this.readJsonStdin());
    const files = [...new Set(drafts.flatMap((d) => d.affected_files ?? []))];
    return draftsToNodes(drafts, { type: "manual", ref: ctx.ref || "stdin" }, files);
  }
}
