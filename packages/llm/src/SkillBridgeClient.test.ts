import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkillBridgeClient, pruneBridgeArtifacts } from "./SkillBridgeClient.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "echodev-bridge-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function listEntries(dir: string): Promise<string[]> {
  return (await fs.readdir(dir)).sort();
}

function uniqueStamps(names: readonly string[]): Set<string> {
  return new Set(names.map((n) => n.split(".")[0]!));
}

async function seedPair(dir: string, stamp: string): Promise<void> {
  await fs.writeFile(path.join(dir, `${stamp}.request.json`), `{"stamp":"${stamp}"}`);
  await fs.writeFile(path.join(dir, `${stamp}.response.txt`), "ok");
}

describe("pruneBridgeArtifacts", () => {
  it("keeps newest N stamps and deletes older ones (15 pairs → keep 10)", async () => {
    for (let i = 0; i < 15; i += 1) {
      await seedPair(tmp, `2026-04-26T18-50-${String(i).padStart(2, "0")}-000Z`);
    }
    await pruneBridgeArtifacts(tmp);
    const remaining = await listEntries(tmp);
    expect(remaining).toHaveLength(20);
    const stamps = uniqueStamps(remaining);
    expect(stamps.size).toBe(10);
    // Oldest kept stamp should be index 5 (newest 10 of 0..14).
    const sorted = [...stamps].sort();
    expect(sorted[0]).toBe("2026-04-26T18-50-05-000Z");
    expect(sorted[sorted.length - 1]).toBe("2026-04-26T18-50-14-000Z");
  });

  it("is a no-op when stamp count <= keep", async () => {
    for (let i = 0; i < 5; i += 1) {
      await seedPair(tmp, `2026-04-26T19-00-${String(i).padStart(2, "0")}-000Z`);
    }
    await pruneBridgeArtifacts(tmp);
    const remaining = await listEntries(tmp);
    expect(remaining).toHaveLength(10);
    expect(uniqueStamps(remaining).size).toBe(5);
  });

  it("is a no-op on empty directory", async () => {
    await pruneBridgeArtifacts(tmp);
    expect(await listEntries(tmp)).toEqual([]);
  });

  it("prunes orphan response.txt by stamp pairing", async () => {
    // 11 request files + 1 isolated old response — old stamps' files should be
    // dropped together (request + orphan response).
    for (let i = 0; i < 11; i += 1) {
      const stamp = `2026-04-26T20-00-${String(i).padStart(2, "0")}-000Z`;
      await fs.writeFile(path.join(tmp, `${stamp}.request.json`), "x");
    }
    await fs.writeFile(path.join(tmp, `2026-04-26T20-00-00-000Z.response.txt`), "x");
    await pruneBridgeArtifacts(tmp);
    const remaining = await listEntries(tmp);
    expect(uniqueStamps(remaining).size).toBe(10);
    expect(remaining).not.toContain("2026-04-26T20-00-00-000Z.response.txt");
  });

  it("ignores non-bridge files", async () => {
    await fs.writeFile(path.join(tmp, "README.md"), "should not be touched");
    for (let i = 0; i < 12; i += 1) {
      await seedPair(tmp, `2026-04-26T21-00-${String(i).padStart(2, "0")}-000Z`);
    }
    await pruneBridgeArtifacts(tmp);
    const remaining = await listEntries(tmp);
    expect(remaining).toContain("README.md");
    expect(uniqueStamps(remaining.filter((n) => n !== "README.md")).size).toBe(10);
  });

  it("swallows IO errors silently (best-effort posture)", async () => {
    // pruneBridgeArtifacts on a non-existent directory should not throw.
    await expect(pruneBridgeArtifacts(path.join(tmp, "does-not-exist"))).resolves.toBeUndefined();
  });
});

describe("SkillBridgeClient.complete", () => {
  it("auto-prunes after each successful response (12 calls → cap at 10)", async () => {
    const client = new SkillBridgeClient(tmp, async (responseFile) => {
      await fs.writeFile(responseFile, '{"decisions":[]}');
      return '{"decisions":[]}';
    });
    for (let i = 0; i < 12; i += 1) {
      await client.complete({ system: "s", user: `u${i}` });
      // Bridge stamp is millisecond-precise; tiny delay avoids stamp collisions.
      await new Promise((r) => setTimeout(r, 5));
    }
    const remaining = await listEntries(tmp);
    expect(uniqueStamps(remaining).size).toBe(10);
  });
});
