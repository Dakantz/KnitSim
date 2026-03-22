import type { GlobalEditorState } from "@/stores/globalEditorStore";
import { graphToSnapshot, type GraphSnapshot } from "@/knitgraph/snapshot";
import { KnitGraph } from "@/knitgraph";
import type { EditorAdapter } from "@/components/editor/adapters/adapterInterface";
import type { VisualEditorState } from "@/components/editor/editor.types";

export type VisualAdapterInput = {
  workspaceJson: string;
  code: string;
};

type VisualToStore = {
  visual: VisualEditorState;
  graph: GraphSnapshot;
};

export const visualAdapter: EditorAdapter<GlobalEditorState, VisualAdapterInput, VisualAdapterInput, VisualToStore> = {
  fromStore(state: GlobalEditorState) {
    return {
      workspaceJson: state.editors.visual.workspaceJson,
      code: state.editors.visual.generatedCode,
    };
  },
  createSnapshot(input: VisualAdapterInput) {
    const graph = new KnitGraph();
    graph.execute(input.code);
    return graphToSnapshot(graph);
  },
  toStore(input: VisualAdapterInput) {
    const snapshot = this.createSnapshot(input);
    const visual: VisualEditorState = {
      workspaceJson: input.workspaceJson,
      generatedCode: input.code,
    };

    return {
      visual,
      graph: snapshot,
    };
  },
};
