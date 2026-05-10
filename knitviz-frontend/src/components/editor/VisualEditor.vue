<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as Blockly from "blockly";
import Btn from "@/components/ui/Btn.vue";
import type { GraphSnapshot } from "@/knitgraph/snapshot";
import { useGlobalEditorStore } from "@/stores/globalEditorStore";
import {
  ensureKnitBlocklyRegistered,
  useBlocklySamplesStore,
  knitToolbox,
  workspaceToKnitCode,
} from "@/stores/samples/blocklysamples";
import { visualAdapter } from "@/components/editor/adapters/visualAdapter";
import type { VisualEditorState } from "@/components/editor/editor.types";

const emit = defineEmits<{
  (e: "generate", payload: { graph: GraphSnapshot; visual: VisualEditorState }): void;
}>();

const props = defineProps<{
  isActive: boolean;
}>();

const store = useGlobalEditorStore();
const samplesStore = useBlocklySamplesStore();
const sampleNames = samplesStore.names;

const blocklyDiv = ref<HTMLElement | null>(null);
const blocklyContainer = ref<HTMLElement | null>(null);
let workspace: ReturnType<typeof Blockly.inject> | null = null;
const resizeObserver = ref<ResizeObserver | null>(null);

const lastLoadedWorkspaceJson = ref("");

const workspaceOptions = {
  toolbox: knitToolbox,
  scrollbars: true,
  trashcan: true,
} as const;

const parseWorkspaceState = (workspaceJson: string) => {
  try {
    return JSON.parse(workspaceJson);
  } catch (error) {
    console.warn("Invalid Blockly workspace JSON, clearing workspace:", error);
    return null;
  }
};

const injectWorkspace = () => {
  if (!blocklyDiv.value) {
    return null;
  }

  return Blockly.inject(blocklyDiv.value, workspaceOptions);
};

const disposeWorkspace = () => {
  if (!workspace) {
    return;
  }

  const currentWorkspace = workspace;
  workspace = null;

  if (typeof currentWorkspace.isDisposed === "function" && currentWorkspace.isDisposed()) {
    return;
  }

  const activeMainWorkspace = Blockly.getMainWorkspace();
  if (activeMainWorkspace && activeMainWorkspace.id === currentWorkspace.id) {
    currentWorkspace.dispose();
  }
};

const syncWorkspace = (workspaceJson: string) => {
  if (!props.isActive || !workspace) {
    return;
  }

  if (!workspaceJson) {
    workspace.clear();
    lastLoadedWorkspaceJson.value = "";
    return;
  }

  if (workspaceJson === lastLoadedWorkspaceJson.value) {
    return;
  }

  const state = parseWorkspaceState(workspaceJson);
  if (!state) {
    workspace.clear();
    lastLoadedWorkspaceJson.value = "";
    return;
  }

  Blockly.Events.disable();

  try {
    workspace.clear();
    Blockly.serialization.workspaces.load(state, workspace, { recordUndo: false });
  } finally {
    Blockly.Events.enable();
  }

  lastLoadedWorkspaceJson.value = workspaceJson;
  resizeBlockly();
};

const applySample = (name: string) => {
  const workspaceJson = samplesStore.getWorkspaceJson(name);
  if (!workspaceJson) {
    return;
  }

  syncWorkspace(workspaceJson);
};

onMounted(() => {
  ensureKnitBlocklyRegistered();
  workspace = injectWorkspace();

  if (!workspace) {
    return;
  }

  const { workspaceJson } = visualAdapter.fromStore(store.state);

  if (props.isActive) {
    syncWorkspace(workspaceJson);
  }

  if (blocklyContainer.value) {
    resizeObserver.value = new ResizeObserver(() => {
      resizeBlockly();
    });
    resizeObserver.value.observe(blocklyContainer.value);
  }
});

const saveWorkspace = () => {
  if (!workspace) {
    return "";
  }
  const state = Blockly.serialization.workspaces.save(workspace);
  return JSON.stringify(state);
};

const resizeBlockly = () => {
  if (workspace) {
    Blockly.svgResize(workspace);
  }
};

const generate = () => {
  if (!workspace) {
    return;
  }

  const workspaceJson = saveWorkspace();
  lastLoadedWorkspaceJson.value = workspaceJson;
  const code = workspaceToKnitCode(workspace);
  
  emit(
    "generate",
    visualAdapter.toStore({
      workspaceJson,
      code,
    }),
  );
};

const reset = () => {
  if (workspace) {
    workspace.clear();
  }
};

const stopRevisionWatch = watch(
  () => store.state.revision,
  () => {
    if (!props.isActive) {
      return;
    }

    const { workspaceJson } = visualAdapter.fromStore(store.state);
    syncWorkspace(workspaceJson);
  },
);

watch(
  () => props.isActive,
  (isActive) => {
    if (!isActive) {
      return;
    }

    const { workspaceJson } = visualAdapter.fromStore(store.state);
    syncWorkspace(workspaceJson);
  },
);

onBeforeUnmount(() => {
  stopRevisionWatch();

  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
    resizeObserver.value = null;
  }

  if (workspace) {
    disposeWorkspace();
  }
});

defineExpose({
  generate,
  reset,
});
</script>

<template>
  <section class="visual-editor">
    <div class="toolbar">
      <div class="sample-bar" v-if="sampleNames.length > 0">
        <span>Visual Samples</span>
        <Btn btn_width="7.5rem" btn_height="2.6rem" v-for="name in sampleNames" :key="name" @click="applySample(name)">
          {{ name }}
        </Btn>
      </div>
      <Btn btn_width="6.5rem" btn_height="2.6rem" @click="reset">Reset</Btn>
    </div>

    <div ref="blocklyContainer" class="blockly-container">
      <div ref="blocklyDiv" class="blockly-editor"></div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.visual-editor {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  height: 100%;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.sample-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.blockly-container {
  border: 1px solid #b8b7b7;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  border-radius: 0.4rem;
}

.blockly-editor {
  width: 100%;
  height: 100%;
}
</style>
