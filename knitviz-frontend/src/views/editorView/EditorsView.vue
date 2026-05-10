<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, shallowRef, watch } from "vue";
import type { EditorView } from "@codemirror/view";
import { PatternViz3D, PatternViz3DEvents } from "@/knitgraph/3d/viz";
import { KnitGraphOverlayManager } from "@/knitgraph/3d/overlay";
import type { KnitNode3D } from "@/knitgraph/3d/node";
import Code from "@/components/editor/CodeEditor.vue";
import GridEditor from "@/components/editor/GridEditor.vue";
import NodeEditor from "@/components/editor/NodeEditor.vue";
import VisualEditor from "@/components/editor/VisualEditor.vue";
import VizRenderer from "@/components/editor/VizRenderer.vue";
import Btn from "@/components/ui/Btn.vue";
import { UI_CONFIG } from "@/constants/ui";
import { STATUS_LABELS, BUTTON_LABELS } from "@/constants/labels";
import { EditorType, useGlobalEditorStore } from "@/stores/globalEditorStore";
import type { NodeDraftsById, VizStatus } from "@/components/editor/editor.types";

const store = useGlobalEditorStore();
const editorType = EditorType;

const codeEditorRef = ref<{ getEditorView: () => EditorView | null; generate: () => void; } | null>(null);
const gridEditorRef = ref<{ generate: () => void; } | null>(null);
const visualEditorRef = ref<{ generate: () => void; } | null>(null);

const vizRendererRef = ref<{
  startRun: (snapshot: typeof store.state.graph) => void;
  cancelRun: () => void;
  toggleRun: (snapshot: typeof store.state.graph) => void;
  toggleSimulation: (timeStep: number) => void;
  getStatus: () => VizStatus;
  getViz: () => PatternViz3D | null;
} | null>(null);

const activeTab = ref<EditorType>(EditorType.VISUAL);
const overlayManager = shallowRef<KnitGraphOverlayManager | null>(null);
const patternViz = shallowRef<PatternViz3D | null>(null);
const selectedNodeId = ref<number | null>(null);
const nodeDrafts = ref<NodeDraftsById>({});

const preview = reactive<VizStatus>({
  isLoading: false,
  isReady: false,
  isRunning: false,
  isCancelling: false,
  isSimulationStopping: false,
  step: 0,
  accDelta: 0,
});

const simulationTimeStep = ref(100);
const toastMessage = ref("");
const toastVisible = ref(false);
const toastTimerId = ref<number | null>(null);

const isDrawingMode = ref(false);
const drawingColor = ref("#000000");
const hasPendingDrafts = computed(() => Object.keys(nodeDrafts.value).length > 0);

const isRunActive = computed(() => preview.isLoading || preview.isReady);
const runLabel = computed(() => (isRunActive.value ? BUTTON_LABELS.HIDE_PREVIEW ?? 'Hide Preview' : BUTTON_LABELS.SHOW_PREVIEW ?? 'Show Preview'));
const generateLabel = computed(() => {
  if (activeTab.value === EditorType.NODE) {
    return BUTTON_LABELS.APPLY_NODE_CHANGES;
  }

  if (activeTab.value === EditorType.CODE) {
    return BUTTON_LABELS.GENERATE_FROM_CODE;
  }

  if (activeTab.value === EditorType.GRID) {
    return BUTTON_LABELS.GENERATE_FROM_GRID;
  }

  return BUTTON_LABELS.GENERATE_FROM_VISUAL;
});

const selectedNode = computed(() => {
  if (selectedNodeId.value === null) {
    return null;
  }

  return store.state.graph.nodes.find((node) => node.id === selectedNodeId.value) ?? null;
});

const simulationLabel = computed(() => {
  if (preview.isSimulationStopping) {
    return STATUS_LABELS.STOPPING;
  }

  if (!preview.isReady) {
    return STATUS_LABELS.UNAVAILABLE;
  }

  return preview.isRunning ? STATUS_LABELS.STOP : STATUS_LABELS.START;
});

