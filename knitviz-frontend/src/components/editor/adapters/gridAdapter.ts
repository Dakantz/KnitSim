import type { GlobalEditorState, GridCellState, GridEditorState } from "@/stores/globalEditorStore";
import { graphToSnapshot, type GraphSnapshot } from "@/knitgraph/snapshot";
import { KnitGraph, KnitNodeType } from "@/knitgraph";
import type { EditorAdapter } from "@/components/editor/adapters/adapterInterface";

const defaultRows = 12;
const defaultCols = 24;
const defaultType = "KNIT";
const defaultColor = "#7ca9ff";

const createCell = (row: number, col: number): GridCellState => ({
  id: `${row}-${col}`,
  row,
  col,
  type: defaultType,
  color: defaultColor,
});

const createGrid = (rows: number, cols: number): GridCellState[][] =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => createCell(row, col)),
  );

const toMatrix = (gridState: GridEditorState): GridCellState[][] => {
  const rows = Math.max(4, Math.min(40, gridState.rows || defaultRows));
  const cols = Math.max(4, Math.min(40, gridState.cols || defaultCols));
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
      rows: defaultRows,
      cols: defaultCols,
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
