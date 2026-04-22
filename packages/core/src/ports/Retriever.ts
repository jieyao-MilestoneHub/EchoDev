import type { DecisionNode } from "../entities/DecisionNode.js";

export interface RetrievalQuery {
  readonly files: readonly string[];
  readonly modules?: readonly string[];
  readonly keywords?: readonly string[];
  /** Hits below this score are dropped. Default 0.5 — rejects lone-keyword hits. */
  readonly minScore?: number;
  /** Maximum hits returned after ranking. Default 5. */
  readonly topK?: number;
  /** Include one-hop graph neighbours of direct hits. Default true. */
  readonly expandGraph?: boolean;
}

export interface RetrievalHit {
  readonly node: DecisionNode;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface RetrievalResult {
  readonly hits: readonly RetrievalHit[];
}

export interface ScoreBreakdown {
  readonly file: number;
  readonly module: number;
  readonly keyword: number;
  readonly matches: {
    readonly file: readonly string[];
    readonly module: readonly string[];
    readonly keyword: readonly string[];
  };
}

export interface ExplainedHit extends RetrievalHit {
  readonly breakdown: ScoreBreakdown;
  readonly passedThreshold: boolean;
}

export interface ExplainResult {
  readonly candidates: readonly ExplainedHit[];
  readonly minScore: number;
}

export interface Retriever {
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
  explain?(query: RetrievalQuery): Promise<ExplainResult>;
}

export const DEFAULT_MIN_SCORE = 0.5;
export const DEFAULT_TOP_K = 5;
