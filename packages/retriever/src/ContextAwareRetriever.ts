import {
  DEFAULT_MIN_SCORE,
  DEFAULT_TOP_K,
  type DecisionNode,
  type DecisionReader,
  type RetrievalHit,
  type RetrievalQuery,
  type RetrievalResult,
  type Retriever,
  matchesGlob,
} from "@hey-echodev/core";

interface Weights {
  readonly fileMatch: number;
  readonly moduleMatch: number;
  readonly keywordMatch: number;
}

const DEFAULT_WEIGHTS: Weights = {
  fileMatch: 1.0,
  moduleMatch: 0.6,
  keywordMatch: 0.3,
};

export class ContextAwareRetriever implements Retriever {
  constructor(
    private readonly reader: DecisionReader,
    private readonly weights: Weights = DEFAULT_WEIGHTS,
  ) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const minScore = query.minScore ?? DEFAULT_MIN_SCORE;
    const topK = query.topK ?? DEFAULT_TOP_K;
    const all = await this.reader.list();
    const active = all.filter((d) => d.status === "active");

    const hits: RetrievalHit[] = [];
    for (const node of active) {
      const { score, reasons } = scoreNode(node, query, this.weights);
      if (score >= minScore) hits.push({ node, score, reasons });
    }

    hits.sort((a, b) => b.score - a.score);
    return { hits: hits.slice(0, topK) };
  }
}

function scoreNode(
  node: DecisionNode,
  query: RetrievalQuery,
  weights: Weights,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  for (const file of query.files) {
    const match = node.affected_files.find((pattern) => matchesGlob(normalise(file), pattern));
    if (match !== undefined) {
      score += weights.fileMatch;
      reasons.push(`file "${file}" matches "${match}"`);
    }
  }

  for (const mod of query.modules ?? []) {
    if (node.affected_modules.includes(mod)) {
      score += weights.moduleMatch;
      reasons.push(`module "${mod}"`);
    }
  }

  for (const kw of query.keywords ?? []) {
    if (keywordHit(node, kw)) {
      score += weights.keywordMatch;
      reasons.push(`keyword "${kw}"`);
    }
  }

  return { score, reasons };
}

function normalise(path: string): string {
  return path.replace(/\\/g, "/");
}

function keywordHit(node: DecisionNode, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  const fields = [node.problem, node.decision, ...node.constraints, ...node.failures];
  return fields.some((f) => f.toLowerCase().includes(needle));
}
