import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { FileDecisionRepository } from "@hey-echodev/storage-fs";
import { readFileSafe } from "../util/io.js";

export interface InitOptions {
  readonly repoRoot: string;
  readonly withClaude: boolean;
}

export async function init(opts: InitOptions): Promise<string[]> {
  const created: string[] = [];
  const dmRoot = path.join(opts.repoRoot, ".echodev");

  for (const sub of ["decisions", "index", "bridge"]) {
    const dir = path.join(dmRoot, sub);
    await fs.mkdir(dir, { recursive: true });
    created.push(path.relative(opts.repoRoot, dir));
  }
  const gitkeep = path.join(dmRoot, "decisions", ".gitkeep");
  await fs.writeFile(gitkeep, "", "utf8");
  created.push(path.relative(opts.repoRoot, gitkeep));
  const gitignore = path.join(dmRoot, ".gitignore");
  await fs.writeFile(gitignore, "bridge/\nindex/\n", "utf8");
  created.push(path.relative(opts.repoRoot, gitignore));

  if (opts.withClaude) {
    const integrations = findIntegrations();
    const claudeDir = path.join(opts.repoRoot, ".claude");
    const skillsDst = path.join(claudeDir, "skills");
    await fs.cp(path.join(integrations, "skills"), skillsDst, { recursive: true });
    created.push(path.relative(opts.repoRoot, skillsDst));

    const hooksDst = path.join(claudeDir, "echodev.hooks.snippet.json");
    const settingsPath = path.join(claudeDir, "settings.json");
    const existingSettings = await readFileSafe(settingsPath);
    const alreadyIntegrated = existingSettings !== undefined && existingSettings.includes("echodev recall");
    if (alreadyIntegrated) {
      created.push(`(skipped snippet: ${path.relative(opts.repoRoot, settingsPath)} already integrated)`);
    } else {
      await fs.copyFile(path.join(integrations, "hooks", "settings.snippet.json"), hooksDst);
      created.push(path.relative(opts.repoRoot, hooksDst));
    }
  }

  await new FileDecisionRepository(opts.repoRoot).rebuildIndexes();
  return created;
}

/**
 * Walks up from the running file until it finds `integrations/claude-code`.
 * Works in the monorepo (tsc output) and in an installed npm package
 * (bundled single file) — the skills travel with the CLI package.
 */
function findIntegrations(): string {
  let dir = path.dirname(url.fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, "integrations", "claude-code");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("echodev: integrations/ directory not found");
}
