import { describe, expect, it } from "vitest";
import { parseArgs, flagBool, flagString } from "./args.js";

describe("parseArgs", () => {
  it("defaults to help when argv is empty", () => {
    const args = parseArgs([]);
    expect(args.command).toBe("help");
    expect(args.positionals).toEqual([]);
  });

  it("treats first positional as command", () => {
    const args = parseArgs(["init"]);
    expect(args.command).toBe("init");
    expect(args.positionals).toEqual([]);
  });

  it("collects subsequent positionals", () => {
    const args = parseArgs(["recall", "src/a.ts", "src/b.ts"]);
    expect(args.command).toBe("recall");
    expect(args.positionals).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("parses --flag=value (equals syntax)", () => {
    const args = parseArgs(["recall", "--format=json"]);
    expect(flagString(args, "format")).toBe("json");
  });

  it("parses --flag value (space syntax) for value flags", () => {
    const args = parseArgs(["recall", "--top", "5", "--format", "json"]);
    expect(flagString(args, "top")).toBe("5");
    expect(flagString(args, "format")).toBe("json");
  });

  it("does not consume next positional for boolean flags (Issue #11)", () => {
    const args = parseArgs(["recall", "--from-stdin", "src/foo.ts"]);
    expect(flagBool(args, "from-stdin")).toBe(true);
    expect(args.positionals).toEqual(["src/foo.ts"]);
  });

  it("multiple boolean flags adjacent", () => {
    const args = parseArgs(["recall", "--from-stdin", "--quiet", "--explain"]);
    expect(flagBool(args, "from-stdin")).toBe(true);
    expect(flagBool(args, "quiet")).toBe(true);
    expect(flagBool(args, "explain")).toBe(true);
  });

  it("boolean flag followed by another flag (no greedy consumption)", () => {
    const args = parseArgs(["recall", "--from-stdin", "--top", "3"]);
    expect(flagBool(args, "from-stdin")).toBe(true);
    expect(flagString(args, "top")).toBe("3");
  });

  it("boolean flag at end of argv sets true", () => {
    const args = parseArgs(["init", "--no-claude"]);
    expect(flagBool(args, "no-claude")).toBe(true);
  });

  it("value flag at end of argv (no value) sets true", () => {
    const args = parseArgs(["recall", "--format"]);
    expect(args.flags.get("format")).toBe(true);
  });

  it("flagBool returns false for unset flag", () => {
    const args = parseArgs(["recall"]);
    expect(flagBool(args, "from-stdin")).toBe(false);
  });

  it("flagString returns undefined for unset flag", () => {
    const args = parseArgs(["recall"]);
    expect(flagString(args, "format")).toBeUndefined();
  });

  it("flagBool ignores string-valued flags", () => {
    const args = parseArgs(["recall", "--top=5"]);
    expect(flagBool(args, "top")).toBe(false);
  });
});
