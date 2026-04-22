import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import { FileDecisionRepository } from "@echodev/storage-fs";

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
  const gitignore = path.join(dmRoot, ".gitignore");
  await fs.writeFile(gitignore, "bridge/\nindex/\n", "utf8");
  created.push(path.relative(opts.repoRoot, gitignore));

  if (opts.withClaude) {
    const integrations = path.resolve(
      path.dirname(url.fileURLToPath(import.meta.url)),
      "../../../..",
      "integrations",
      "claude-code",
    );
    const claudeDir = path.join(opts.repoRoot, ".claude");
    const skillsDst = path.join(claudeDir, "skills");
    await fs.cp(path.join(integrations, "skills"), skillsDst, { recursive: true });
    created.push(path.relative(opts.repoRoot, skillsDst));

    const hooksDst = path.join(claudeDir, "echodev.hooks.snippet.json");
    await fs.copyFile(path.join(integrations, "hooks", "settings.snippet.json"), hooksDst);
    created.push(path.relative(opts.repoRoot, hooksDst));
  }

  await new FileDecisionRepository(opts.repoRoot).rebuildIndexes();
  return created;
}
