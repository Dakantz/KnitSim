import {
  KnitEdge,
  KnitEdgeDirection,
  KnitGraph,
  KnitNode,
  KnitNodeType,
  KnitSide,
  type YarnSpec,
} from "@/knitgraph";

export type GraphNodeSnapshot = {
  id: number;
  lineNumber: number;
  rowNumber: number;
  colNumber: number;
  type: KnitNodeType;
  color: number | string;
  weight: number;
  startOfRow: boolean;
  side: KnitSide;
  previousNodeId: number | null;
};

export type GraphEdgeSnapshot = {
  from: number;
  to: number;
  direction: KnitEdgeDirection;
};

export type GraphSnapshot = {
  nodes: GraphNodeSnapshot[];
  edges: GraphEdgeSnapshot[];
};

export const graphToSnapshot = (graph: KnitGraph): GraphSnapshot => {
  const nodes = Object.values(graph.nodes).map((node) => ({
    id: node.id,
    lineNumber: node.line_number,
    rowNumber: node.row_number,
    colNumber: node.col_number,
    type: node.type,
    color: node.yarnSpec.color,
    weight: node.yarnSpec.weight,
    startOfRow: node.start_of_row,
    side: node.side,
    previousNodeId: node.previous_node?.id ?? null,
  }));

  const edges = graph.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    direction: edge.direction,
  }));

  return { nodes, edges };
};

export const snapshotToGraph = (snapshot: GraphSnapshot): KnitGraph => {
  const graph = new KnitGraph();
  graph.nodes = {};
  graph.edges = [];

  const previousByNodeId = new Map<number, number | null>();

  for (const node of snapshot.nodes) {
    const yarn = {
      color: node.color,
      weight: node.weight,
    } as YarnSpec;

    const knitNode = new KnitNode(node.type, yarn, node.startOfRow, node.side, node.id);
    knitNode.line_number = node.lineNumber;
    knitNode.row_number = node.rowNumber;
    knitNode.col_number = node.colNumber;

    graph.nodes[knitNode.id] = knitNode;
    previousByNodeId.set(node.id, node.previousNodeId);
  }

  for (const [id, previousNodeId] of previousByNodeId) {
    if (previousNodeId !== null && graph.nodes[id] && graph.nodes[previousNodeId]) {
      graph.nodes[id].previous_node = graph.nodes[previousNodeId];
    }
  }

  graph.edges = snapshot.edges.map((edge) => new KnitEdge(edge.from, edge.to, edge.direction));
  return graph;
};
