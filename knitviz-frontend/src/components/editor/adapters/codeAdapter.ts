import type { GlobalEditorState } from "@/stores/globalEditorStore";
import { graphToSnapshot, type GraphSnapshot } from "@/knitgraph/snapshot";
import { KnitGraph } from "@/knitgraph";
import type { EditorAdapter } from "@/components/editor/adapters/adapterInterface";

type CodeFromStore = {
  code: string;
};

type CodeToStore = {
  code: string;
  graph: GraphSnapshot;
};

export const codeAdapter: EditorAdapter<GlobalEditorState, CodeFromStore, string, CodeToStore> = {
  fromStore(state: GlobalEditorState) {
    return {
      code: state.editors.code.editorContent,
    };
  },
  createSnapshot(code: string) {
    const graph = new KnitGraph();
    graph.execute(code);
    return graphToSnapshot(graph);
  },
  toStore(code: string) {
    const snapshot = this.createSnapshot(code);
    return {
      code,
      graph: snapshot,
    };
  },
};
