import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { LLMClient, LLMRequest, LLMResponse } from "@hey-echodev/core";
import { NullLLMClient } from "./NullLLMClient.js";

const DEFAULT_BRIDGE_KEEP = 10;

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
      await pruneBridgeArtifacts(this.bridgeDir);
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

/**
 * Cap bridge dir size by keeping only the newest `keep` request/response pairs.
 * Best-effort: any IO error is swallowed so a stale-state directory never blocks
 * an LLM call. Pairing by stamp prefix prevents orphaned response files when a
 * matching request gets pruned.
 */
export async function pruneBridgeArtifacts(
  bridgeDir: string,
  keep = DEFAULT_BRIDGE_KEEP,
): Promise<void> {
  try {
    const entries = await fs.readdir(bridgeDir);
    const byStamp = new Map<string, string[]>();
    for (const name of entries) {
      if (!name.endsWith(".request.json") && !name.endsWith(".response.txt")) continue;
      const stamp = name.split(".")[0];
      if (stamp === undefined) continue;
      const list = byStamp.get(stamp);
      if (list) list.push(name);
      else byStamp.set(stamp, [name]);
    }
    if (byStamp.size <= keep) return;

    // Stamps are ISO-8601 with `:`/`.` rewritten to `-`; lexical sort = chronological.
    const stamps = [...byStamp.keys()].sort();
    const drop = stamps.slice(0, stamps.length - keep);
    await Promise.all(
      drop.flatMap((stamp) =>
        (byStamp.get(stamp) ?? []).map((name) =>
          fs.unlink(path.join(bridgeDir, name)).catch(() => undefined),
        ),
      ),
    );
  } catch {
    // Pruning is best-effort.
  }
}
