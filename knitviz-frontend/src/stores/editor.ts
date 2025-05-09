import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { EditorView } from 'codemirror';

import { EditorState } from "@codemirror/state"
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
export const useEditorStore = defineStore('editor', () => {
  const code = ref('')
  const view = ref(null as EditorView | null);
  const setViewFromDiv = (div: HTMLElement) => {
    view.value = new EditorView({
      state: EditorState.create({
        doc: code.value,
        extensions: [basicSetup, javascript(),
          EditorView.updateListener.of((v) => {
            code.value = v.state.doc.toString();
          })
        ]
      }),
      parent: div,
    })
  }
  const setCode = (new_val) => {
    if (view.value) {
      code.value = new_val
      view.value.dispatch({
        changes: {
          from: 0,
          to: view.value.state.doc.length,
          insert: new_val
        }
      })
    }
  }

  return { view, setCode, setViewFromDiv, code }
})
