import type { LLMClient, LLMRequest, LLMResponse } from "@echodev/core";

export class NullLLMClient implements LLMClient {
  readonly name = "null";

  async complete(_req: LLMRequest): Promise<LLMResponse> {
    return { text: "[]" };
  }
}
