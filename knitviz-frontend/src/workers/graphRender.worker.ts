/// <reference lib="webworker" />

import type { MainModule } from "@/knitgraph/sim/knitsim-lib";
import KnitSimLib from "@/knitgraph/sim/knitsim-lib";
import { KnitEdgeDirection, KnitNodeType, KnitSide } from "@/knitgraph";
import type { GraphSnapshot } from "@/knitgraph/snapshot";
import { GraphWorkerMessageType, type GraphWorkerRequest, type GraphWorkerResponse, type WorkerNodeState } from "@/knitgraph/workerProtocol";
import type { KnitGraphC, KnitSim, Vector3f, Vector3fVector } from "@/knitgraph/sim/knitsim-lib";

type InitMessage = Extract<GraphWorkerRequest, { type: GraphWorkerMessageType.Init }>;

type WorkerGraphContext = {
  snapshot: GraphSnapshot;
  graph: KnitGraphC;
  sim: KnitSim;
  cfg: {
    yarn_thickness: number;
  };
};

const defaultGraphConfig = {
  step_size_x: 0.5,
  step_size_y: 1,
  offset_bidirectional: 0.1,
  offset_purl: 0.4,
  offset_knit: -0.3,
  yarn_thickness: 0.03,
};

const STABLE_DELTA_EPSILON = 1e-6;
const MIN_SIM_STEPS_BEFORE_AUTO_STOP = 10;

let modulePromise: Promise<MainModule> | null = null;
let activeRunId = 0;
let simTimer: ReturnType<typeof setInterval> | null = null;
let simStep = 0;
let activeContext: WorkerGraphContext | null = null;

const initializeRun = async (message: InitMessage) => {
  try {
    activeRunId = message.runId;
    disposeContext();

    const knitSim = await getKnitSimLib();
    if (!isActiveRun(message.runId)) {
      return;
    }

    activeContext = createContext(knitSim, message.snapshot);
    if (!isActiveRun(message.runId) || !activeContext) {
      return;
    }

    const nodeStates = getNodeStatesFromContext(activeContext);
    sendMessage({
      type: GraphWorkerMessageType.Ready,
      runId: message.runId,
      nodeStates,
    });
  } catch (error) {
    emitError(message.runId, error, "Failed to initialize graph worker");
  }
};

const emitError = (runId: number, error: unknown, fallbackMessage: string) => {
  sendMessage({
    type: GraphWorkerMessageType.Error,
    runId,
    message: error instanceof Error ? error.message : fallbackMessage,
  });
};

const cancelRun = (runId: number) => {
  if (!isActiveRun(runId)) {
    return;
  }

  disposeContext();
  sendMessage({
    type: GraphWorkerMessageType.Canceled,
    runId,
  });
};

const getKnitSimLib = async (): Promise<MainModule> => {
  if (!modulePromise) {
    modulePromise = KnitSimLib({}) as Promise<MainModule>;
  }
  return modulePromise;
};

const clearSimTimer = () => {
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
};

const createContext = (knitSim: MainModule, snapshot: GraphSnapshot): WorkerGraphContext => {
  const nodeVector = new knitSim.NodeVector();
  const edgeVector = new knitSim.EdgeVector();

  for (const node of snapshot.nodes) {
    nodeVector.push_back({
      id: node.id,
      line_number: node.lineNumber,
      row_number: node.rowNumber,
      col_number: node.colNumber,
      start_of_row: node.startOfRow,
      previous_node_id: node.previousNodeId ?? -1,
      type: toNodeType(knitSim, node.type),
      mode: knitSim.KnitModeC.KnitModeC_FLAT,
      side: toSide(knitSim, node.side),
      position: new knitSim.Vector3f(0, 0, 0),
      normal: new knitSim.Vector3f(0, 0, 0),
      next_dir: new knitSim.Vector3f(0, 0, 0),
    });
  }

  for (let id = 0; id < snapshot.edges.length; id += 1) {
    const edge = snapshot.edges[id];
    edgeVector.push_back({
      from: edge.from,
      to: edge.to,
      direction: toEdgeDirection(knitSim, edge.direction),
      id,
    });
  }

  const cfg = {
    ...defaultGraphConfig,
    up_vector: new knitSim.Vector3f(1, 0, 0),
    right_vector: new knitSim.Vector3f(0, 0, 1),
  };

  const graph = new knitSim.KnitGraphC(cfg, nodeVector, edgeVector);
  const sim = new knitSim.KnitSim(graph, {
    f_expansion_factor: 0.8,
    f_flattening_factor: 0.4,
    f_repel_factor: 0.05,
    offset_scaler: 0.7,
  });

  graph.computeHeuristicLayout();
  graph.calculateNormals();
  graph.computeKnitPaths();

  return {
    snapshot,
    graph,
    sim,
    cfg: {
      yarn_thickness: defaultGraphConfig.yarn_thickness,
    },
  };
};

