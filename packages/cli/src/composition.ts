import * as path from "node:path";
import { FileDecisionRepository } from "@echodev/storage-fs";
import { ContextAwareRetriever } from "@echodev/retriever";
import { CommitExtractor, DiffExtractor, PRExtractor, ManualExtractor } from "@echodev/extractors";
import { ClaudeApiClient, NullLLMClient, SkillBridgeClient } from "@echodev/llm";
import type { LLMClient, Extractor } from "@echodev/core";
import { readStdin, waitForFile } from "./util/io.js";

export type LlmMode = "auto" | "api" | "skill" | "null";

export interface Services {
  readonly repo: FileDecisionRepository;
  readonly retriever: ContextAwareRetriever;
  readonly repoRoot: string;
  readonly llm: LLMClient;
}

export interface WireOptions {
  readonly repoRoot: string;
  readonly llmMode?: LlmMode;
}

export function wire(opts: WireOptions): Services {
  const repo = new FileDecisionRepository(opts.repoRoot);
  return {
    repo,
    retriever: new ContextAwareRetriever(repo),
    repoRoot: opts.repoRoot,
    llm: buildLLM(opts),
  };
}

function buildLLM(opts: WireOptions): LLMClient {
  const mode = opts.llmMode ?? "auto";
  const key = process.env["ANTHROPIC_API_KEY"];
  const resolved: LlmMode = mode === "auto" ? (key ? "api" : "skill") : mode;

  if (resolved === "null") return new NullLLMClient();
  if (resolved === "skill") {
    return new SkillBridgeClient(
      path.join(opts.repoRoot, ".echodev", "bridge"),
      (file) => waitForFile(file, 5 * 60_000),
    );
  }
  if (resolved === "api") {
    if (!key) throw new Error("ANTHROPIC_API_KEY is required for --llm api");
    return new ClaudeApiClient({
      apiKey: key,
      model: process.env["ECHODEV_MODEL"] ?? "claude-opus-4-7",
    });
  }
  throw new Error(`Unknown --llm mode: "${mode}" (expected auto|api|skill|null)`);
}

export function extractorFor(kind: string, llm: LLMClient): Extractor {
  switch (kind) {
    case "commit": return new CommitExtractor(llm);
    case "diff":   return new DiffExtractor(llm);
    case "pr":     return new PRExtractor(llm);
    case "manual": return new ManualExtractor(readStdin);
  }
  throw new Error(`Unknown extractor: ${kind}`);
}
