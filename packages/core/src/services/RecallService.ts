import type { DecisionReader } from "../ports/DecisionReader.js";
import {
  DEFAULT_MIN_SCORE,
  DEFAULT_TOP_K,
  type RetrievalHit,
  type RetrievalQuery,
  type RetrievalResult,
  type Retriever,
} from "../ports/Retriever.js";
import { DecisionGraph } from "../graph/DecisionGraph.js";

export async function recallDecisions(
  reader: DecisionReader,
  retriever: Retriever,
  query: RetrievalQuery,
): Promise<RetrievalResult> {
  if (!hasSignal(query)) return { hits: [] };

  const minScore = query.minScore ?? DEFAULT_MIN_SCORE;
  const topK = query.topK ?? DEFAULT_TOP_K;
  const strong = (await retriever.retrieve(query)).hits.filter((h) => h.score >= minScore);
  if (strong.length === 0) return { hits: [] };

  const expanded =
    query.expandGraph === false
      ? strong
      : expandWithNeighbours(strong, new DecisionGraph(await reader.list()), minScore);

  return { hits: expanded.slice(0, topK) };
}

function hasSignal(query: RetrievalQuery): boolean {
  return (
    query.files.length > 0 ||
    (query.modules?.length ?? 0) > 0 ||
    (query.keywords?.length ?? 0) > 0
  );
}

function expandWithNeighbours(
  hits: readonly RetrievalHit[],
  graph: DecisionGraph,
  minScore: number,
): RetrievalHit[] {
  const seen = new Map<string, RetrievalHit>();
  for (const hit of hits) seen.set(hit.node.id, hit);
  for (const hit of hits) {
    const score = hit.score * 0.5;
    if (score < minScore) continue;
    for (const neighbour of graph.neighbours(hit.node.id)) {
      if (seen.has(neighbour.id)) continue;
      seen.set(neighbour.id, {
        node: neighbour,
        score,
        reasons: [`graph-neighbour of ${hit.node.id}`],
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}
