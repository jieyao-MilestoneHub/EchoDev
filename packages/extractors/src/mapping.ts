import {
  CURRENT_SCHEMA_VERSION,
  type DecisionNode,
  type DecisionSource,
  emptyRelations,
  makeDecisionId,
  slugify,
  todayIso,
} from "@hey-echodev/core";

export interface DraftNode {
  readonly slug: string;
  readonly problem: string;
  readonly decision: string;
  readonly alternatives?: readonly string[];
  readonly constraints?: readonly string[];
  readonly failures?: readonly string[];
  readonly expiry_conditions?: readonly string[];
  readonly affected_files?: readonly string[];
  readonly affected_modules?: readonly string[];
  readonly future_reminders?: { who_might_repeat?: string; revisit_when?: string };
}

export function draftsToNodes(
  drafts: readonly DraftNode[],
  source: DecisionSource,
  defaultFiles: readonly string[],
  date: string = todayIso(),
): readonly DecisionNode[] {
  return drafts.map((draft, i) => {
    const files = draft.affected_files?.length ? draft.affected_files : defaultFiles;
    return {
      schema_version: CURRENT_SCHEMA_VERSION,
      id: makeDecisionId(date, slugify(draft.slug || draft.problem), i + 1),
      created_at: date,
      status: "active",
      problem: draft.problem,
      decision: draft.decision,
      alternatives: draft.alternatives ?? [],
      constraints: draft.constraints ?? [],
      failures: draft.failures ?? [],
      expiry_conditions: draft.expiry_conditions ?? [],
      affected_files: files,
      affected_modules: draft.affected_modules?.length
        ? draft.affected_modules
        : deriveModules(files),
      relations: emptyRelations(),
      future_reminders: {
        who_might_repeat:
          draft.future_reminders?.who_might_repeat ?? "future editor of the same module",
        revisit_when: draft.future_reminders?.revisit_when ?? "constraints above no longer hold",
      },
      source,
    };
  });
}

function deriveModules(files: readonly string[]): readonly string[] {
  return [
    ...new Set(
      files
        .map((f) => f.replace(/\\/g, "/").split("/").find((s) => s && !s.startsWith("*")))
        .filter((m): m is string => m !== undefined),
    ),
  ];
}

export function parseDraftsJson(text: string): readonly DraftNode[] {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const json = (match?.[1] ?? text).trim();
  if (json.length === 0) return [];
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Expected top-level JSON array of drafts");
  return parsed as DraftNode[];
}
