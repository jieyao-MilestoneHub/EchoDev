import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate, migrateForward } from "./migrate.js";

let tmp: string;
let decisionsDir: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "echodev-migrate-"));
  decisionsDir = path.join(tmp, ".echodev", "decisions");
  await fs.mkdir(decisionsDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const VALID_SHAPE = {
  id: "d-2025-01-01-fixture",
  created_at: "2025-01-01",
  status: "active",
  problem: "p",
  decision: "d",
  alternatives: [],
  constraints: [],
  failures: [],
  expiry_conditions: [],
  affected_files: ["src/foo.ts"],
  affected_modules: [],
  relations: {
    inherits: [],
    conflicts_with: [],
    fills_gap_of: [],
    shared_premise: [],
    superseded_by: null,
  },
  future_reminders: { who_might_repeat: "a", revisit_when: "b" },
  source: { type: "manual", ref: "seed" },
};

async function writeDecision(name: string, body: Record<string, unknown>): Promise<void> {
  await fs.writeFile(path.join(decisionsDir, name), JSON.stringify(body, null, 2));
}

async function readDecision(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(path.join(decisionsDir, name), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("migrateForward (chain walker)", () => {
  it("backfills schema_version on legacy (undefined) input", () => {
    const { value, changed } = migrateForward({ id: "x" }, "1.0");
    expect(changed).toBe(true);
    expect(value["schema_version"]).toBe("1.0");
    expect(value["id"]).toBe("x");
  });

  it("places schema_version at the top of the resulting object", () => {
    const { value } = migrateForward({ id: "x", problem: "p" }, "1.0");
    expect(Object.keys(value)[0]).toBe("schema_version");
  });

  it("is a no-op when already at target", () => {
    const { value, changed } = migrateForward({ schema_version: "1.0", id: "x" }, "1.0");
    expect(changed).toBe(false);
    expect(value["schema_version"]).toBe("1.0");
  });

  it("throws on unknown future version (no chain step from it)", () => {
    expect(() => migrateForward({ schema_version: "9.9" }, "1.0")).toThrow(
      /no migration path from schema_version "9.9" to "1.0"/,
    );
  });

  it("throws on unknown legacy non-undefined version", () => {
    expect(() => migrateForward({ schema_version: "0.5" }, "1.0")).toThrow(
      /no migration path/,
    );
  });
});

describe("migrate (filesystem)", () => {
  it("backfills legacy file, skips current, fails future in one run", async () => {
    await writeDecision("d-legacy.json", VALID_SHAPE);
    await writeDecision("d-current.json", { schema_version: "1.0", ...VALID_SHAPE });
    await writeDecision("d-future.json", { schema_version: "9.9", id: "future" });

    const result = await migrate({ repoRoot: tmp });
    expect(result.migrated).toEqual(["d-legacy.json"]);
    expect(result.skipped).toEqual(["d-current.json"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.file).toBe("d-future.json");
    expect(result.failed[0]?.error).toMatch(/no migration path/);
  });

  it("rewrites legacy file with schema_version at top", async () => {
    await writeDecision("d-legacy.json", VALID_SHAPE);
    await migrate({ repoRoot: tmp });
    const after = await readDecision("d-legacy.json");
    expect(Object.keys(after)[0]).toBe("schema_version");
    expect(after["schema_version"]).toBe("1.0");
    // Other fields preserved.
    expect(after["id"]).toBe(VALID_SHAPE.id);
  });

  it("is idempotent — re-running shows nothing migrated", async () => {
    await writeDecision("d-legacy.json", VALID_SHAPE);
    await migrate({ repoRoot: tmp });
    const second = await migrate({ repoRoot: tmp });
    expect(second.migrated).toEqual([]);
    expect(second.skipped).toEqual(["d-legacy.json"]);
  });

  it("reports invalid JSON file with parse error", async () => {
    await fs.writeFile(path.join(decisionsDir, "d-bad.json"), "not json");
    const result = await migrate({ repoRoot: tmp });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.file).toBe("d-bad.json");
  });

  it("rejects JSON arrays (not an object)", async () => {
    await fs.writeFile(path.join(decisionsDir, "d-array.json"), "[1, 2, 3]");
    const result = await migrate({ repoRoot: tmp });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error).toMatch(/not a JSON object/);
  });

  it("ignores non-JSON files in the directory", async () => {
    await fs.writeFile(path.join(decisionsDir, "README.txt"), "just notes");
    const result = await migrate({ repoRoot: tmp });
    expect(result.migrated).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("returns empty result when decisions directory is missing", async () => {
    await fs.rm(decisionsDir, { recursive: true, force: true });
    const result = await migrate({ repoRoot: tmp });
    expect(result).toEqual({ migrated: [], skipped: [], failed: [] });
  });
});
