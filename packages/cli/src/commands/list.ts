import type { DecisionStatus } from "@echodev/core";
import type { Services } from "../composition.js";

export interface ListOptions {
  readonly status?: DecisionStatus;
  readonly format: "json" | "text";
}

export async function list(services: Services, opts: ListOptions): Promise<string> {
  const all = await services.repo.list();
  const filtered = opts.status ? all.filter((d) => d.status === opts.status) : all;
  if (opts.format === "json") return JSON.stringify(filtered, null, 2);
  if (filtered.length === 0) return "(no decisions)";
  return filtered
    .map((d) => `${d.status.padEnd(10)} ${d.id}  ${d.decision}`)
    .join("\n");
}
