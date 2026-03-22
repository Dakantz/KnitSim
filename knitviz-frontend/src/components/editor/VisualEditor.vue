<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as Blockly from "blockly";
import Btn from "@/components/ui/Btn.vue";
import type { GraphSnapshot } from "@/knitgraph/snapshot";
import { useGlobalEditorStore } from "@/stores/globalEditorStore";
import {
  ensureKnitBlocklyRegistered,
  knitToolbox,
  workspaceToKnitCode,
} from "@/stores/samples/blocklysamples";
import { visualAdapter } from "@/components/editor/adapters/visualAdapter";
import type { VisualEditorState } from "@/components/editor/editor.types";

const emit = defineEmits<{
  (e: "generate", payload: { graph: GraphSnapshot; visual: VisualEditorState }): void;
}>();

const store = useGlobalEditorStore();

const blocklyDiv = ref<HTMLElement | null>(null);
const blocklyContainer = ref<HTMLElement | null>(null);
const workspace = ref<any>(null);
const resizeObserver = ref<ResizeObserver | null>(null);

const lastLoadedWorkspaceJson = ref("");

onMounted(() => {
  ensureKnitBlocklyRegistered();
  if (!blocklyDiv.value) {
    return;
  }

  workspace.value = Blockly.inject(blocklyDiv.value, {
    toolbox: knitToolbox,
    scrollbars: true,
    trashcan: true,
  });

  const { workspaceJson } = visualAdapter.fromStore(store.state);
  loadWorkspace(workspaceJson);
  resizeBlockly();

  if (blocklyContainer.value) {
    resizeObserver.value = new ResizeObserver(() => {
      resizeBlockly();
    });
    resizeObserver.value.observe(blocklyContainer.value);
  }
});

const loadWorkspace = (workspaceJson: string) => {
  if (!workspace.value || !workspaceJson) {
    return;
  }

  try {
    const state = JSON.parse(workspaceJson);
    Blockly.serialization.workspaces.load(state, workspace.value);
    lastLoadedWorkspaceJson.value = workspaceJson;
  } catch {
    workspace.value.clear();
    lastLoadedWorkspaceJson.value = "";
  }
};

const saveWorkspace = () => {
  if (!workspace.value) {
    return "";
  }
  const state = Blockly.serialization.workspaces.save(workspace.value);
  return JSON.stringify(state);
};

const resizeBlockly = () => {
  if (workspace.value) {
    Blockly.svgResize(workspace.value);
  }
};

const generate = () => {
  if (!workspace.value) {
    return;
  }

  const workspaceJson = saveWorkspace();
  lastLoadedWorkspaceJson.value = workspaceJson;
  const code = workspaceToKnitCode(workspace.value);
  emit(
    "generate",
    visualAdapter.toStore({
      workspaceJson,
      code,
    }),
  );
};

const reset = () => {
  if (workspace.value) {
    workspace.value.clear();
  }
};

const stopRevisionWatch = watch(
  () => store.state.revision,
  () => {
    const { workspaceJson } = visualAdapter.fromStore(store.state);
    if (!workspace.value) {
      return;
    }

    if (!workspaceJson) {
      workspace.value.clear();
      lastLoadedWorkspaceJson.value = "";
      return;
    }

    if (workspaceJson === lastLoadedWorkspaceJson.value) {
      return;
    }

    workspace.value.clear();
    loadWorkspace(workspaceJson);
    resizeBlockly();
  },
);

onBeforeUnmount(() => {
  stopRevisionWatch();

  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
    resizeObserver.value = null;
  }

  if (workspace.value) {
    const currentWorkspace = workspace.value;
    workspace.value = null;

    try {
      currentWorkspace.dispose();
    } catch (error) {
      console.warn("Ignoring Blockly dispose error during route switch:", error);
    }
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
