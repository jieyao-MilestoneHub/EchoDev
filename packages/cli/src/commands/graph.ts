import { DecisionGraph } from "@hey-echodev/core";
import type { Services } from "../composition.js";

export interface GraphOptions {
  readonly format: "mermaid" | "json";
}

export async function graph(services: Services, opts: GraphOptions): Promise<string> {
  const nodes = await services.repo.list();
  const g = new DecisionGraph(nodes);
  if (opts.format === "json") {
    return JSON.stringify({ nodes: nodes.map((n) => n.id), edges: g.edges() }, null, 2);
  }
  return renderMermaid(g);
}

function renderMermaid(g: DecisionGraph): string {
  const lines = ["graph TD"];
  for (const node of g.nodes()) {
    const label = short(node.decision);
    lines.push(`  ${safeId(node.id)}["${node.id}\\n${label}"]`);
  }
  for (const edge of g.edges()) {
    lines.push(`  ${safeId(edge.from)} -- ${edge.kind} --> ${safeId(edge.to)}`);
  }
  return lines.join("\n");
}

function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function short(text: string): string {
  const trimmed = text.replace(/"/g, "'").replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}
