import {reactive} from "vue";
import {defineStore} from "pinia";
import type { GraphSnapshot } from "@/knitgraph/snapshot";

export type GridCellState = {
  id: string;
  row: number;
  col: number;
  type: string;
  color: string;
};

export type GridEditorState = {
  rows: number;
  cols: number;
  cells: GridCellState[];
};

export type VisualBlockState = {
  id: string;
  type: "KNIT" | "PURL" | "YARN_OVER";
  stitches: number;
  color: string;
  repeat: number;
};

export type VisualEditorState = {
  workspaceJson: string;
  generatedCode: string;
};

export type CodeEditorState = {
  editorContent: string;
};

export type GlobalEditorState = {
  graph: GraphSnapshot;
  sourceEditor: "code" | "grid" | "visual";
  editors: {
    code: CodeEditorState;
    grid: GridEditorState;
    visual: VisualEditorState;
  };
  revision: number;
};

export const useGlobalEditorStore = defineStore("globalEditor", () => {
  const state = reactive<GlobalEditorState>({
    graph: {
      nodes: [],
      edges: [],
    },
    sourceEditor: "code",
    editors: {
      code: {
        editorContent: "",
      },
      grid: {
        rows: 12,
        cols: 24,
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
    state.sourceEditor = "code";
    state.revision += 1;
  };

  const applyGridGenerate = (payload: { graph: GraphSnapshot; grid: GridEditorState }) => {
    state.graph = payload.graph;
    state.sourceEditor = "grid";
    state.editors.grid = payload.grid;
    state.revision += 1;
  };

  const applyVisualGenerate = (payload: { graph: GraphSnapshot; visual: VisualEditorState }) => {
    state.graph = payload.graph;
    state.sourceEditor = "visual";
    state.editors.visual = payload.visual;
    state.revision += 1;
  };

  return {
    state,
    applyCodeGenerate,
    applyGridGenerate,
    applyVisualGenerate,
  };
});