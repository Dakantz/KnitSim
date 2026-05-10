<script setup lang="ts">
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { javascript } from "@codemirror/lang-javascript";
import Btn from "@/components/ui/Btn.vue";
import { useGlobalEditorStore } from "@/stores/globalEditorStore";
import { useCodeSamplesStore } from "@/stores/samples/codesamples";
import { codeAdapter } from "@/components/editor/adapters/codeAdapter";
import type { GraphSnapshot } from "@/knitgraph/snapshot";

const editor = useTemplateRef("editor");
const store = useGlobalEditorStore();
const samplesStore = useCodeSamplesStore();
const view = ref(null as EditorView | null);
const localCode = ref("");

const emit = defineEmits<{
  (e: "generate", payload: { code: string; graph: GraphSnapshot }): void;
}>();

const sampleNames = computed(() => samplesStore.names);

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

const applySample = (key: string) => {
  const sample = samplesStore.getSample(key);
  if (!sample) {
    return;
  }

  localCode.value = sample;
  setCode(sample);
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

<template>
  <div class="editor-container">
    <div class="samples" v-if="sampleNames.length > 0">
      <span class="samples-label">Code Samples</span>
      <Btn btn_width="7.5rem" btn_height="2.6rem" v-for="key in sampleNames" :key="key" @click="applySample(key)">
        {{ key }}
      </Btn>
    </div>
    <div class="editor" ref="editor"></div>
  </div>
</template>

<style lang="scss">
.editor {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 8px;
  overflow-y: auto;
  border: var(--border-container);
  border-radius: var(--border-container-radius);
}

.editor-container {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  height: 100%;
  width: 100%;
}

.samples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}
</style>
