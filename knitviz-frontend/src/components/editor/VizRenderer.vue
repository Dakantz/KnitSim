<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from "vue";
import { snapshotToGraph, type GraphSnapshot } from "@/knitgraph/snapshot";
import { PatternViz3D } from "@/knitgraph/3d/viz";
import { GraphWorkerMessageType, type GraphWorkerRequest, type GraphWorkerResponse, type WorkerNodeState } from "@/knitgraph/workerProtocol";
import type { VizStatus } from "@/components/editor/editor.types";

const initialStatus: VizStatus = {
  isLoading: false,
  isReady: false,
  isRunning: false,
  isCancelling: false,
  isSimulationStopping: false,
  step: 0,
  accDelta: 0,
};

const CANCEL_TIMEOUT_MS = 800;

const emit = defineEmits<{
  (e: "status", payload: VizStatus): void;
  (e: "viz-ready", payload: PatternViz3D): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

const hostId = `pattern_viz_${Math.random().toString(36).slice(2, 9)}`;
const resizeObserver = ref<ResizeObserver | null>(null);
const graphWorker = shallowRef<Worker | null>(null);
const isMounted = ref(false);
const viz = shallowRef<PatternViz3D | null>(null);
const cancelTimeoutId = ref<number | null>(null);
      
const runId = ref(0);
const currentRunSnapshot = shallowRef<GraphSnapshot | null>(null);
const pendingSnapshot = shallowRef<GraphSnapshot | null>(null);

const status = reactive<VizStatus>({ ...initialStatus });

const emitStatus = () => {
  emit("status", {
    isLoading: status.isLoading,
    isReady: status.isReady,
    isRunning: status.isRunning,
    isCancelling: status.isCancelling,
    isSimulationStopping: status.isSimulationStopping,
    step: status.step,
    accDelta: status.accDelta,
  });
};

onMounted(() => {
  isMounted.value = true;

  if (!containerRef.value) {
    return;
  }

  resizeObserver.value = new ResizeObserver(() => {
    resize();
  });

  resizeObserver.value.observe(containerRef.value);
  emitStatus();

  if (pendingSnapshot.value) {
    const queued = pendingSnapshot.value;
    pendingSnapshot.value = null;
    startRun(queued);
  }
});

const startRun = (snapshot: GraphSnapshot) => {
  if (snapshot.nodes.length === 0) {
    resetStatus();
    return;
  }

  if (!isMounted.value) {
    pendingSnapshot.value = cloneSnapshot(snapshot);
    return;
  }

  runId.value += 1;
  currentRunSnapshot.value = cloneSnapshot(snapshot);
  dispose();

  setStatusLoading();

  try {
    ensureWorker();
  } catch {
    const snapshot = currentRunSnapshot.value;
    if (!snapshot) {
      resetStatus();
      return;
    }

    void createRendererWithoutWorker(snapshot).then((isRendererReady) => {
      if (!isRendererReady) {
        resetStatus();
        return;
      }

      setStatusReady();
    });

    return;
  }

  postToWorker({
    type: GraphWorkerMessageType.Init,
    runId: runId.value,
    snapshot: currentRunSnapshot.value,
  });
};

const cancelRun = () => {
  if (!status.isLoading && !status.isReady) {
    return;
  }

  clearCancelTimeout();

  setStatus({
    isCancelling: true,
    isSimulationStopping: false,
  });

  postToWorker({
    type: GraphWorkerMessageType.Cancel,
    runId: runId.value,
  });

  cancelTimeoutId.value = window.setTimeout(() => {
    cancelTimeoutId.value = null;
    if (!status.isCancelling) {
      return;
    }

    disposeWorker();
    clearRunState();
  }, CANCEL_TIMEOUT_MS);
};

const toggleRun = (snapshot: GraphSnapshot) => {
  if (status.isLoading || status.isReady) {
    cancelRun();
    return;
  }

  startRun(snapshot);
};

const startSimulation = (timeStep: number) => {
  if (!status.isReady || !graphWorker.value || status.isSimulationStopping) {
    return;
  }

  setStatus({
    isRunning: true,
    isSimulationStopping: false,
  });
  postToWorker({
    type: GraphWorkerMessageType.StartSim,
    runId: runId.value,
    timeStep,
  });
};

const stopSimulation = () => {
  if (!status.isReady || status.isSimulationStopping) {
    return;
  }

  setStatus({
    isSimulationStopping: true,
  });

  postToWorker({
    type: GraphWorkerMessageType.StopSim,
    runId: runId.value,
  });
};

const toggleSimulation = (timeStep: number) => {
  if (status.isSimulationStopping) {
    return;
  }

  if (status.isRunning) {
    stopSimulation();
    return;
  }

  startSimulation(timeStep);
};

const clearCancelTimeout = () => {
  if (cancelTimeoutId.value === null) {
    return;
  }

  window.clearTimeout(cancelTimeoutId.value);
  cancelTimeoutId.value = null;
};

const setStatus = (patch: Partial<VizStatus>) => {
  Object.assign(status, patch);
  emitStatus();
};

const setStatusLoading = () => {
  clearCancelTimeout();
  setStatus({
    ...initialStatus,
    isLoading: true,
  });
};

const setStatusReady = () => {
  clearCancelTimeout();
  setStatus({
    ...initialStatus,
    isReady: true,
  });
};

const cloneSnapshot = (snapshot: GraphSnapshot) => {
  return JSON.parse(JSON.stringify(snapshot)) as GraphSnapshot;
};

const clearRunState = (clearSnapshot = true) => {
  clearCancelTimeout();
  dispose();

  if (clearSnapshot) {
    currentRunSnapshot.value = null;
  }

  setStatus({ ...initialStatus });
};

const createRendererWithWorker = async (snapshot: GraphSnapshot, nodeStates: WorkerNodeState[]) => {
  if (!(await waitForHostToStart())) {
    return false;
  }

  dispose();

  const graph = snapshotToGraph(snapshot);
  const workerViz = new PatternViz3D(`#${hostId}`, graph, { deferCompute: true });

  workerViz.updateNodes(nodeStates);
  workerViz.resize();

  viz.value = workerViz;
  emit("viz-ready", workerViz);
  return true;
};

const updateNodes = (nodeStates: WorkerNodeState[]) => {
  viz.value?.updateNodes(nodeStates);
};

const resize = () => {
  viz.value?.resize();
};

const dispose = () => {
  if (viz.value) {
    viz.value.dispose();
    viz.value = null;
  }
};

const resetStatus = () => {
  setStatus({ ...initialStatus });
};

const renderOffline = async (snapshot: GraphSnapshot | null) => {
  if (!snapshot) {
    dispose();
    resetStatus();
    return false;
  }

  const isRendererReady = await createRendererWithoutWorker(snapshot);
  if (!isRendererReady) {
    resetStatus();
    return false;
  }

  setStatusReady();
  return true;
};

const disposeWorker = () => {
  if (graphWorker.value) {
    graphWorker.value.terminate();
    graphWorker.value = null;
  }
};

const postToWorker = (message: GraphWorkerRequest) => {
  graphWorker.value?.postMessage(message);
};

const onWorkerMessageReceived = async (payload: GraphWorkerResponse) => {
  if (payload.runId !== runId.value) {
    return;
  }

  switch (payload.type) {
    case GraphWorkerMessageType.Ready: {
      const snapshot = currentRunSnapshot.value;
      if (!snapshot) {
        return;
      }

      const isRendererReady = await createRendererWithWorker(snapshot, payload.nodeStates);
      if (!isRendererReady) {
        resetStatus();
        return;
      }

      setStatusReady();
      return;
    }
    case GraphWorkerMessageType.SimulationStep: {
      setStatus({
        isRunning: true,
        step: payload.step,
        accDelta: payload.accDelta,
      });

      updateNodes(payload.nodeStates);
      return;
    }
    case GraphWorkerMessageType.SimStopped: {
      setStatus({
        isRunning: false,
        isSimulationStopping: false,
        step: payload.step,
      });

      return;
    }
    case GraphWorkerMessageType.Canceled: {
      disposeWorker();
      clearRunState();
      return;
    }
    case GraphWorkerMessageType.Error: {
      const snapshot = currentRunSnapshot.value;
      disposeWorker();
      await renderOffline(snapshot);
      return;
    }
  }
};

const ensureWorker = () => {
  if (graphWorker.value) {
    return;
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL("../../workers/graphRender.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch (error) {
    console.error("Failed to create graph worker:", error);
    throw error;
  }

  worker.onmessage = (event: MessageEvent<GraphWorkerResponse>) => {
    onWorkerMessageReceived(event.data);
  };

  worker.onerror = (event) => {
    console.error(event.message);
    const snapshot = currentRunSnapshot.value;

    disposeWorker();
    void renderOffline(snapshot);
  };

  graphWorker.value = worker;
};

const isHostReady = () => {
  const host = document.getElementById(hostId);
  if (!host) {
    return false;
  }

  const bounds = host.getBoundingClientRect();
  return bounds.width > 0 && bounds.height > 0;
};

const waitForHostToStart = async () => {
  for (let i = 0; i < 8; i += 1) {
    if (isHostReady()) {
      return true;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  return false;
};

const createRendererWithoutWorker = async (snapshot: GraphSnapshot) => {
  if (!(await waitForHostToStart())) {
    return false;
  }

  dispose();
  const graph = snapshotToGraph(snapshot);
  const nextViz = new PatternViz3D(`#${hostId}`, graph);
  nextViz.resize();
  viz.value = nextViz;
  emit("viz-ready", nextViz);
  return true;
};

onBeforeUnmount(() => {
  isMounted.value = false;
  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
    resizeObserver.value = null;
  }
  
  clearCancelTimeout();
  cancelRun();
  disposeWorker();
  dispose();
});

defineExpose({
  create: createRendererWithWorker,
  updateNodes,
  startRun,
  cancelRun,
  toggleRun,
  startSimulation,
  stopSimulation,
  toggleSimulation,
  dispose,
  resize,
  getStatus: () => status,
  getViz: () => viz.value,
});
</script>

<template>
  <div class="viz-renderer" ref="containerRef">
    <div :id="hostId" class="viz-host"></div>
    <div class="viz-loading" v-if="status.isLoading || status.isCancelling">
      <div class="spinner"></div>
      <span>{{ status.isCancelling ? "Cancelling..." : "Preparing graph..." }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.viz-renderer {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  border: var(--border-container);
  padding-right: 1px;
  overflow: hidden;
}

.viz-host {
  width: 100%;
  height: 100%;
}

:deep(.threed_graph) {
  width: 100%;
  height: 100%;
}

:deep(.threed_graph canvas) {
  display: block;
}

.viz-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: var(--color-background-soft);
  z-index: 5;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-heading);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
