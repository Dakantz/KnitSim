<template>
    <div class="editor_wrapper">
        <div class="editor" ref="editor"></div>
    </div>

</template>
<script setup lang="ts">
import { EditorView } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { basicSetup } from "codemirror";
import { onMounted, ref, useTemplateRef } from "vue";
import { javascript } from "@codemirror/lang-javascript";
const editor = useTemplateRef('editor');
const view = ref(null as EditorView | null);
const doc = defineModel(
    {
        default: `knitRows(10, 'k1, p1')`,
        type: String
    })
onMounted(() => {
    view.value = new EditorView({
        state: EditorState.create({
            doc: doc.value,
            extensions: [basicSetup, javascript(),
                EditorView.updateListener.of((v) => {
                    doc.value = v.state.doc.toString();
                })
            ]
        }),
        parent: editor.value as HTMLElement,
    })
});


</script>
<style lang="scss">
.editor {
    height: 100%;
    width: 100%;

    max-height: 50vh;
    overflow-y: auto;
}

.editor_wrapper {
    height: 100%;
    width: 100%;
}
</style>