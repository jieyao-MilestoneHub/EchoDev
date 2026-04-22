import type { DecisionStatus } from "./DecisionStatus.js";

export type SourceType = "commit" | "pr" | "issue" | "manual";

export interface DecisionSource {
  readonly type: SourceType;
  readonly ref: string;
}

export interface DecisionRelations {
  readonly inherits: readonly string[];
  readonly conflicts_with: readonly string[];
  readonly fills_gap_of: readonly string[];
  readonly shared_premise: readonly string[];
  readonly superseded_by: string | null;
}

export interface FutureReminders {
  readonly who_might_repeat: string;
  readonly revisit_when: string;
}

export const CURRENT_SCHEMA_VERSION = "1.0" as const;
export type SchemaVersion = typeof CURRENT_SCHEMA_VERSION;

export interface DecisionNode {
  readonly schema_version: SchemaVersion;
  readonly id: string;
  readonly created_at: string;
  readonly status: DecisionStatus;
  readonly problem: string;
  readonly decision: string;
  readonly alternatives: readonly string[];
  readonly constraints: readonly string[];
  readonly failures: readonly string[];
  readonly expiry_conditions: readonly string[];
  readonly affected_files: readonly string[];
  readonly affected_modules: readonly string[];
  readonly relations: DecisionRelations;
  readonly future_reminders: FutureReminders;
  readonly source: DecisionSource;
}

export function emptyRelations(): DecisionRelations {
  return {
    inherits: [],
    conflicts_with: [],
    fills_gap_of: [],
    shared_premise: [],
    superseded_by: null,
  };
}
