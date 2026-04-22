export const DECISION_STATUSES = ["active", "superseded", "expired"] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export function isDecisionStatus(value: unknown): value is DecisionStatus {
  return typeof value === "string" && (DECISION_STATUSES as readonly string[]).includes(value);
}
