<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, shallowRef } from "vue";
import type { EditorView } from "@codemirror/view";
import { KnitGraph } from "@/knitgraph";
import { PatternViz3D, PatternViz3DEvents } from "@/knitgraph/3d/viz";
import { KnitGraphOverlayManager } from "@/knitgraph/3d/overlay";
import Code from "@/components/editor/CodeEditor.vue";
import GridEditor from "@/components/editor/GridEditor.vue";
import VisualEditor from "@/components/editor/VisualEditor.vue";
import Btn from "@/components/ui/Btn.vue";
import { useGlobalEditorStore } from "@/stores/globalEditorStore";
import { snapshotToGraph } from "@/knitgraph/snapshot";
import { codeAdapter } from "@/components/editor/adapters/codeAdapter";

const store = useGlobalEditorStore();
const activeTab = ref<"code" | "grid" | "visual">("code");
const codeEditorRef = ref<{
  getEditorView: () => EditorView | null;
} | null>(null);
const vizContainerRef = ref<HTMLElement | null>(null);
const graph = shallowRef<KnitGraph | null>(null);
const viz = shallowRef<PatternViz3D | null>(null);
const overlayManager = shallowRef<KnitGraphOverlayManager | null>(null);
const vizResizeObserver = ref<ResizeObserver | null>(null);

const state = reactive({
  simulation: {
    running: false,
    step: 0,
    timeStep: 100,
    timeout: null as ReturnType<typeof setInterval> | null,
    accDelta: 0,
  },
  examples: {
    "Simple Flat": `this.cast_on(24)
for (let row = 0; row < 16; row++) {
  this.color(row % 2 === 0 ? '#3366ff' : '#ff7a59')
  this.knit(24, row % 2 === 0 ? 'knit' : 'purl')
  this.end_row()
}`,
    Beanie: `this.cast_on(24, 'round')
let stitches = 24
for (let i = 0; i < 8; i++) {
  this.color('#6b8afd')
  this.knit(stitches, 'knit')
  this.end_row()
  stitches -= 2
}`,
  },
});

const resetViz = () => {
  state.simulation.running = false;
  state.simulation.step = 0;
  state.simulation.accDelta = 0;

  if (state.simulation.timeout) {
    clearInterval(state.simulation.timeout);
    state.simulation.timeout = null;
  }

  if (overlayManager.value) {
    overlayManager.value.dispose();
    overlayManager.value = null;
  }

  if (viz.value) {
    viz.value.dispose();
    viz.value = null;
  }
};

const renderGraph = () => {
  if (store.state.graph.nodes.length === 0) {
    return;
  }

  resetViz();
  graph.value = snapshotToGraph(store.state.graph);
  viz.value = new PatternViz3D("#pattern_viz_3d", graph.value);
  viz.value.resize();

  const editorView = codeEditorRef.value?.getEditorView() ?? null;
  if (editorView && viz.value) {
    overlayManager.value = new KnitGraphOverlayManager(viz.value, editorView);
    viz.value.on(PatternViz3DEvents.mouseover, (event) => {
      overlayManager.value?.addOverlay(event);
    });
    viz.value.on(PatternViz3DEvents.mouseout, (event) => {
      overlayManager.value?.removeOverlay(event);
    });
    viz.value.on(PatternViz3DEvents.render, () => {
      overlayManager.value?.update();
    });
  }
};

const startSim = () => {
  if (!viz.value || !graph.value) {
    return;
  }

  state.simulation.running = true;
  state.simulation.step = 0;
  let lastTime = Date.now();

  state.simulation.timeout = setInterval(() => {
    if (!state.simulation.running || !viz.value || !graph.value) {
      return;
    }

    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    state.simulation.accDelta = viz.value.stepSim(dt);
    state.simulation.step += 1;

    const nodeCount = Math.max(1, Object.keys(graph.value.nodes).length);
    const avgDelta = state.simulation.accDelta / nodeCount;
    if (avgDelta < 1e-6 && state.simulation.step > 10) {
      stopSim();
    }
  }, state.simulation.timeStep);
};

