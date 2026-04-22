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
}
