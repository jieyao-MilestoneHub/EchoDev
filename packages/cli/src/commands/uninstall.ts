import * as fs from "node:fs/promises";
import * as path from "node:path";
import { atomicWriteJson } from "@hey-echodev/storage-fs";
import { readFileSafe } from "../util/io.js";

export interface UninstallOptions {
  readonly repoRoot: string;
  readonly withClaude: boolean;
  /** When true, also remove .echodev/ (including decisions/). Default false. */
  readonly purge: boolean;
}

export async function uninstall(opts: UninstallOptions): Promise<string[]> {
  const removed: string[] = [];

  if (opts.withClaude) {
    const claudeDir = path.join(opts.repoRoot, ".claude");
    await removeIfExists(path.join(claudeDir, "skills", "echodev-recall"), removed, opts.repoRoot);
    await removeIfExists(path.join(claudeDir, "skills", "echodev-record"), removed, opts.repoRoot);
    // Legacy artifact: pre-recipe versions of `echodev init` wrote a sidecar.
    // Recent versions print the recipe to stdout instead, but we still clean
    // the file up here so users upgrading don't have to delete it manually.
    await removeIfExists(path.join(claudeDir, "echodev.hooks.snippet.json"), removed, opts.repoRoot);
    await unmergeSettingsHooks(path.join(claudeDir, "settings.json"), removed, opts.repoRoot);
  }

  const dmRoot = path.join(opts.repoRoot, ".echodev");
  await removeIfExists(path.join(dmRoot, "index"), removed, opts.repoRoot);
  await removeIfExists(path.join(dmRoot, "bridge"), removed, opts.repoRoot);

  if (opts.purge) {
    await removeIfExists(dmRoot, removed, opts.repoRoot);
  }

  return removed;
}

async function removeIfExists(target: string, removed: string[], repoRoot: string): Promise<void> {
  const existed = await fs
    .stat(target)
    .then(() => true)
    .catch(() => false);
  if (!existed) return;
  try {
    await fs.rm(target, { recursive: true, force: true });
    removed.push(path.relative(repoRoot, target));
  } catch {
    // removal is best-effort
  }
}

interface HookCommand {
  readonly command?: string;
}
interface HookEntry {
  readonly hooks?: readonly HookCommand[];
}

async function unmergeSettingsHooks(
  settingsPath: string,
  removed: string[],
  repoRoot: string,
): Promise<void> {
  const raw = await readFileSafe(settingsPath);
  if (raw === undefined) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  if (parsed === null || typeof parsed !== "object") return;

  const hooks = parsed["hooks"];
  if (hooks === undefined || hooks === null || typeof hooks !== "object") return;

  const hooksObj = hooks as Record<string, unknown>;
  const cleanedEntries = Object.entries(hooksObj).flatMap(([event, list]) => {
    if (!Array.isArray(list)) return [[event, list] as const];
    const kept = list.filter((entry) => !isEchoDevHook(entry));
    return kept.length > 0 ? [[event, kept] as const] : [];
  });

  const cleaned = Object.fromEntries(cleanedEntries);
  const changed = JSON.stringify(cleaned) !== JSON.stringify(hooksObj);
  if (!changed) return;

  const next = { ...parsed, hooks: cleaned };
  await atomicWriteJson(settingsPath, next);
  removed.push(`${path.relative(repoRoot, settingsPath)} (echodev hooks unmerged)`);
}

function isEchoDevHook(entry: unknown): boolean {
  if (entry === null || typeof entry !== "object") return false;
  const { hooks } = entry as HookEntry;
  if (!Array.isArray(hooks)) return false;
  return hooks.some(
    (h) =>
      typeof h?.command === "string" &&
      (h.command.includes("echodev recall") || h.command.includes("echodev extract")),
  );
}