const stopSim = () => {
  state.simulation.running = false;
  if (state.simulation.timeout) {
    clearInterval(state.simulation.timeout);
    state.simulation.timeout = null;
  }
};

const applyExample = (key: string) => {
  const code = state.examples[key as keyof typeof state.examples];
  const snapshot = codeAdapter.createSnapshot(code);
  store.applyCodeGenerate({ code, graph: snapshot });
};

const onCodeGenerate = (payload: Parameters<typeof store.applyCodeGenerate>[0]) => {
  store.applyCodeGenerate(payload);
};

const onGridGenerate = (payload: Parameters<typeof store.applyGridGenerate>[0]) => {
  store.applyGridGenerate(payload);
};

const onVisualGenerate = (payload: Parameters<typeof store.applyVisualGenerate>[0]) => {
  store.applyVisualGenerate(payload);
};

const handleWindowResize = () => {
  viz.value?.resize();
};

onMounted(() => {
  window.addEventListener("resize", handleWindowResize);

  if (vizContainerRef.value) {
    vizResizeObserver.value = new ResizeObserver(() => {
      viz.value?.resize();
    });
    vizResizeObserver.value.observe(vizContainerRef.value);
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", handleWindowResize);
  if (vizResizeObserver.value) {
    vizResizeObserver.value.disconnect();
    vizResizeObserver.value = null;
  }
  stopSim();
  resetViz();
});
</script>

<template>
  <main class="editor_view">
    <section class="editors_panel">
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'code' }" @click="activeTab = 'code'">Code</button>
        <button class="tab" :class="{ active: activeTab === 'grid' }" @click="activeTab = 'grid'">Grid</button>
        <button class="tab" :class="{ active: activeTab === 'visual' }" @click="activeTab = 'visual'">Visual</button>
      </div>

      <div class="editor_content">
        <Code ref="codeEditorRef" v-show="activeTab === 'code'" @generate="onCodeGenerate" />
        <GridEditor v-show="activeTab === 'grid'" @generate="onGridGenerate" />
        <VisualEditor v-show="activeTab === 'visual'" @generate="onVisualGenerate" />
      </div>
    </section>

    <section class="preview_panel">
      <div class="controls">
        <Btn btn_width="7rem" @click="renderGraph">Run</Btn>
        <Btn btn_width="7rem" @click="startSim" v-if="!state.simulation.running">Simulate</Btn>
        <Btn btn_width="7rem" @click="stopSim" v-else>Stop</Btn>
        <span>Step {{ state.simulation.step }}</span>
        <span>Delta {{ state.simulation.accDelta.toFixed(6) }}</span>
      </div>

      <div class="controls">
        <span>Examples</span>
        <Btn btn_width="8rem" v-for="key in Object.keys(state.examples)" :key="key" @click="applyExample(key)">
          {{ key }}
        </Btn>
      </div>

      <div id="pattern_viz_3d" ref="vizContainerRef"></div>
    </section>
  </main>
</template>

<style lang="scss">
.editor_view {
  display: grid;
  grid-template-columns: minmax(380px, 46%) minmax(420px, 54%);
  gap: 1rem;
  height: 100%;
}

.editors_panel,
.preview_panel {
  border: 1px solid #b8b7b7;
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tabs {
  display: flex;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
}

.tab {
  border: 1px solid #b8b7b7;
  background: white;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}

.tab.active {
  background: #d5e9ed;
  border-color: #8fa3a8;
}

.editor_content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.8rem;
}

#pattern_viz_3d {
  width: 100%;
  flex: 1;
  min-height: 300px;
  border: 1px solid rgb(168, 212, 190);
  padding-right: 1px; // to prevent weird 1px overflow from the viz's internal canvas
}

.threed_graph {
  height: 100%;
  width: 100%;
}

@media (max-width: 980px) {
  .editor_view {
    grid-template-columns: 1fr;
    height: auto;
  }

  .preview_panel,
  .editors_panel {
    min-height: 460px;
  }
}
</style>
