import type { DecisionWriter } from "../ports/DecisionWriter.js";
import type { Extractor, ExtractionContext } from "../ports/Extractor.js";
import type { DecisionNode } from "../entities/DecisionNode.js";

export async function recordDecisions(
  extractor: Extractor,
  writer: DecisionWriter,
  ctx: ExtractionContext,
): Promise<readonly DecisionNode[]> {
  const nodes = await extractor.extract(ctx);
  for (const node of nodes) await writer.put(node);
  return nodes;
}
