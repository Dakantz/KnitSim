<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as Blockly from "blockly";
import Btn from "@/components/ui/Btn.vue";
import type { GraphSnapshot } from "@/knitgraph/snapshot";
import { useGlobalEditorStore, type VisualEditorState } from "@/stores/globalEditorStore";
import { visualAdapter } from "@/components/editor/adapters/visualAdapter";
import { ensureKnitBlocklyRegistered, knitToolbox, workspaceToKnitCode } from "@/components/editor/visual-editor/knitBlocks";

const emit = defineEmits<{
  (e: "generate", payload: { graph: GraphSnapshot; visual: VisualEditorState }): void;
}>();

const store = useGlobalEditorStore();
const blocklyDiv = ref<HTMLElement | null>(null);
const blocklyContainer = ref<HTMLElement | null>(null);
const workspace = ref<any>(null);
const resizeObserver = ref<ResizeObserver | null>(null);

const saveWorkspace = () => {
  if (!workspace.value) {
    return "";
  }
  const state = Blockly.serialization.workspaces.save(workspace.value);
  return JSON.stringify(state);
};

const loadWorkspace = (workspaceJson: string) => {
  if (!workspace.value || !workspaceJson) {
    return;
  }

  try {
    const state = JSON.parse(workspaceJson);
    Blockly.serialization.workspaces.load(state, workspace.value);
  } catch {
    workspace.value.clear();
  }
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

  const code = workspaceToKnitCode(workspace.value);
  emit(
    "generate",
    visualAdapter.toStore({
      workspaceJson: saveWorkspace(),
      code,
    }),
  );
};

const reset = () => {
  if (workspace.value) {
    workspace.value.clear();
  }
};

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

const stopRevisionWatch = watch(
  () => store.state.revision,
  () => {
    const { workspaceJson } = visualAdapter.fromStore(store.state);
    if (workspaceJson && workspace.value) {
      workspace.value.clear();
      loadWorkspace(workspaceJson);
      resizeBlockly();
    }
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
  <section class="visual_editor">
    <div class="toolbar">
      <Btn btn_width="7rem" @click="reset">Reset</Btn>
      <Btn btn_width="8rem" @click="generate">Generate</Btn>
    </div>

    <div ref="blocklyContainer" class="blockly_container">
      <div ref="blocklyDiv" class="blockly_editor"></div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.visual_editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
}

.toolbar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.blockly_container {
  border: 1px solid #b8b7b7;
  flex: 1;
  min-height: 340px;
  overflow: hidden;
}

.blockly_editor {
  width: 100%;
  height: 100%;
}
</style>
