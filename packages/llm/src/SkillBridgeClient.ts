import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { LLMClient, LLMRequest, LLMResponse } from "@hey-echodev/core";
import { NullLLMClient } from "./NullLLMClient.js";

// Runs inside Claude Code with no API key: prompt → file, skill writes response → file.
export class SkillBridgeClient implements LLMClient {
  readonly name = "skill-bridge";
  private fellBack = false;

  constructor(
    private readonly bridgeDir: string,
    private readonly waitForResponse: (file: string) => Promise<string>,
    private readonly fallback: LLMClient = new NullLLMClient(),
  ) {}

  async complete(req: LLMRequest): Promise<LLMResponse> {
    this.fellBack = false;
    await fs.mkdir(this.bridgeDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const requestFile = path.join(this.bridgeDir, `${stamp}.request.json`);
    const responseFile = path.join(this.bridgeDir, `${stamp}.response.txt`);
    await fs.writeFile(requestFile, JSON.stringify(req, null, 2), "utf8");
    try {
      const text = await this.waitForResponse(responseFile);
      return { text };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Timed out")) {
        this.fellBack = true;
        process.stderr.write(
          `echodev: skill bridge timed out, falling back to null LLM (no decisions this run)\n`,
        );
        return this.fallback.complete(req);
      }
      throw err;
    }
  }

  didFallback(): boolean {
    return this.fellBack;
  }
}
