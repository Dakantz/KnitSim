import type { GlobalEditorState } from "@/stores/globalEditorStore";
import { graphToSnapshot, type GraphSnapshot } from "@/knitgraph/snapshot";
import { KnitGraph, KnitNodeType } from "@/knitgraph";
import type { EditorAdapter } from "@/components/editor/adapters/adapterInterface";
import {
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_STITCH_TYPE,
  MIN_GRID_COLS,
  MIN_GRID_ROWS,
  MAX_GRID_COLS,
  MAX_GRID_ROWS,
} from "@/components/editor/editor.constants";
import type { GridCellState, GridEditorState } from "@/components/editor/editor.types";

const createCell = (row: number, col: number): GridCellState => ({
  id: `${row}-${col}`,
  row,
  col,
  type: DEFAULT_GRID_STITCH_TYPE,
  color: DEFAULT_GRID_COLOR,
});

const createGrid = (rows: number, cols: number): GridCellState[][] =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => createCell(row, col)),
  );

const toMatrix = (gridState: GridEditorState): GridCellState[][] => {
  const rows = Math.max(MIN_GRID_ROWS, Math.min(MAX_GRID_ROWS, gridState.rows || DEFAULT_GRID_ROWS));
  const cols = Math.max(MIN_GRID_COLS, Math.min(MAX_GRID_COLS, gridState.cols || DEFAULT_GRID_COLS));
  const matrix = createGrid(rows, cols);

  for (const cell of gridState.cells) {
    if (matrix[cell.row]?.[cell.col]) {
      matrix[cell.row][cell.col] = {
        ...cell,
        id: `${cell.row}-${cell.col}`,
      };
    }
  }

  return matrix;
};

const toFlat = (matrix: GridCellState[][]): GridEditorState => ({
  rows: matrix.length,
  cols: matrix[0]?.length || 0,
  cells: matrix.flat().map((cell) => ({ ...cell })),
});

const normalizeStitchType = (value: string): KnitNodeType => {
  const normalized = value.toUpperCase();

  if (normalized === "PURL") {
    return KnitNodeType.PURL;
  }

  if (normalized === "YARN_OVER") {
    return KnitNodeType.YARN_OVER;
  }

  return KnitNodeType.KNIT;
};

type GridToStore = {
  grid: GridEditorState;
  graph: GraphSnapshot;
};

export const gridAdapter: EditorAdapter<GlobalEditorState, { matrix: GridCellState[][] }, GridCellState[][], GridToStore> = {
  fromStore(state: GlobalEditorState) {
    const gridState = state.editors.grid;
    const hasStoredCells = gridState.cells.length > 0;
    const fallback = toMatrix({
      rows: DEFAULT_GRID_ROWS,
      cols: DEFAULT_GRID_COLS,
      cells: [],
    });

    return {
      matrix: hasStoredCells ? toMatrix(gridState) : fallback,
    };
  },
  createSnapshot(matrix: GridCellState[][]) {
    const graph = new KnitGraph();
    const width = matrix[0]?.length ?? 0;

    graph.state.cast_on(width);
    matrix.forEach((row) => {
      let runType: string | null = null;
      let runColor: string | null = null;
      let runLength = 0;

      const flush = () => {
        if (!runType || runLength <= 0) {
          return;
        }

        graph.state.color(runColor as string);
        const normalized = normalizeStitchType(runType);
        if (normalized === KnitNodeType.YARN_OVER) {
          graph.state.knit(runLength, KnitNodeType.KNIT, KnitNodeType.YARN_OVER);
        } else {
          graph.state.knit(runLength, normalized);
        }
        runLength = 0;
      };

      row.forEach((cell) => {
        if (cell.type === runType && cell.color === runColor) {
          runLength += 1;
          return;
        }

        flush();
        runType = cell.type;
        runColor = cell.color;
        runLength = 1;
      });

      flush();
      graph.state.end_row();
    });

    return graphToSnapshot(graph);
  },
  toStore(matrix: GridCellState[][]) {
    const snapshot = this.createSnapshot(matrix);
    const grid = toFlat(matrix);
    return {
      grid,
      graph: snapshot,
    };
  },
};
