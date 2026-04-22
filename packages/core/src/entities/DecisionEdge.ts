export const EDGE_KINDS = [
  "inherits",
  "conflicts_with",
  "fills_gap_of",
  "shared_premise",
  "superseded_by",
] as const;

export type EdgeKind = (typeof EDGE_KINDS)[number];

export interface DecisionEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
}
