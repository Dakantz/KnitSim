<template>
    <div class="editor_wrapper">
        <div class="editor" ref="editor"></div>
        <button @click="state.collapsed = !state.collapsed">{{ state.collapsed ? 'Expand' : 'Collapse' }}</button>
    </div>

</template>
<script setup lang="ts">
import { EditorView } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { basicSetup } from "codemirror";
import { computed, onMounted, reactive, ref, useTemplateRef, watch } from "vue";
import { javascript } from "@codemirror/lang-javascript";
const editor = useTemplateRef('editor');
const view = ref(null as EditorView | null);
const state = reactive({
    collapsed: false
})
const doc = defineModel(
    {
        default: `knitRows(10, 'k1, p1')`,
        type: String
    })
watch(doc, (newVal) => {
    if (view.value) {
        view.value.dispatch({
            changes: {
                from: 0,
                to: view.value.state.doc.length,
                insert: newVal
            }
        })
    }
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
const view_height =computed(()=>{
    return state.collapsed ? '10vh' : '50vh';
})

</script>
<style lang="scss">
.editor {
    height: 100%;
    width: 100%;

    max-height: v-bind(view_height);
    overflow-y: auto;
}

.editor_wrapper {
    height: 100%;
    width: 100%;
}
</style>