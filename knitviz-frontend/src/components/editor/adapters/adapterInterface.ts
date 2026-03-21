import type { GraphSnapshot } from "@/knitgraph/snapshot";

export interface EditorAdapter<TStoreState, TEditorState, TInput, TStorePayload extends { graph: GraphSnapshot }> {
  fromStore(state: TStoreState): TEditorState;
  createSnapshot(input: TInput): GraphSnapshot;
  toStore(input: TInput): TStorePayload;
}
