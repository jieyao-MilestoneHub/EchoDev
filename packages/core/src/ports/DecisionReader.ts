import type { DecisionNode } from "../entities/DecisionNode.js";

export interface DecisionReader {
  list(): Promise<readonly DecisionNode[]>;
  get(id: string): Promise<DecisionNode | undefined>;
}