const disposeContext = () => {
  clearSimTimer();

  if (activeContext?.sim) {
    activeContext.sim.delete();
  }
  if (activeContext?.graph) {
    activeContext.graph.delete();
  }

  activeContext = null;
  simStep = 0;
};

const getNodeStatesFromContext = (context: WorkerGraphContext): WorkerNodeState[] => {
  const toVec3 = (vector: Vector3f) => ({
    x: vector.x,
    y: vector.y,
    z: vector.z,
  });

  const toPath = (knitPath: Vector3fVector) => {
    try {
      return Array.from({ length: knitPath.size() }, (_, index) => {
        const vector = knitPath.get(index);
        if (!vector) {
          return {
            x: 0,
            y: 0,
            z: 0,
          };
        }

        return toVec3(vector);
      });
    } finally {
      knitPath.delete();
    }
  };

  return context.snapshot.nodes.map((nodeSnapshot) => {
    const node = context.graph.getNode(nodeSnapshot.id);
    const force = context.sim.force(nodeSnapshot.id);
    const knitPath = context.graph.knitPath(nodeSnapshot.id);

    try {
      return {
        id: nodeSnapshot.id,
        position: toVec3(node.position),
        normal: toVec3(node.normal),
        force: toVec3(force),
        knitPath: toPath(knitPath),
      };
    } finally {
      force.delete();
    }
  });
};

const startSimulation = (runId: number, timeStep: number) => {
  if (!activeContext || activeRunId !== runId) {
    return;
  }

  clearSimTimer();
  simStep = 0;
  let lastTime = Date.now();

  simTimer = setInterval(() => {
    if (!activeContext || activeRunId !== runId) {
      return;
    }

    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const accDelta = activeContext.sim.step(dt, 0.1, 0.2);
    activeContext.graph.computeKnitPaths();

    simStep += 1;
    const nodeStates = getNodeStatesFromContext(activeContext);

    sendMessage({
      type: GraphWorkerMessageType.SimulationStep,
      runId,
      step: simStep,
      accDelta,
      nodeStates,
    });

    const nodeCount = Math.max(1, activeContext.snapshot.nodes.length);
    const avgDelta = accDelta / nodeCount;
    if (avgDelta < STABLE_DELTA_EPSILON && simStep > MIN_SIM_STEPS_BEFORE_AUTO_STOP) {
      clearSimTimer();
      sendMessage({
        type: GraphWorkerMessageType.SimStopped,
        runId,
        step: simStep,
      });
    }
  }, timeStep);
};

const stopSimulation = (runId: number) => {
  if (!isActiveRun(runId)) {
    return;
  }

  clearSimTimer();
  sendMessage({
    type: GraphWorkerMessageType.SimStopped,
    runId,
    step: simStep,
  });
};

self.onmessage = async (event: MessageEvent<GraphWorkerRequest>) => {
  await handleWorkerMessage(event.data);
};

const handleWorkerMessage = async (message: GraphWorkerRequest) => {
  switch (message.type) {
    case GraphWorkerMessageType.Cancel: {
      cancelRun(message.runId);
      return;
    }
    case GraphWorkerMessageType.StopSim: {
      stopSimulation(message.runId);
      return;
    }
    case GraphWorkerMessageType.StartSim: {
      startSimulation(message.runId, message.timeStep);
      return;
    }
    case GraphWorkerMessageType.Init: {
      await initializeRun(message);
      return;
    }
    default: {
      const neverMessage: never = message;
      throw new Error(`Unsupported worker message: ${JSON.stringify(neverMessage)}`);
    }
  }
};

const sendMessage = (message: GraphWorkerResponse) => {
  self.postMessage(message);
};


const toNodeType = (knitSim: MainModule, type: KnitNodeType) => {
  return knitSim.KnitNodeTypeC[`KnitNodeTypeC_${type}` as keyof typeof knitSim.KnitNodeTypeC];
};

const toEdgeDirection = (knitSim: MainModule, direction: KnitEdgeDirection) => {
  return knitSim.KnitEdgeDirectionC[
    `KnitEdgeDirectionC_${direction}` as keyof typeof knitSim.KnitEdgeDirectionC
  ];
};

const toSide = (knitSim: MainModule, side: KnitSide) => {
  return knitSim.KnitSideC[`KnitSideC_${side}` as keyof typeof knitSim.KnitSideC];
};

const isActiveRun = (runId: number) => {
  return runId === activeRunId;
};

