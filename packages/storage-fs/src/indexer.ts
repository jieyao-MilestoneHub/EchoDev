import { DecisionGraph, type DecisionNode, type DecisionEdge } from "@hey-echodev/core";

export interface IndexBundle {
  readonly byFile: Record<string, string[]>;
  readonly byModule: Record<string, string[]>;
  readonly graph: { nodes: string[]; edges: DecisionEdge[] };
}

export function buildIndexes(nodes: readonly DecisionNode[]): IndexBundle {
  const byFile: Record<string, string[]> = {};
  const byModule: Record<string, string[]> = {};
  for (const node of nodes) {
    for (const pattern of node.affected_files) (byFile[pattern] ??= []).push(node.id);
    for (const mod of node.affected_modules) (byModule[mod] ??= []).push(node.id);
  }
  return {
    byFile,
    byModule,
    graph: { nodes: nodes.map((n) => n.id), edges: [...new DecisionGraph(nodes).edges()] },
  };
}
