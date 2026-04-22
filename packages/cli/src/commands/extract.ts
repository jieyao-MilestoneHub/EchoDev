import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { recordDecisions } from "@hey-echodev/core";
import { assertSafeRef } from "@hey-echodev/extractors";
import { extractorFor, type Services } from "../composition.js";

const run = promisify(execFile);

export interface ExtractOptions {
  readonly kind: "commit" | "diff" | "pr" | "manual";
  readonly ref: string;
  /** Skip when this commit has already been extracted (marker under .echodev/). */
  readonly idempotent: boolean;
}

export async function extract(services: Services, opts: ExtractOptions): Promise<string> {
  const sha =
    opts.idempotent && opts.kind === "commit"
      ? await resolveSha(services.repoRoot, opts.ref)
      : undefined;
  const marker = path.join(services.repoRoot, ".echodev", "index", ".last-extracted");
  await migrateLegacyMarker(services.repoRoot, marker);

  if (services.llm.name === "null") {
    return "(probe: --llm null, no marker written)";
  }

  if (sha !== undefined && (await readFile(marker)) === sha) {
    return `(skip: ${sha.slice(0, 7)} already extracted)`;
  }

  const nodes = await recordDecisions(
    extractorFor(opts.kind, services.llm),
    services.repo,
    { ref: sha ?? opts.ref, repoRoot: services.repoRoot },
  );

  if (services.llm.didFallback?.() === true) {
    return "(skill bridge timed out; fell back to null LLM, no marker written)";
  }

  if (sha !== undefined) {
    await fs.mkdir(path.dirname(marker), { recursive: true });
    await fs.writeFile(marker, `${sha}\n`, "utf8");
  }

  return nodes.length === 0
    ? "(no decisions extracted)"
    : nodes.map((n) => `+ ${n.id}  ${n.decision}`).join("\n");
}

async function migrateLegacyMarker(repoRoot: string, newMarker: string): Promise<void> {
  const legacy = path.join(repoRoot, ".echodev", ".last-extracted");
  try {
    const content = await fs.readFile(legacy, "utf8");
    await fs.mkdir(path.dirname(newMarker), { recursive: true });
    await fs.writeFile(newMarker, content, "utf8");
    await fs.unlink(legacy);
  } catch {
    // no legacy marker; nothing to migrate
  }
}

async function readFile(file: string): Promise<string | undefined> {
  try {
    return (await fs.readFile(file, "utf8")).trim();
  } catch {
    return undefined;
  }
}

async function resolveSha(repoRoot: string, ref: string): Promise<string | undefined> {
  try {
    assertSafeRef(ref);
    return (await run("git", ["rev-parse", "--verify", "--end-of-options", ref], {
      cwd: repoRoot,
    })).stdout.trim();
  } catch {
    return undefined;
  }
}
