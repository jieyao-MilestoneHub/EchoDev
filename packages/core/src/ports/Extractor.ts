import type { DecisionNode } from "../entities/DecisionNode.js";

export interface ExtractionContext {
  readonly ref: string;
  readonly repoRoot: string;
}

export interface Extractor {
  extract(ctx: ExtractionContext): Promise<readonly DecisionNode[]>;
}
