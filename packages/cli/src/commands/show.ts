import type { DecisionNode } from "@hey-echodev/core";
import type { Services } from "../composition.js";

const ID_RX = /^d-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

export interface ShowOptions {
  readonly id: string;
  readonly format: "json" | "text";
}

export async function show(services: Services, opts: ShowOptions): Promise<string> {
  if (!ID_RX.test(opts.id)) {
    throw new Error(`invalid decision id "${opts.id}"; expected d-YYYY-MM-DD-<slug>`);
  }
  const node = await services.repo.get(opts.id);
  if (node === undefined) {
    throw new Error(`decision "${opts.id}" not found`);
  }
  return opts.format === "json" ? JSON.stringify(node, null, 2) : renderText(node);
}

function renderText(n: DecisionNode): string {
  const lines: string[] = [
    `${n.id}    [${n.status}]    created ${n.created_at}    schema ${n.schema_version}`,
    "",
    `problem:   ${n.problem}`,
    `decision:  ${n.decision}`,
  ];
  pushList(lines, "alternatives", n.alternatives);
  pushList(lines, "constraints", n.constraints);
  pushList(lines, "failures", n.failures);
  pushList(lines, "expires-if", n.expiry_conditions);
  pushList(lines, "affected_files", n.affected_files);
  pushList(lines, "affected_modules", n.affected_modules);

  lines.push("", "relations:");
  pushList(lines, "  inherits", n.relations.inherits);
  pushList(lines, "  conflicts_with", n.relations.conflicts_with);
  pushList(lines, "  fills_gap_of", n.relations.fills_gap_of);
  pushList(lines, "  shared_premise", n.relations.shared_premise);
  lines.push(`  superseded_by: ${n.relations.superseded_by ?? "—"}`);

  lines.push(
    "",
    "future_reminders:",
    `  who_might_repeat: ${n.future_reminders.who_might_repeat}`,
    `  revisit_when:     ${n.future_reminders.revisit_when}`,
    "",
    `source: ${n.source.type} ${n.source.ref}`,
  );
  return lines.join("\n");
}

function pushList(lines: string[], label: string, items: readonly string[]): void {
  if (items.length === 0) return;
  lines.push(`${label}:`);
  for (const item of items) lines.push(`  - ${item}`);
}
