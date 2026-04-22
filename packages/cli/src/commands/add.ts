import { draftsToNodes, type DraftNode } from "@hey-echodev/extractors";
import type { Services } from "../composition.js";
import { readStdin } from "../util/io.js";

export interface AddOptions {
  readonly fromStdin: boolean;
  readonly ref?: string;
}

export async function add(services: Services, opts: AddOptions): Promise<string> {
  if (!opts.fromStdin) {
    return "echodev add reads a JSON array of drafts from stdin. Pass --stdin.";
  }
  const drafts = JSON.parse(await readStdin()) as DraftNode[];
  const files = [...new Set(drafts.flatMap((d) => d.affected_files ?? []))];
  const nodes = draftsToNodes(drafts, { type: "manual", ref: opts.ref ?? "cli" }, files);
  for (const node of nodes) await services.repo.put(node);
  return nodes.map((n) => `+ ${n.id}`).join("\n") || "(no drafts)";
}