const simulationDisabled = computed(() => {
  return !preview.isReady || preview.isCancelling || preview.isSimulationStopping;
});

const snapshotNodesForEditor = computed(() => {
  const draftedById = nodeDrafts.value;

  return store.state.graph.nodes.map((node) => draftedById[node.id] ?? node);
});

const selectNodeFromEditor = (nodeId: number) => {
  selectedNodeId.value = nodeId;
  activeTab.value = EditorType.NODE;

  const vizInstance = vizRendererRef.value?.getViz();
  if (!vizInstance) {
    return;
  }

  const vizNode = vizInstance.graph.nodes[nodeId];
  if (!vizNode) {
    return;
  }

  vizInstance.highlightNode(vizNode);
  vizInstance.render();
};


const resetViz = (clearSelection = true) => {
  if (clearSelection) {
    selectedNodeId.value = null;
  }

  if (overlayManager.value) {
    overlayManager.value.dispose();
    overlayManager.value = null;
  }

  patternViz.value = null;

  applyVizStatus({
    isLoading: false,
    isReady: false,
    isRunning: false,
    isCancelling: false,
    isSimulationStopping: false,
    step: 0,
    accDelta: 0,
  });
};

const applyVizStatus = (status: VizStatus) => {
  Object.assign(preview, status);
};

const attachOverlayManager = (vizInstance: PatternViz3D | null) => {
  if (!vizInstance || activeTab.value !== EditorType.CODE) {
    if (overlayManager.value) {
      overlayManager.value.dispose();
      overlayManager.value = null;
    }
    return;
  }

  const editorView = codeEditorRef.value?.getEditorView() ?? null;
  if (!editorView) {
    return;
  }

  if (!overlayManager.value) {
    overlayManager.value = new KnitGraphOverlayManager(vizInstance, editorView);
  }

  if (patternViz.value === vizInstance) {
    return;
  }

  patternViz.value = vizInstance;
  vizInstance.on(PatternViz3DEvents.mouseover, (event) => {
    if (!event) {
      return;
    }

    overlayManager.value?.addOverlay(event);
  });
  vizInstance.on(PatternViz3DEvents.mouseout, (event) => {
    if (!event) {
      return;
    }

    overlayManager.value?.removeOverlay(event);
  });
  vizInstance.on(PatternViz3DEvents.render, () => {
    overlayManager.value?.update();
  });
};

const attachVizSelection = (vizInstance: PatternViz3D | null) => {
  if (!vizInstance) {
    return;
  }

  vizInstance.on(PatternViz3DEvents.click, (node: KnitNode3D | null) => {
    const selectedId = node?.id ?? null;
    selectedNodeId.value = selectedId;
    if (selectedId !== null) {
      activeTab.value = EditorType.NODE;
    }
  });

  vizInstance.on(PatternViz3DEvents.paint, (node: KnitNode3D | null) => {
    if (!node) {
      return;
    }

    const sourceNode = store.state.graph.nodes.find((graphNode) => graphNode.id === node.id);
    if (!sourceNode) {
      return;
    }

    const currentDraft = nodeDrafts.value[node.id] ?? sourceNode;
    const nextDraft = {
      ...currentDraft,
      color: node.yarnSpec.color,
    };

    nodeDrafts.value = {
      ...nodeDrafts.value,
      [node.id]: nextDraft,
    };
  });
};

const startRun = () => {
  if (store.state.graph.nodes.length === 0) {
    return;
  }

  resetViz(false);
  vizRendererRef.value?.startRun(store.state.graph);
};

const cancelRun = () => {
  if (!isRunActive.value) {
    return;
  }

  vizRendererRef.value?.cancelRun();
  resetViz();
};

const renderGraph = () => {
  if (isRunActive.value) {
    cancelRun();
    return;
  }

  startRun();
};

const maybeStartSimulation = () => {
  if (simulationDisabled.value) {
    return;
  }

  vizRendererRef.value?.toggleSimulation(simulationTimeStep.value);
};

