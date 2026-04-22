import type { DecisionNode } from "../entities/DecisionNode.js";
import { type DecisionEdge, type EdgeKind } from "../entities/DecisionEdge.js";

export class DecisionGraph {
  private readonly byId: Map<string, DecisionNode>;
  private readonly outgoing: Map<string, Set<string>>;
  private readonly incoming: Map<string, Set<string>>;

  constructor(nodes: readonly DecisionNode[]) {
    this.byId = new Map(nodes.map((node) => [node.id, node]));
    this.outgoing = new Map();
    this.incoming = new Map();
    for (const node of nodes) this.indexEdges(node);
  }

  nodes(): readonly DecisionNode[] {
    return Array.from(this.byId.values());
  }

  get(id: string): DecisionNode | undefined {
    return this.byId.get(id);
  }

  edges(): readonly DecisionEdge[] {
    const out: DecisionEdge[] = [];
    for (const node of this.byId.values()) {
      pushMany(out, node.id, node.relations.inherits, "inherits");
      pushMany(out, node.id, node.relations.conflicts_with, "conflicts_with");
      pushMany(out, node.id, node.relations.fills_gap_of, "fills_gap_of");
      pushMany(out, node.id, node.relations.shared_premise, "shared_premise");
      if (node.relations.superseded_by !== null) {
        out.push({ from: node.id, to: node.relations.superseded_by, kind: "superseded_by" });
      }
    }
    return out;
  }

  // Bidirectional: if B inherits A, touching A must surface B.
  neighbours(id: string): readonly DecisionNode[] {
    const ids = new Set<string>([
      ...(this.outgoing.get(id) ?? []),
      ...(this.incoming.get(id) ?? []),
    ]);
    return Array.from(ids)
      .map((n) => this.byId.get(n))
      .filter((n): n is DecisionNode => n !== undefined);
  }

  private indexEdges(node: DecisionNode): void {
    const targets = [
      ...node.relations.inherits,
      ...node.relations.conflicts_with,
      ...node.relations.fills_gap_of,
      ...node.relations.shared_premise,
    ];
    if (node.relations.superseded_by !== null) targets.push(node.relations.superseded_by);
    for (const target of targets) {
      addTo(this.outgoing, node.id, target);
      addTo(this.incoming, target, node.id);
    }
  }
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
  const existing = map.get(key);
  if (existing === undefined) map.set(key, new Set([value]));
  else existing.add(value);
}

function pushMany(out: DecisionEdge[], from: string, tos: readonly string[], kind: EdgeKind): void {
  for (const to of tos) out.push({ from, to, kind });
}
