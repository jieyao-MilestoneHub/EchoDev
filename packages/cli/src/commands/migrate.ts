import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CURRENT_SCHEMA_VERSION } from "@hey-echodev/core";
import { atomicWriteJson } from "@hey-echodev/storage-fs";

export interface MigrateOptions {
  readonly repoRoot: string;
}

export interface MigrateResult {
  readonly migrated: readonly string[];
  readonly skipped: readonly string[];
  readonly failed: readonly { file: string; error: string }[];
}

interface Migration {
  /** Source version. `undefined` matches pre-versioned legacy files. */
  readonly from: string | undefined;
  /** Target version after this step. */
  readonly to: string;
  /** Pure transform — must produce an object with `schema_version === to`. */
  readonly apply: (raw: Record<string, unknown>) => Record<string, unknown>;
}

// Forward-only migration chain. Future v1.1 / v2 append a one-line entry
// here; the walker picks them up automatically. Each step's `to` must equal
// the produced object's `schema_version` (asserted at runtime).
const MIGRATIONS: readonly Migration[] = [
  {
    from: undefined,
    to: "1.0",
    apply: (raw) => ({ schema_version: "1.0", ...raw }),
  },
];

const MAX_CHAIN_DEPTH = 32;

export async function migrate(opts: MigrateOptions): Promise<MigrateResult> {
  const decisionsDir = path.join(opts.repoRoot, ".echodev", "decisions");
  const entries = await safeReadDir(decisionsDir);

  const migrated: string[] = [];
  const skipped: string[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(decisionsDir, name);
    try {
      const raw = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        failed.push({ file: name, error: "not a JSON object" });
        continue;
      }
      const result = migrateForward(raw as Record<string, unknown>, CURRENT_SCHEMA_VERSION);
      if (!result.changed) {
        skipped.push(name);
        continue;
      }
      await atomicWriteJson(file, result.value);
      migrated.push(name);
    } catch (err) {
      failed.push({ file: name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { migrated, skipped, failed };
}

interface MigrateForwardResult {
  readonly value: Record<string, unknown>;
  readonly changed: boolean;
}

// Walks the chain: at each step, find the migration whose `from` matches the
// current `schema_version` (or undefined for pre-versioned files), apply it,
// repeat until we reach `target`. Throws on (a) unknown current version with
// no matching step (covers both unknown legacy and future-version downgrade
// attempts), or (b) a buggy step that fails to advance the version.
export function migrateForward(
  raw: Record<string, unknown>,
  target: string,
): MigrateForwardResult {
  let value = raw;
  let changed = false;
  for (let i = 0; i < MAX_CHAIN_DEPTH; i += 1) {
    const current = value["schema_version"];
    if (current === target) return { value, changed };
    const step = MIGRATIONS.find((m) => m.from === current);
    if (step === undefined) {
      throw new Error(
        `no migration path from schema_version "${String(current)}" to "${target}"`,
      );
    }
    value = step.apply(value);
    if (value["schema_version"] !== step.to) {
      throw new Error(
        `migration ${String(step.from)}→${step.to} did not set schema_version correctly`,
      );
    }
    changed = true;
  }
  throw new Error(`migration chain exceeded ${MAX_CHAIN_DEPTH} steps; possible cycle`);
}

async function safeReadDir(dir: string): Promise<readonly string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}
