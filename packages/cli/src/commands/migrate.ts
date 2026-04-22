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
      const raw = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
      if (raw === null || typeof raw !== "object") {
        failed.push({ file: name, error: "not a JSON object" });
        continue;
      }
      const current = raw["schema_version"];
      if (current === CURRENT_SCHEMA_VERSION) {
        skipped.push(name);
        continue;
      }
      if (current !== undefined && current !== CURRENT_SCHEMA_VERSION) {
        failed.push({
          file: name,
          error: `schema_version "${String(current)}" is not "${CURRENT_SCHEMA_VERSION}"; refusing to downgrade`,
        });
        continue;
      }
      const next = { schema_version: CURRENT_SCHEMA_VERSION, ...raw };
      await atomicWriteJson(file, next);
      migrated.push(name);
    } catch (err) {
      failed.push({ file: name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { migrated, skipped, failed };
}

async function safeReadDir(dir: string): Promise<readonly string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}
