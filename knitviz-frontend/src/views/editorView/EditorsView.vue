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
import { EditorType, useGlobalEditorStore } from "@/stores/globalEditorStore";
import type { DraftPreviewPayload, NodeDraftsById, VizStatus } from "@/components/editor/editor.types";

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
  dispose: () => void;
  getStatus: () => VizStatus;
  getViz: () => PatternViz3D | null;
} | null>(null);

const activeTab = ref<EditorType>(EditorType.CODE);
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

const isRunActive = computed(() => preview.isLoading || preview.isReady);
const runLabel = computed(() => (isRunActive.value ? "Hide Preview" : "Show Preview"));
const generateLabel = computed(() => {
  if (activeTab.value === EditorType.NODE) {
    return "Apply Node Changes";
  }

  if (activeTab.value === EditorType.CODE) {
    return "Generate from Code";
  }

  if (activeTab.value === EditorType.GRID) {
    return "Generate from Grid";
  }

  return "Generate from Visual";
});

const selectedNode = computed(() => {
  if (selectedNodeId.value === null) {
    return null;
  }

  return store.state.graph.nodes.find((node) => node.id === selectedNodeId.value) ?? null;
});

const simulationLabel = computed(() => {
  if (preview.isSimulationStopping) {
    return "Stopping Simulation...";
  }

  if (!preview.isReady) {
    return "Simulation unavailable";
  }

  return preview.isRunning ? "Stop Simulation" : "Start Simulation";
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

const applyDraftsToViz = (draftpayloads: DraftPreviewPayload[]) => {
  const vizInstance = vizRendererRef.value?.getViz();
  if (!vizInstance || draftpayloads.length === 0) {
    return;
  }

  const completeSnapshots = draftpayloads
    .map(({ id }) => nodeDrafts.value[id])
    .filter((draft) => draft !== undefined);

  if (completeSnapshots.length === 0) {
    return;
  }

  vizInstance.applyNodeDrafts(completeSnapshots);
};

const applyAllDraftsToViz = () => {
  const vizInstance = vizRendererRef.value?.getViz();
  if (!vizInstance) {
    return;
  }

  const allSnapshots = Object.values(nodeDrafts.value);
  if (allSnapshots.length === 0) {
    return;
  }

  vizInstance.applyNodeDrafts(allSnapshots);
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
  preview.isLoading = status.isLoading;
  preview.isReady = status.isReady;
  preview.isRunning = status.isRunning;
  preview.isCancelling = status.isCancelling;
  preview.isSimulationStopping = status.isSimulationStopping;
  preview.step = status.step;
  preview.accDelta = status.accDelta;
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
    overlayManager.value?.addOverlay(event);
  });
  vizInstance.on(PatternViz3DEvents.mouseout, (event) => {
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

  vizInstance.on(PatternViz3DEvents.click, (node: KnitNode3D) => {
    const selectedId = node?.id ?? null;
    selectedNodeId.value = selectedId;
    if (selectedId !== null) {
      activeTab.value = EditorType.NODE;
    }
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
  if (activeTab.value === EditorType.NODE) {
    applyAllNodeChanges();
    return;
  }

  if (activeTab.value === EditorType.CODE) {
    codeEditorRef.value?.generate();
    return;
  }

  if (activeTab.value === EditorType.GRID) {
    gridEditorRef.value?.generate();
    return;
  }

  visualEditorRef.value?.generate();
};

const onCodeGenerate = (payload: Parameters<typeof store.applyCodeGenerate>[0]) => {
  nodeDrafts.value = {};
  store.applyCodeGenerate(payload);
  triggerAutoPreview();
};

const onGridGenerate = (payload: Parameters<typeof store.applyGridGenerate>[0]) => {
  nodeDrafts.value = {};
  store.applyGridGenerate(payload);
  triggerAutoPreview();
};

const onVisualGenerate = (payload: Parameters<typeof store.applyVisualGenerate>[0]) => {
  nodeDrafts.value = {};
  store.applyVisualGenerate(payload);
  triggerAutoPreview();
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
  applyAllDraftsToViz();
};

const syncOverlayForActiveTab = () => {
  attachOverlayManager(vizRendererRef.value?.getViz() ?? null);
};

onUnmounted(() => {
  cancelRun();
  vizRendererRef.value?.dispose();
});

watch(selectedNode, (node) => {
  if (!node) {
    return;
  }

  const nodeDraft = nodeDrafts.value[node.id];
  if (!nodeDraft) {
    return;
  }

  applyDraftsToViz([
    {
      id: node.id,
      draft: {
        color: nodeDraft.color,
        type: nodeDraft.type,
        side: nodeDraft.side,
      },
    },
  ]);
});

watch(activeTab, () => {
  syncOverlayForActiveTab();
});
</script>

<template>
  <main class="editor-view">
    <section class="editors-panel">
      <header class="panel-header">
        <h3>Build the Model</h3>
      </header>
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === editorType.CODE }" @click="activeTab = editorType.CODE">Code</button>
        <button class="tab" :class="{ active: activeTab === editorType.GRID }" @click="activeTab = editorType.GRID">Grid</button>
        <button class="tab" :class="{ active: activeTab === editorType.VISUAL }" @click="activeTab = editorType.VISUAL">Visual</button>
        <button class="tab" :class="{ active: activeTab === editorType.NODE }" @click="activeTab = editorType.NODE">Node</button>
      </div>

      <div class="editor-content">
        <Code ref="codeEditorRef" v-show="activeTab === editorType.CODE" @generate="onCodeGenerate" />
        <GridEditor ref="gridEditorRef" v-show="activeTab === editorType.GRID" @generate="onGridGenerate" />
        <VisualEditor ref="visualEditorRef" v-show="activeTab === editorType.VISUAL" @generate="onVisualGenerate" />
        <NodeEditor
          v-if="activeTab === editorType.NODE"
          :selected-node="selectedNode"
          :selected-node-id="selectedNodeId"
          :snapshot-nodes="snapshotNodesForEditor"
          :node-drafts="nodeDrafts"
          @select-node="selectNodeFromEditor"
          @update-node-drafts="nodeDrafts = $event"
          @preview-node-draft="applyDraftsToViz([$event])"
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
        <span><strong>Status:</strong> {{ preview.isLoading ? "Preparing" : preview.isReady ? "Ready" : "Idle" }}</span>
        <span><strong>Nodes:</strong> {{ store.state.graph.nodes.length }}</span>
        <span><strong>Step:</strong> {{ preview.step }}</span>
        <span><strong>Delta:</strong> {{ preview.accDelta.toFixed(6) }}</span>
      </div>
      <VizRenderer ref="vizRendererRef" @status="onVizStatus" @viz-ready="onVizReady" />
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
