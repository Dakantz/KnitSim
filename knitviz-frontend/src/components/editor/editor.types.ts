import type { KnitNodeType, KnitSide } from "@/knitgraph";
import type { GraphNodeSnapshot } from "@/knitgraph/snapshot";

export type VizStatus = {
  isLoading: boolean;
  isReady: boolean;
  isRunning: boolean;
  isCancelling: boolean;
  isSimulationStopping: boolean;
  step: number;
  accDelta: number;
};

export type NodeDraft = GraphNodeSnapshot;

export type NodeDraftsById = Record<number, NodeDraft>;

export type NodeDraftPreview = {
  color: GraphNodeSnapshot["color"];
  type: KnitNodeType;
  side: KnitSide;
};

export type DraftPreviewPayload = {
  id: number;
  draft: NodeDraftPreview;
};

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

export type VisualEditorState = {
  workspaceJson: string;
  generatedCode: string;
};

export type CodeEditorState = {
  editorContent: string;
};