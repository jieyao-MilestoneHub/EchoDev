import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { init } from "./init.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "echodev-init-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("init", () => {
  it("creates .echodev/ structure", async () => {
    const result = await init({ repoRoot: tmp, withClaude: false });
    expect(existsSync(path.join(tmp, ".echodev", "decisions"))).toBe(true);
    expect(existsSync(path.join(tmp, ".echodev", "index"))).toBe(true);
    expect(existsSync(path.join(tmp, ".echodev", "bridge"))).toBe(true);
    expect(existsSync(path.join(tmp, ".echodev", "decisions", ".gitkeep"))).toBe(true);
    expect(existsSync(path.join(tmp, ".echodev", ".gitignore"))).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
  });

  it("does not create sidecar file (Issue #1: drop sidecar)", async () => {
    await init({ repoRoot: tmp, withClaude: true });
    expect(existsSync(path.join(tmp, ".claude", "echodev.hooks.snippet.json"))).toBe(false);
  });

  it("with withClaude=true creates .claude/skills/ but does not touch settings.json", async () => {
    await init({ repoRoot: tmp, withClaude: true });
    expect(existsSync(path.join(tmp, ".claude", "skills"))).toBe(true);
    expect(existsSync(path.join(tmp, ".claude", "settings.json"))).toBe(false);
  });

  it("with withClaude=false does not create .claude/", async () => {
    await init({ repoRoot: tmp, withClaude: false });
    expect(existsSync(path.join(tmp, ".claude"))).toBe(false);
  });

  it("returns hookRecipe containing the documented stdin contract and CLI guard", async () => {
    const result = await init({ repoRoot: tmp, withClaude: true });
    expect(result.hookRecipe).toBeDefined();
    const recipe = result.hookRecipe!;
    // Issue #4: stdin-JSON contract via --from-stdin
    expect(recipe).toContain("--from-stdin");
    // Issue #2: command -v guard so missing CLI is silent
    expect(recipe).toContain("command -v echodev");
    // Hook events present
    expect(recipe).toContain("PreToolUse");
    expect(recipe).toContain("Stop");
    // Edit/MultiEdit matcher and idempotent extract
    expect(recipe).toContain("Edit|MultiEdit");
    expect(recipe).toContain("echodev extract HEAD");
  });

  it("hookRecipe is parseable JSON whose hooks.* arrays are well-formed", async () => {
    const { hookRecipe } = await init({ repoRoot: tmp, withClaude: true });
    expect(hookRecipe).toBeDefined();
    const parsed = JSON.parse(hookRecipe!) as {
      hooks: Record<string, { matcher?: string; hooks: { type: string; command: string }[] }[]>;
    };
    expect(Array.isArray(parsed.hooks.PreToolUse)).toBe(true);
    expect(parsed.hooks.PreToolUse[0]?.matcher).toBe("Edit|MultiEdit");
    expect(parsed.hooks.PreToolUse[0]?.hooks[0]?.type).toBe("command");
    expect(Array.isArray(parsed.hooks.Stop)).toBe(true);
  });

  it("hooksAlreadyInstalled=false on a fresh repo, recipe printed", async () => {
    const result = await init({ repoRoot: tmp, withClaude: true });
    expect(result.hooksAlreadyInstalled).toBe(false);
    expect(result.hookRecipe).toBeDefined();
  });

  it("hooksAlreadyInstalled=true when settings.json mentions \"echodev recall\"", async () => {
    await fs.mkdir(path.join(tmp, ".claude"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Edit|MultiEdit",
              hooks: [{ type: "command", command: "echodev recall --from-stdin" }],
            },
          ],
        },
      }),
    );
    const result = await init({ repoRoot: tmp, withClaude: true });
    expect(result.hooksAlreadyInstalled).toBe(true);
    expect(result.hookRecipe).toBeUndefined();
  });

  it("withClaude=false produces no hookRecipe regardless of settings.json", async () => {
    const result = await init({ repoRoot: tmp, withClaude: false });
    expect(result.hookRecipe).toBeUndefined();
    expect(result.hooksAlreadyInstalled).toBe(false);
  });

  it("is idempotent — running twice does not error or duplicate", async () => {
    const first = await init({ repoRoot: tmp, withClaude: true });
    const second = await init({ repoRoot: tmp, withClaude: true });
    expect(second.created).toEqual(first.created);
  });
});
