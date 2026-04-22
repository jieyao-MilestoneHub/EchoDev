import type { DecisionNode, DecisionRelations, FutureReminders, DecisionSource } from "../entities/DecisionNode.js";
import { isDecisionStatus } from "../entities/DecisionStatus.js";

const ID_RX = /^d-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = new Set(["commit", "pr", "issue", "manual"]);

export function parseDecisionNode(raw: unknown): DecisionNode {
  const v = asObject(raw, "decision");
  const id = str(v, "id");
  if (!ID_RX.test(id)) throw new Error(`id "${id}" does not match d-YYYY-MM-DD-<slug>`);
  const created_at = str(v, "created_at");
  if (!DATE_RX.test(created_at)) throw new Error(`created_at "${created_at}" is not YYYY-MM-DD`);
  const status = str(v, "status");
  if (!isDecisionStatus(status)) throw new Error(`status "${status}" is invalid`);
  return {
    id,
    created_at,
    status,
    problem: str(v, "problem"),
    decision: str(v, "decision"),
    alternatives: strArr(v, "alternatives", true),
    constraints: strArr(v, "constraints", true),
    failures: strArr(v, "failures", true),
    expiry_conditions: strArr(v, "expiry_conditions", true),
    affected_files: strArr(v, "affected_files"),
    affected_modules: strArr(v, "affected_modules"),
    relations: parseRelations(v["relations"]),
    future_reminders: parseReminders(v["future_reminders"]),
    source: parseSource(v["source"]),
  };
}

function parseRelations(raw: unknown): DecisionRelations {
  const r = asObject(raw, "relations");
  const superseded = r["superseded_by"];
  if (superseded !== null && typeof superseded !== "string") {
    throw new Error("relations.superseded_by must be string | null");
  }
  return {
    inherits: strArr(r, "inherits", true),
    conflicts_with: strArr(r, "conflicts_with", true),
    fills_gap_of: strArr(r, "fills_gap_of", true),
    shared_premise: strArr(r, "shared_premise", true),
    superseded_by: superseded ?? null,
  };
}

function parseReminders(raw: unknown): FutureReminders {
  const r = asObject(raw, "future_reminders");
  return { who_might_repeat: str(r, "who_might_repeat"), revisit_when: str(r, "revisit_when") };
}

function parseSource(raw: unknown): DecisionSource {
  const r = asObject(raw, "source");
  const type = str(r, "type");
  if (!SOURCE_TYPES.has(type)) throw new Error(`source.type "${type}" is invalid`);
  return { type: type as DecisionSource["type"], ref: str(r, "ref") };
}

function asObject(raw: unknown, what: string): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") throw new Error(`${what} must be an object`);
  return raw as Record<string, unknown>;
}

function str(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) throw new Error(`${key} is required`);
  return v;
}

function strArr(obj: Record<string, unknown>, key: string, optional = false): readonly string[] {
  const v = obj[key];
  if (v === undefined) {
    if (optional) return [];
    throw new Error(`${key} is required`);
  }
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new Error(`${key} must be string[]`);
  }
  return v as readonly string[];
}
