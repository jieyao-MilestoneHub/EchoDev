import {
  DEFAULT_MIN_SCORE,
  DEFAULT_TOP_K,
  type DecisionNode,
  type DecisionReader,
  type ExplainedHit,
  type ExplainResult,
  type RetrievalHit,
  type RetrievalQuery,
  type RetrievalResult,
  type Retriever,
  type ScoreBreakdown,
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
    const active = await this.loadActive();

    const hits: RetrievalHit[] = [];
    for (const node of active) {
      const breakdown = scoreNode(node, query, this.weights);
      const score = totalOf(breakdown);
      if (score >= minScore) hits.push({ node, score, reasons: reasonsOf(breakdown) });
    }

    hits.sort((a, b) => b.score - a.score);
    return { hits: hits.slice(0, topK) };
  }

  async explain(query: RetrievalQuery): Promise<ExplainResult> {
    const minScore = query.minScore ?? DEFAULT_MIN_SCORE;
    const active = await this.loadActive();

    const candidates: ExplainedHit[] = active.map((node) => {
      const breakdown = scoreNode(node, query, this.weights);
      const score = totalOf(breakdown);
      return {
        node,
        score,
        reasons: reasonsOf(breakdown),
        breakdown,
        passedThreshold: score >= minScore,
      };
    });

    candidates.sort((a, b) => b.score - a.score);
    return { candidates, minScore };
  }

  private async loadActive(): Promise<readonly DecisionNode[]> {
    const all = await this.reader.list();
    return all.filter((d) => d.status === "active");
  }
}

function scoreNode(
  node: DecisionNode,
  query: RetrievalQuery,
  weights: Weights,
): ScoreBreakdown {
  const matches = { file: [] as string[], module: [] as string[], keyword: [] as string[] };
  let file = 0;
  let mod = 0;
  let kw = 0;

  for (const f of query.files) {
    const pattern = node.affected_files.find((p) => matchesGlob(normalise(f), p));
    if (pattern !== undefined) {
      file += weights.fileMatch;
      matches.file.push(`${f} ~ ${pattern}`);
    }
  }

  for (const m of query.modules ?? []) {
    if (node.affected_modules.includes(m)) {
      mod += weights.moduleMatch;
      matches.module.push(m);
    }
  }

  for (const k of query.keywords ?? []) {
    if (keywordHit(node, k)) {
      kw += weights.keywordMatch;
      matches.keyword.push(k);
    }
  }

  return { file, module: mod, keyword: kw, matches };
}

function totalOf(b: ScoreBreakdown): number {
  return b.file + b.module + b.keyword;
}

function reasonsOf(b: ScoreBreakdown): readonly string[] {
  const out: string[] = [];
  for (const f of b.matches.file) out.push(`file ${f}`);
  for (const m of b.matches.module) out.push(`module "${m}"`);
  for (const k of b.matches.keyword) out.push(`keyword "${k}"`);
  return out;
}

function normalise(p: string): string {
  return p.replace(/\\/g, "/");
}

function keywordHit(node: DecisionNode, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  const fields = [node.problem, node.decision, ...node.constraints, ...node.failures];
  return fields.some((f) => f.toLowerCase().includes(needle));
}
