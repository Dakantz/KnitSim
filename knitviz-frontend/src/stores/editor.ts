import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { EditorView } from "codemirror";

import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
export const useEditorStore = defineStore("editor", () => {
  const code = ref("");
  const view = ref(null as EditorView | null);
  const div = ref(null as HTMLElement | null);
  const setupEditor = () => {
    if (div.value) {
      if (view.value) {
        view.value.destroy();
      }
      console.log("Setting up editor", div.value);
      view.value = new EditorView({
        state: EditorState.create({
          doc: code.value,
          extensions: [
            basicSetup,
            javascript(),
            EditorView.updateListener.of((v) => {
              code.value = v.state.doc.toString();
            }),
          ],
        }),
        parent: div.value,
      });
    }
  };
  const setViewFromDiv = (d: HTMLElement) => {
    div.value = d;
    setupEditor();
  };
  const setCode = (new_val) => {
    code.value = new_val;
    setupEditor();
  };

  return { view, setCode, setViewFromDiv, code };
});
