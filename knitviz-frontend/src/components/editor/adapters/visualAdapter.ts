import type { GlobalEditorState } from "@/stores/globalEditorStore";
import type { GraphSnapshot } from "@/knitgraph/snapshot";
import type { EditorAdapter } from "@/components/editor/adapters/adapterInterface";
import type { VisualEditorState } from "@/components/editor/editor.types";
import { executeCodeToSnapshot } from "@/components/editor/adapters/adapterUtils";

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
    return executeCodeToSnapshot(input.code);
  },
  toStore(input: VisualAdapterInput) {
    return {
      visual: {
        workspaceJson: input.workspaceJson,
        generatedCode: input.code,
      } satisfies VisualEditorState,
      graph: this.createSnapshot(input),
    };
  },
};
