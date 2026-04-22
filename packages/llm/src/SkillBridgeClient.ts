import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { LLMClient, LLMRequest, LLMResponse } from "@hey-echodev/core";

// Runs inside Claude Code with no API key: prompt → file, skill writes response → file.
export class SkillBridgeClient implements LLMClient {
  readonly name = "skill-bridge";

  constructor(
    private readonly bridgeDir: string,
    private readonly waitForResponse: (file: string) => Promise<string>,
  ) {}

  async complete(req: LLMRequest): Promise<LLMResponse> {
    await fs.mkdir(this.bridgeDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const requestFile = path.join(this.bridgeDir, `${stamp}.request.json`);
    const responseFile = path.join(this.bridgeDir, `${stamp}.response.txt`);
    await fs.writeFile(requestFile, JSON.stringify(req, null, 2), "utf8");
    const text = await this.waitForResponse(responseFile);
    return { text };
  }
}
