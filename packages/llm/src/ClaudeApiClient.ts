import type { LLMClient, LLMRequest, LLMResponse } from "@echodev/core";

export interface ClaudeApiOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly endpoint?: string;
}

export class ClaudeApiClient implements LLMClient {
  readonly name = "claude-api";

  constructor(private readonly opts: ClaudeApiOptions) {}

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const endpoint = this.opts.endpoint ?? "https://api.anthropic.com/v1/messages";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.opts.model ?? "claude-opus-4-7",
        max_tokens: this.opts.maxTokens ?? 4096,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Claude API ${response.status}: ${body.slice(0, 500)}`);
    }
    const payload = (await response.json()) as {
      content: { type: string; text?: string }[];
    };
    const text = payload.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
    return { text };
  }
}
