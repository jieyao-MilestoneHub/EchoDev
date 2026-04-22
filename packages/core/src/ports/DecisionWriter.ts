import type { DecisionNode } from "../entities/DecisionNode.js";

export interface DecisionWriter {
  put(node: DecisionNode): Promise<void>;
  remove(id: string): Promise<void>;
}