const triggerAutoPreview = () => {
  nextTick(() => {
    startRun();
  });
};

const generateFromActiveEditor = () => {
  switch (activeTab.value) {
    case EditorType.NODE:
      applyAllNodeChanges();
      return;
    case EditorType.CODE:
      codeEditorRef.value?.generate();
      return;
    case EditorType.GRID:
      gridEditorRef.value?.generate();
      return;
    default:
      visualEditorRef.value?.generate();
  }
};

const applyGeneratedGraph = <TPayload>(payload: TPayload, apply: (value: TPayload) => void) => {
  nodeDrafts.value = {};
  apply(payload);
  triggerAutoPreview();
};

const onCodeGenerate = (payload: Parameters<typeof store.applyCodeGenerate>[0]) => {
  applyGeneratedGraph(payload, (value) => store.applyCodeGenerate(value));
};

const onGridGenerate = (payload: Parameters<typeof store.applyGridGenerate>[0]) => {
  applyGeneratedGraph(payload, (value) => store.applyGridGenerate(value));
};

const onVisualGenerate = (payload: Parameters<typeof store.applyVisualGenerate>[0]) => {
  applyGeneratedGraph(payload, (value) => store.applyVisualGenerate(value));
};

const applyAllNodeChanges = () => {
  const changedNodes = Object.values(nodeDrafts.value);

  if (changedNodes.length === 0) {
    return;
  }

  store.applyNodeSnapshots(changedNodes);
  nodeDrafts.value = {};
  triggerAutoPreview();
};

const onVizStatus = (status: VizStatus) => {
  Object.assign(preview, status);
};

const onVizReady = (vizInstance: PatternViz3D) => {
  attachVizSelection(vizInstance);
  attachOverlayManager(vizInstance);
  vizInstance.setDrawingMode(isDrawingMode.value);
  vizInstance.setDrawingColor(drawingColor.value);
};

const clearToastTimer = () => {
  if (toastTimerId.value !== null) {
    window.clearTimeout(toastTimerId.value);
    toastTimerId.value = null;
  }
};

const showToast = (message: string) => {
  clearToastTimer();
  toastMessage.value = message;
  toastVisible.value = true;
  toastTimerId.value = window.setTimeout(() => {
    toastVisible.value = false;
    toastTimerId.value = null;
  }, UI_CONFIG.TOAST_DURATION_MS);
};

const onVizError = (message: string) => {
  showToast(`An error occurred: ${message}`);
};

const syncOverlayForActiveTab = () => {
  attachOverlayManager(vizRendererRef.value?.getViz() ?? null);
};

onUnmounted(() => {
  clearToastTimer();
  cancelRun();
  // vizRendererRef.value?.dispose() removed: cleanup is now handled internally
});

watch(activeTab, () => {
  syncOverlayForActiveTab();
});

watch(isDrawingMode, (enabled) => {
  vizRendererRef.value?.getViz()?.setDrawingMode(enabled);
});

watch(drawingColor, (color) => {
  vizRendererRef.value?.getViz()?.setDrawingColor(color);
});
</script>

