<template>
  <div class="editor_wrapper">
    <div class="editor" ref="editor"></div>
    <div class="actions">
      <Btn btn_width="8rem" @click="generate">Generate</Btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { javascript } from "@codemirror/lang-javascript";
import Btn from "@/components/ui/Btn.vue";
import { useGlobalEditorStore } from "@/stores/globalEditorStore";
import { codeAdapter } from "@/components/editor/adapters/codeAdapter";
import type { GraphSnapshot } from "@/knitgraph/snapshot";

const editor = useTemplateRef("editor");
const store = useGlobalEditorStore();
const view = ref(null as EditorView | null);
const localCode = ref("");

const emit = defineEmits<{
  (e: "generate", payload: { code: string; graph: GraphSnapshot }): void;
}>();

const setCode = (nextCode: string) => {
  if (!view.value) {
    return;
  }

  const current = view.value.state.doc.toString();
  if (current === nextCode) {
    return;
  }

  view.value.dispatch({
    changes: {
      from: 0,
      to: current.length,
      insert: nextCode,
    },
  });
};

const setupEditor = () => {
  if (!editor.value) {
    return;
  }

  const initial = codeAdapter.fromStore(store.state).code;
  localCode.value = initial;
  view.value = new EditorView({
    state: EditorState.create({
      doc: initial,
      extensions: [
        basicSetup,
        javascript(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            localCode.value = update.state.doc.toString();
          }
        }),
      ],
    }),
    parent: editor.value,
  });

};

const generate = () => {
  emit("generate", codeAdapter.toStore(localCode.value));
};

onMounted(() => {
  setupEditor();
});

onBeforeUnmount(() => {
  if (view.value) {
    view.value.destroy();
    view.value = null;
  }
});

watch(
  () => store.state.revision,
  () => {
    const nextCode = codeAdapter.fromStore(store.state).code;
    localCode.value = nextCode;
    setCode(nextCode);
  },
);

defineExpose({
  generate,
  getEditorView: () => view.value,
});
</script>

<style lang="scss">
.editor {
  max-height: 100%;
  width: 100%;
  padding: 10px;
  // max-height: v-bind(view_height);
  overflow-y: auto;
}

.editor_wrapper {
  max-height: 100%;
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 0.75rem 0.75rem;
}
</style>
