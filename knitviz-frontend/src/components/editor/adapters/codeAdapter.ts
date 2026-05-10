import type { GlobalEditorState } from "@/stores/globalEditorStore";
import type { GraphSnapshot } from "@/knitgraph/snapshot";
import type { EditorAdapter } from "@/components/editor/adapters/adapterInterface";
import { executeCodeToSnapshot } from "@/components/editor/adapters/adapterUtils";

export const codeAdapter: EditorAdapter<GlobalEditorState, { code: string }, string, { code: string; graph: GraphSnapshot }> = {
  fromStore(state: GlobalEditorState) {
    return {
      code: state.editors.code.editorContent,
    };
  },
  createSnapshot(code: string) {
    return executeCodeToSnapshot(code);
  },
  toStore(code: string) {
    return {
      code,
      graph: this.createSnapshot(code),
    };
  },
};