<template>
  <main class="editor-view">
    <section class="editors-panel">
      <header class="panel-header">
        <h3>Build the Model</h3>
      </header>
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === editorType.VISUAL }" @click="activeTab = editorType.VISUAL">Visual</button>
        <button class="tab" :class="{ active: activeTab === editorType.CODE }" @click="activeTab = editorType.CODE">Code</button>
        <button class="tab" :class="{ active: activeTab === editorType.GRID }" @click="activeTab = editorType.GRID">Grid</button>
        <button class="tab" :class="{ active: activeTab === editorType.NODE }" @click="activeTab = editorType.NODE">Node</button>
      </div>

      <div class="editor-content">
        <Code ref="codeEditorRef" v-show="activeTab === editorType.CODE" @generate="onCodeGenerate" />
        <GridEditor ref="gridEditorRef" v-show="activeTab === editorType.GRID" @generate="onGridGenerate" />
        <VisualEditor
          ref="visualEditorRef"
          v-show="activeTab === editorType.VISUAL"
          :is-active="activeTab === editorType.VISUAL"
          @generate="onVisualGenerate"
        />
        <NodeEditor
          v-if="activeTab === editorType.NODE"
          :selected-node="selectedNode"
          :selected-node-id="selectedNodeId"
          :snapshot-nodes="snapshotNodesForEditor"
          :node-drafts="nodeDrafts"
          @select-node="selectNodeFromEditor"
          @update-node-drafts="nodeDrafts = $event"
        />
      </div>
    </section>

    <section class="preview-panel">
      <header class="panel-header">
        <h3>Preview and Controls</h3>
      </header>
      <div class="preview-toolbar">
        <Btn btn_width="10.5rem" btn_height="2.7rem" @click="generateFromActiveEditor">{{ generateLabel }}</Btn>
        <Btn btn_width="8rem" btn_height="2.7rem" @click="renderGraph">{{ runLabel }}</Btn>
        <Btn
          btn_width="10rem"
          btn_height="2.7rem"
          :disabled="simulationDisabled"
          @click="maybeStartSimulation"
          >{{ simulationLabel }}</Btn
        >
      </div>
      <div class="stats-list">
        <span><strong>Status:</strong> {{ preview.isLoading ? STATUS_LABELS.PREPARING : preview.isReady ? STATUS_LABELS.READY : STATUS_LABELS.IDLE }}</span>
        <span><strong>Nodes:</strong> {{ store.state.graph.nodes.length }}</span>
        <span><strong>Step:</strong> {{ preview.step }}</span>
        <span><strong>Delta:</strong> {{ preview.accDelta.toFixed(6) }}</span>
      </div>
      <div class="drawing-controls" v-if="preview.isReady">
        <label class="control-group">
          <input type="checkbox" v-model="isDrawingMode" />
          <span>Drawing Mode</span>
        </label>
        <label class="control-group" v-if="isDrawingMode">
          <span>Color:</span>
          <input type="color" v-model="drawingColor" />
        </label>
        <Btn
          v-if="isDrawingMode"
          btn_width="9.5rem"
          btn_height="2.2rem"
          :disabled="!hasPendingDrafts"
          @click="applyAllNodeChanges"
        >
          Apply Drawings
        </Btn>
      </div>
      <div class="toast toast-error" v-if="toastVisible" role="status" aria-live="polite">
        {{ toastMessage }}
      </div>
      <VizRenderer ref="vizRendererRef" @status="onVizStatus" @viz-ready="onVizReady" @error="onVizError" />
    </section>
  </main>
</template>

<style lang="scss">
.editor-view {
  display: grid;
  grid-template-columns: minmax(360px, 43%) minmax(420px, 57%);
  width: 100%;
  gap: 0.8rem;
  height: 100%;
  overflow: hidden;
}

.editors-panel,
.preview-panel {
  border: var(--border-container);
  padding: 0.65rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

.tabs {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.55rem;
}

.tab {
  border: var(--border-container);
  background: var(--color-background);
  color: var(--color-text);
  padding: 0.25rem 0.68rem;
  cursor: pointer;
}

.tab.active {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.editor-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.5rem;
}

.stats-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  color: var(--color-text);
  margin-bottom: 0.45rem;
}

.drawing-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  padding: 0.45rem;
  background: var(--color-background-soft);
  border: var(--border-container);
}

.toast {
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.35rem;
  border: 1px solid;
  font-size: 0.92rem;
}

.toast-error {
  color: #7a1f1f;
  background: #ffe8e8;
  border-color: #e99a9a;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
}

.control-group input[type="checkbox"] {
  cursor: pointer;
}

.control-group input[type="color"] {
  width: 2.5rem;
  height: 1.8rem;
  cursor: pointer;
  border: var(--border-container);
}

@media (max-width: 980px) {
  .editor-view {
    grid-template-columns: 1fr;
    height: auto;
  }

  .preview-panel,
  .editors-panel {
    min-height: 460px;
  }
}
</style>
