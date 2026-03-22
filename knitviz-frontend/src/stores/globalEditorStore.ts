import { reactive } from "vue";
import { defineStore } from "pinia";
import type { GraphNodeSnapshot, GraphSnapshot } from "@/knitgraph/snapshot";
import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS } from "@/components/editor/editor.constants";
import type { CodeEditorState, GridEditorState, VisualEditorState } from "@/components/editor/editor.types";

export type GlobalEditorState = {
  graph: GraphSnapshot;
  sourceEditor: EditorType;
  editors: {
    code: CodeEditorState;
    grid: GridEditorState;
    visual: VisualEditorState;
  };
  revision: number;
};

export enum EditorType {
  CODE = "code",
  GRID = "grid",
  VISUAL = "visual",
  NODE = "node",
}

export const useGlobalEditorStore = defineStore("globalEditor", () => {

  const state = reactive<GlobalEditorState>({
    graph: {
      nodes: [],
      edges: [],
    },
    sourceEditor: EditorType.CODE,
    editors: {
      code: {
        editorContent: "",
      },
      grid: {
        rows: DEFAULT_GRID_ROWS,
        cols: DEFAULT_GRID_COLS,
        cells: [],
      },
      visual: {
        workspaceJson: "",
        generatedCode: "",
      },
    },
    revision: 0,
  });

  const applyCodeGenerate = (payload: { code: string; graph: GraphSnapshot }) => {
    state.editors.code.editorContent = payload.code;
    state.graph = payload.graph;
    state.sourceEditor = EditorType.CODE;
    state.revision += 1;
  };

  const applyGridGenerate = (payload: { graph: GraphSnapshot; grid: GridEditorState }) => {
    state.graph = payload.graph;
    state.sourceEditor = EditorType.GRID;
    state.editors.grid = payload.grid;
    state.revision += 1;
  };

  const applyVisualGenerate = (payload: { graph: GraphSnapshot; visual: VisualEditorState }) => {
    state.graph = payload.graph;
    state.sourceEditor = EditorType.VISUAL;
    state.editors.visual = payload.visual;
    state.revision += 1;
  };

  const applyNodeSnapshots = (updatedNodes: GraphNodeSnapshot[]) => {
    if (updatedNodes.length === 0) {
      return;
    }

    for (const updatedNode of updatedNodes) {
      const nodeIndex = state.graph.nodes.findIndex((node) => node.id === updatedNode.id);
      if (nodeIndex < 0) {
        continue;
      }

      state.graph.nodes[nodeIndex] = { ...updatedNode };
    }

    state.revision += 1;
  };

  return {
    state,
    applyCodeGenerate,
    applyGridGenerate,
    applyVisualGenerate,
    applyNodeSnapshots,
  };
});