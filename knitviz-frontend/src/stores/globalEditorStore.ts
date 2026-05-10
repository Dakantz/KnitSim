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
    sourceEditor: EditorType.VISUAL,
    editors: {
      code: {
        editorContent: "",
      },
      grid: {
        rows: DEFAULT_GRID_ROWS,
        cols: DEFAULT_GRID_COLS,
        cells: [],
        castOnMode: "round",
        cellSize: 20,
      },
      visual: {
        workspaceJson: "",
        generatedCode: "",
      },
    },
    revision: 0,
  });

  const updateGraphState = (graph: GraphSnapshot, sourceEditor: EditorType) => {
    state.graph = graph;
    state.sourceEditor = sourceEditor;
    state.revision += 1;
  };

  const applyCodeGenerate = (payload: { code: string; graph: GraphSnapshot }) => {
    state.editors.code.editorContent = payload.code;
    updateGraphState(payload.graph, EditorType.CODE);
  };

  const applyGridGenerate = (payload: { graph: GraphSnapshot; grid: GridEditorState }) => {
    state.editors.grid = payload.grid;
    updateGraphState(payload.graph, EditorType.GRID);
  };

  const applyVisualGenerate = (payload: { graph: GraphSnapshot; visual: VisualEditorState }) => {
    state.editors.visual = payload.visual;
    state.editors.code.editorContent = payload.visual.generatedCode;
    updateGraphState(payload.graph, EditorType.VISUAL);
  };

  const applyNodeSnapshots = (updatedNodes: GraphNodeSnapshot[]) => {
    if (updatedNodes.length === 0) {
      return;
    }

    const nodeIndexById = new Map(state.graph.nodes.map((node, index) => [node.id, index]));

    for (const updatedNode of updatedNodes) {
      const nodeIndex = nodeIndexById.get(updatedNode.id);
      if (nodeIndex === undefined) {
        continue;
      }

      state.graph.nodes[nodeIndex] = { ...updatedNode };
    }

    updateGraphState(state.graph, EditorType.NODE);
  };

  return {
    state,
    applyCodeGenerate,
    applyGridGenerate,
    applyVisualGenerate,
    applyNodeSnapshots,
  };
});