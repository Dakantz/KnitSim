import { KnitGraph } from "@/knitgraph";
import { graphToSnapshot, type GraphSnapshot } from "@/knitgraph/snapshot";

export const executeCodeToSnapshot = (code: string): GraphSnapshot => {
  const graph = new KnitGraph();
  graph.execute(code);
  return graphToSnapshot(graph);
};

export const normalizeHexColor = (value: number | string): string => {
  if (typeof value === "string") {
    return value;
  }

  const normalized = Math.max(0, Math.min(0xffffff, Math.trunc(value)));
  return `#${normalized.toString(16).padStart(6, "0")}`;
};
