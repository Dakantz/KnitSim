<template>
    <div class="editor_wrapper">
        <div class="editor" ref="editor"></div>
        <!-- <button @click="state.collapsed = !state.collapsed">{{ state.collapsed ? 'Expand' : 'Collapse' }}</button> -->
    </div>

</template>
<script setup lang="ts">
import { EditorView } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { basicSetup } from "codemirror";
import { computed, onMounted, reactive, ref, useTemplateRef, watch } from "vue";
import { javascript } from "@codemirror/lang-javascript";
import { useEditorStore } from '@/stores/editor';

const editor = useTemplateRef('editor');
const store = useEditorStore();
const view = ref(null as EditorView | null);
const state = reactive({
    collapsed: false
})
onMounted(() => {
    store.setViewFromDiv(editor.value);
});
const view_height = computed(() => {
    return state.collapsed ? '10vh' : '50vh';
})

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
</style>