import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DecisionNode, Extractor, ExtractionContext, LLMClient } from "@echodev/core";
import { runExtraction } from "./prompt.js";

const run = promisify(execFile);

export class PRExtractor implements Extractor {
  constructor(private readonly llm: LLMClient) {}

  async extract(ctx: ExtractionContext): Promise<readonly DecisionNode[]> {
    const pr = await fetchPR(ctx.repoRoot, ctx.ref);
    return runExtraction(
      this.llm,
      { subject: pr.title, body: pr.body, diff: pr.diff, files: pr.files },
      { type: "pr", ref: `#${pr.number}` },
    );
  }
}

async function fetchPR(repoRoot: string, ref: string): Promise<{
  number: number;
  title: string;
  body: string;
  files: string[];
  diff: string;
}> {
  const number = Number(ref.replace(/^#/, ""));
  if (!Number.isInteger(number)) throw new Error(`PR ref must be a number, got "${ref}"`);
  const opts = { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 };
  const { stdout: meta } = await run(
    "gh",
    ["pr", "view", String(number), "--json", "number,title,body,files"],
    opts,
  );
  const parsed = JSON.parse(meta) as {
    number: number;
    title?: string;
    body?: string;
    files: { path: string }[];
  };
  const { stdout: diff } = await run("gh", ["pr", "diff", String(number)], opts);
  return {
    number: parsed.number,
    title: parsed.title ?? "",
    body: parsed.body ?? "",
    files: parsed.files.map((f) => f.path),
    diff,
  };
}
