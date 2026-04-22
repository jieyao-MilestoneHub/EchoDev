import type { DecisionNode, DecisionSource, LLMClient } from "@hey-echodev/core";
import { draftsToNodes, parseDraftsJson } from "./mapping.js";

export const EXTRACTION_SYSTEM = `You extract structured "decision nodes" from a code change.
Return ONLY a JSON array (no prose, no markdown fences). Each element must match this shape:

{
  "slug": "kebab-case-3-to-8-words",
  "problem": "what question the change answers",
  "decision": "the answer the change takes",
  "alternatives": ["string", ...],
  "constraints": ["string", ...],
  "failures": ["string", ...],
  "expiry_conditions": ["condition that invalidates this decision"],
  "affected_files": ["glob or path"],
  "affected_modules": ["logical module name"],
  "future_reminders": {
    "who_might_repeat": "a future reader likely to re-encounter this",
    "revisit_when":     "a signal this decision should be re-examined"
  }
}

Rules:
- One decision node per distinct design choice. Never invent choices.
- If the change contains no design choice (pure formatting, dep bumps), return [].
- future_reminders fields are MANDATORY. They convert history into a navigation system.
- expiry_conditions must be falsifiable — avoid "if requirements change".`;

interface PromptSource {
  readonly subject: string;
  readonly body: string;
  readonly diff: string;
  readonly files: readonly string[];
}

export function buildUserPrompt(p: PromptSource): string {
  return [
    `Commit subject: ${p.subject}`,
    `Commit body:\n${p.body || "(empty)"}`,
    `Changed files:\n${p.files.join("\n")}`,
    `Unified diff (may be truncated):\n${truncate(p.diff, 12_000)}`,
  ].join("\n\n");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;
}

export async function runExtraction(
  llm: LLMClient,
  source: PromptSource,
  outSource: DecisionSource,
  date?: string,
): Promise<readonly DecisionNode[]> {
  const response = await llm.complete({ system: EXTRACTION_SYSTEM, user: buildUserPrompt(source) });
  return draftsToNodes(parseDraftsJson(response.text), outSource, source.files, date);
}
