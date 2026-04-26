import { parseArgs, flagString, flagBool, type ParsedArgs } from "./args.js";
import { wire, type LlmMode } from "./composition.js";
import { init } from "./commands/init.js";
import { uninstall } from "./commands/uninstall.js";
import { migrate } from "./commands/migrate.js";
import { show } from "./commands/show.js";
import { recall } from "./commands/recall.js";
import { extract } from "./commands/extract.js";
import { check } from "./commands/check.js";
import { list } from "./commands/list.js";
import { graph } from "./commands/graph.js";
import { add } from "./commands/add.js";
import { readStdin } from "./util/io.js";
import { DEFAULT_MIN_SCORE, DEFAULT_TOP_K, isDecisionStatus } from "@hey-echodev/core";

const USAGE = `echodev — persistent design memory for Claude-assisted codebases

Usage:
  echodev init [--no-claude]
  echodev uninstall [--no-claude] [--purge]
  echodev migrate
  echodev recall [<paths...>] [--from-stdin] [--modules a,b] [--keywords x,y]
                              [--top K] [--min-score N] [--quiet] [--explain]
                              [--if-expired-block] [--format json|text]
  echodev extract <ref> [--kind commit|diff|pr|manual] [--llm auto|api|skill|null] [--force]
                        [--skill-timeout <seconds>]
  echodev add --stdin [--ref <label>]
  echodev check <diff-file>
  echodev list [--status active|superseded|expired] [--format json|text]
  echodev show <id> [--format json|text]
  echodev graph [--format mermaid|json]

Context discipline: recall defaults to --top ${DEFAULT_TOP_K} --min-score ${DEFAULT_MIN_SCORE}.
Hooks should pass --quiet so that zero-match invocations emit nothing.

All commands operate on the repository at --repo (default: cwd).
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "help" || flagBool(args, "help")) {
    process.stdout.write(USAGE);
    return;
  }
  const repoRoot = flagString(args, "repo") ?? process.cwd();
  const llmMode = flagString(args, "llm") as LlmMode | undefined;

  switch (args.command) {
    case "migrate": {
      const result = await migrate({ repoRoot });
      const lines = [
        `Migrated: ${result.migrated.length}`,
        ...result.migrated.map((n) => `  + ${n}`),
        `Skipped (already on current schema): ${result.skipped.length}`,
        `Failed: ${result.failed.length}`,
        ...result.failed.map((f) => `  ! ${f.file}: ${f.error}`),
      ];
      process.stdout.write(`${lines.join("\n")}\n`);
      if (result.failed.length > 0) process.exitCode = 2;
      return;
    }
    case "uninstall": {
      const removed = await uninstall({
        repoRoot,
        withClaude: !flagBool(args, "no-claude"),
        purge: flagBool(args, "purge"),
      });
      if (removed.length === 0) {
        process.stdout.write(`Nothing to uninstall — no echodev artifacts found.\n`);
      } else {
        process.stdout.write(`Uninstalled echodev.\nRemoved:\n  ${removed.join("\n  ")}\n`);
      }
      return;
    }
    case "init": {
      const { created, hookRecipe, hooksAlreadyInstalled } = await init({
        repoRoot,
        withClaude: !flagBool(args, "no-claude"),
      });
      let out = `Initialised echodev.\nCreated:\n  ${created.join("\n  ")}\n`;
      if (hooksAlreadyInstalled) {
        out += `\nHooks already installed in .claude/settings.json — skipping recipe.\n`;
      } else if (hookRecipe !== undefined) {
        out +=
          `\nNext step — merge into .claude/settings.json (top-level "hooks" key):\n` +
          `${hookRecipe}\n\n` +
          `Then run \`/hooks\` inside Claude Code (or restart) to activate. ` +
          `See README "Hook recipe" for details.\n`;
      }
      process.stdout.write(out);
      return;
    }
    case "recall": {
      const stdinPaths = flagBool(args, "from-stdin") ? await readPathsFromHookStdin() : [];
      const { text } = await recall(wire({ repoRoot }), {
        files: [...stdinPaths, ...args.positionals],
        modules: splitCsv(flagString(args, "modules")),
        keywords: splitCsv(flagString(args, "keywords")),
        format: (flagString(args, "format") ?? "text") as "json" | "text",
        topK: numFlag(args, "top", DEFAULT_TOP_K),
        minScore: numFlag(args, "min-score", DEFAULT_MIN_SCORE),
        quiet: flagBool(args, "quiet"),
        explain: flagBool(args, "explain"),
        ifExpiredBlock: flagBool(args, "if-expired-block"),
      });
      if (text.length > 0) process.stdout.write(`${text}\n`);
      return;
    }
    case "extract": {
      const ref = requirePositional(args, "extract", "ref");
      const skillTimeoutSec = flagString(args, "skill-timeout");
      const skillTimeoutMs =
        skillTimeoutSec === undefined ? undefined : numFlag(args, "skill-timeout", 30) * 1000;
      const out = await extract(wire({ repoRoot, llmMode, skillTimeoutMs }), {
        kind: (flagString(args, "kind") ?? "commit") as "commit" | "diff" | "pr" | "manual",
        ref,
        idempotent: !flagBool(args, "force"),
      });
      process.stdout.write(`${out}\n`);
      return;
    }
    case "add": {
      const out = await add(wire({ repoRoot }), {
        fromStdin: flagBool(args, "stdin"),
        ref: flagString(args, "ref"),
      });
      process.stdout.write(`${out}\n`);
      return;
    }
    case "check": {
      const diffPath = requirePositional(args, "check", "diff-file");
      const { output, conflictCount } = await check(wire({ repoRoot }), { diffPath });
      process.stdout.write(`${output}\n`);
      if (conflictCount > 0) process.exitCode = 2;
      return;
    }
    case "list": {
      const status = flagString(args, "status");
      if (status !== undefined && !isDecisionStatus(status)) {
        throw new Error(`invalid --status "${status}"`);
      }
      const out = await list(wire({ repoRoot }), {
        status,
        format: (flagString(args, "format") ?? "text") as "json" | "text",
      });
      process.stdout.write(`${out}\n`);
      return;
    }
    case "show": {
      const id = requirePositional(args, "show", "id");
      const out = await show(wire({ repoRoot }), {
        id,
        format: (flagString(args, "format") ?? "text") as "json" | "text",
      });
      process.stdout.write(`${out}\n`);
      return;
    }
    case "graph": {
      const out = await graph(wire({ repoRoot }), {
        format: (flagString(args, "format") ?? "mermaid") as "mermaid" | "json",
      });
      process.stdout.write(`${out}\n`);
      return;
    }
    default:
      process.stderr.write(`Unknown command: ${args.command}\n${USAGE}`);
      process.exitCode = 1;
  }
}

function requirePositional(args: ParsedArgs, command: string, name: string): string {
  const value = args.positionals[0];
  if (value === undefined) throw new Error(`${command} requires a <${name}>`);
  return value;
}

function splitCsv(value: string | undefined): readonly string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function numFlag(args: ParsedArgs, key: string, fallback: number): number {
  const raw = flagString(args, key);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`--${key} must be a number, got "${raw}"`);
  return n;
}

// Reads Claude Code's documented hook input — JSON on stdin with a
// `tool_input.file_path` field (see https://code.claude.com/docs/en/hooks-guide).
// Stays silent on missing/invalid input so a contract drift becomes a no-op
// rather than a crash; the user notices via empty recall output.
async function readPathsFromHookStdin(): Promise<readonly string[]> {
  if (process.stdin.isTTY) return [];
  try {
    const raw = await readStdin();
    if (raw.trim().length === 0) return [];
    const parsed = JSON.parse(raw) as { tool_input?: { file_path?: unknown } };
    const fp = parsed.tool_input?.file_path;
    return typeof fp === "string" && fp.length > 0 ? [fp] : [];
  } catch {
    return [];
  }
}

main().catch((err) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
