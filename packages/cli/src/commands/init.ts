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

export interface InitResult {
  readonly created: readonly string[];
  readonly hookRecipe?: string;
  readonly hooksAlreadyInstalled: boolean;
}

export async function init(opts: InitOptions): Promise<InitResult> {
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

  let hookRecipe: string | undefined;
  let hooksAlreadyInstalled = false;

  if (opts.withClaude) {
    const integrations = findIntegrations();
    const claudeDir = path.join(opts.repoRoot, ".claude");
    const skillsDst = path.join(claudeDir, "skills");
    await fs.cp(path.join(integrations, "skills"), skillsDst, { recursive: true });
    created.push(path.relative(opts.repoRoot, skillsDst));

    const settingsPath = path.join(claudeDir, "settings.json");
    const existingSettings = await readFileSafe(settingsPath);
    hooksAlreadyInstalled =
      existingSettings !== undefined && existingSettings.includes("echodev recall");
    if (!hooksAlreadyInstalled) {
      hookRecipe = await loadHookRecipe(integrations);
    }
  }

  await new FileDecisionRepository(opts.repoRoot).rebuildIndexes();
  return { created, hookRecipe, hooksAlreadyInstalled };
}

async function loadHookRecipe(integrations: string): Promise<string> {
  const raw = await fs.readFile(
    path.join(integrations, "hooks", "settings.snippet.json"),
    "utf8",
  );
  const parsed = JSON.parse(raw) as { hooks?: unknown };
  return JSON.stringify({ hooks: parsed.hooks ?? {} }, null, 2);
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
