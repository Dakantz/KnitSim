<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from "vue";
import { snapshotToGraph, type GraphSnapshot } from "@/knitgraph/snapshot";
import { PatternViz3D } from "@/knitgraph/3d/viz";
// Worker protocol removed: all simulation is now main-thread only
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
  (e: "error", payload: string): void;
}>();

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
};

const emitError = (context: string, error: unknown) => {
  const reason = toErrorMessage(error, "Unknown error");
  emit("error", `${context}: ${reason}`);
};

const containerRef = ref<HTMLElement | null>(null);

const hostId = `pattern_viz_${Math.random().toString(36).slice(2, 9)}`;
const resizeObserver = ref<ResizeObserver | null>(null);
// Removed: no worker
const isMounted = ref(false);
const viz = shallowRef<PatternViz3D | null>(null);
const cancelTimeoutId = ref<number | null>(null);
const simulationFrameId = ref<number | null>(null);
const simulationRunning = ref(false);
const simulationStepCount = ref(0);
      
const runId = ref(0);
const currentRunSnapshot = shallowRef<GraphSnapshot | null>(null);
const pendingSnapshot = shallowRef<GraphSnapshot | null>(null);

const status = reactive<VizStatus>({ ...initialStatus });

const stopSimulationLoop = () => {
  simulationRunning.value = false;
  if (simulationFrameId.value !== null) {
    window.cancelAnimationFrame(simulationFrameId.value);
    simulationFrameId.value = null;
  }
};

const cloneInitialStatus = (): VizStatus => ({ ...initialStatus });

const emitStatus = () => {
  emit("status", { ...status });
};

onMounted(() => {
  isMounted.value = true;

  if (!containerRef.value) {
    return;
  }

  resizeObserver.value = new ResizeObserver(() => {
    if (viz.value) {
      viz.value.resize();
    }
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
    setStatus(cloneInitialStatus());
    return;
  }

  if (!isMounted.value) {
    pendingSnapshot.value = cloneSnapshot(snapshot);
    return;
  }

  runId.value += 1;
  currentRunSnapshot.value = cloneSnapshot(snapshot);
  if (viz.value) {
    viz.value.dispose();
    viz.value = null;
  }

  setStatusLoading();

  // Directly create renderer and run simulation on main thread
  const currentSnapshot = currentRunSnapshot.value;
  if (!currentSnapshot) {
    setStatus(cloneInitialStatus());
    return;
  }
  void createRendererWithoutWorker(currentSnapshot).then((isRendererReady) => {
    if (!isRendererReady) {
      setStatus(cloneInitialStatus());
      return;
    }
    setStatusReady();
  }).catch((error) => {
    console.error("Failed to create renderer:", error);
    emitError("Render failed", error);
    setStatus(cloneInitialStatus());
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
  clearRunState();
};

const toggleRun = (snapshot: GraphSnapshot) => {
  if (status.isLoading || status.isReady) {
    cancelRun();
    return;
  }

  startRun(snapshot);
};

// Main-thread simulation logic (implement as needed)
const startSimulation = (timeStep: number) => {
  if (!status.isReady || !viz.value || simulationRunning.value) {
    return;
  }

  stopSimulationLoop();

  const normalizedTimeStepMs = Number.isFinite(timeStep) && timeStep > 0 ? timeStep : 100;
  const physicsDelta = 0.1;
  let lastStepAt = performance.now();
  simulationRunning.value = true;
  simulationStepCount.value = status.step;

  setStatus({
    isRunning: true,
    isSimulationStopping: false,
  });

  const tick = (now: number) => {
    if (!viz.value || !simulationRunning.value) {
      stopSimulationLoop();
      setStatus({
        isRunning: false,
        isSimulationStopping: false,
      });
      return;
    }

    const elapsed = now - lastStepAt;
    if (elapsed >= normalizedTimeStepMs) {
      lastStepAt = now;
      try {
        const accDeltaRaw = viz.value.stepSim(physicsDelta);
        simulationStepCount.value += 1;
        const accDelta = Number.isFinite(accDeltaRaw) ? accDeltaRaw : status.accDelta;
        setStatus({
          isRunning: true,
          step: simulationStepCount.value,
          accDelta,
        });
      } catch (error) {
        console.error("Simulation step failed:", error);
        emitError("Simulation failed", error);
        stopSimulationLoop();
        setStatus({
          isRunning: false,
          isSimulationStopping: false,
        });
        return;
      }
    }

    simulationFrameId.value = window.requestAnimationFrame(tick);
  };

  simulationFrameId.value = window.requestAnimationFrame(tick);
};

const stopSimulation = () => {
  if (!status.isReady || !simulationRunning.value) {
    return;
  }
  stopSimulationLoop();
  setStatus({
    isRunning: false,
    isSimulationStopping: false,
  });
};

const toggleSimulation = (timeStep: number) => {
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
    ...cloneInitialStatus(),
    isLoading: true,
  });
};

const setStatusReady = () => {
  clearCancelTimeout();
  setStatus({
    ...cloneInitialStatus(),
    isReady: true,
  });
};

const cloneSnapshot = (snapshot: GraphSnapshot) => {
  return JSON.parse(JSON.stringify(snapshot)) as GraphSnapshot;
};

const clearRunState = (clearSnapshot = true) => {
  clearCancelTimeout();
  stopSimulationLoop();
  if (viz.value) {
    viz.value.dispose();
    viz.value = null;
  }

  if (clearSnapshot) {
    currentRunSnapshot.value = null;
  }

  setStatus(cloneInitialStatus());
};

// Removed: worker-based renderer creation

// Removed: worker creation and management

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

  if (viz.value) {
    viz.value.dispose();
    viz.value = null;
  }
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
  stopSimulationLoop();
  cancelRun();
    // Removed stray call to undefined dispose()
});

defineExpose({
  startRun,
  cancelRun,
  toggleRun,
  startSimulation,
  stopSimulation,
  toggleSimulation,
  // No direct expose for dispose/resize; use viz.value methods if needed
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
