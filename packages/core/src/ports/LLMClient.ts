export interface LLMRequest {
  readonly system: string;
  readonly user: string;
}

export interface LLMResponse {
  readonly text: string;
}

export interface LLMClient {
  readonly name: string;
  complete(req: LLMRequest): Promise<LLMResponse>;
  /**
   * True when the last `complete()` call was served by a fallback (e.g. skill
   * bridge timed out and the null LLM answered instead). Callers that treat an
   * empty response as "already processed" MUST check this before advancing
   * idempotency markers, otherwise they poison the cache.
   */
  didFallback?(): boolean;
}
