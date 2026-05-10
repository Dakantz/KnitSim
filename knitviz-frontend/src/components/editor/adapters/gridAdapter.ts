import type { GlobalEditorState } from "@/stores/globalEditorStore";
import { EditorType } from "@/stores/globalEditorStore";
import { graphToSnapshot, type GraphSnapshot } from "@/knitgraph/snapshot";
import { KnitGraph, KnitMode, KnitNode, KnitNodeType } from "@/knitgraph";
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

const toCssHexColor = (value: number | string): string => {
  if (typeof value === "string") {
    return value;
  }

  const normalized = Math.max(0, Math.min(0xffffff, Math.trunc(value)));
  return `#${normalized.toString(16).padStart(6, "0")}`;
};

const toGridStitchType = (nodeType: KnitNodeType): string => {
  if (nodeType === KnitNodeType.PURL) {
    return "PURL";
  }

  if (nodeType === KnitNodeType.YARN_OVER) {
    return "YARN_OVER";
  }

  return "KNIT";
};

const matrixFromSnapshot = (snapshot: GraphSnapshot): GridCellState[][] => {
  if (snapshot.nodes.length === 0) {
    return toMatrix({
      rows: DEFAULT_GRID_ROWS,
      cols: DEFAULT_GRID_COLS,
      cells: [],
      castOnMode: "round",
      cellSize: 20,
    });
  }

  const byRow = new Map<number, typeof snapshot.nodes>();
  for (const node of snapshot.nodes) {
    const rowNodes = byRow.get(node.rowNumber) ?? [];
    rowNodes.push(node);
    byRow.set(node.rowNumber, rowNodes);
  }

  let sortedRows = [...byRow.keys()].sort((a, b) => a - b);
  if (sortedRows.length > 0) {
    const firstRowNodes = byRow.get(sortedRows[0]) ?? [];
    const isCastOnRow = firstRowNodes.length > 0 && firstRowNodes.every((node) => node.type === KnitNodeType.CAST_ON);
    if (isCastOnRow) {
      sortedRows = sortedRows.slice(1);
    }
  }

  if (sortedRows.length === 0) {
    return toMatrix({
      rows: DEFAULT_GRID_ROWS,
      cols: DEFAULT_GRID_COLS,
      cells: [],
      castOnMode: "round",
      cellSize: 20,
    });
  }

  const allCols = sortedRows.flatMap((rowNumber) => (byRow.get(rowNumber) ?? []).map((node) => node.colNumber));
  const minCol = Math.min(...allCols);
  const maxCol = Math.max(...allCols);
  const cols = Math.max(1, maxCol - minCol + 1);
  const rows = sortedRows.length;
  const matrix = createGrid(rows, cols);

  sortedRows.forEach((rowNumber, normalizedRow) => {
    const rowNodes = byRow.get(rowNumber) ?? [];
    rowNodes.forEach((node) => {
      const normalizedCol = node.colNumber - minCol;
      const cell = matrix[normalizedRow]?.[normalizedCol];
      if (!cell) {
        return;
      }

      cell.type = toGridStitchType(node.type);
      cell.color = toCssHexColor(node.color);
    });
  });

  return matrix;
};

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
  castOnMode: "round",
  cellSize: 20,
});

const defaultMatrix = () =>
  toMatrix({
    rows: DEFAULT_GRID_ROWS,
    cols: DEFAULT_GRID_COLS,
    cells: [],
    castOnMode: "round",
    cellSize: 20,
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

type GridAdapterInput = {
  matrix: GridCellState[][];
  castOnMode: "flat" | "round";
  cellSize: number;
};

type GridToStore = {
  grid: GridEditorState;
  graph: GraphSnapshot;
};

export const gridAdapter: EditorAdapter<GlobalEditorState, { matrix: GridCellState[][]; castOnMode: "flat" | "round"; cellSize: number }, GridAdapterInput, GridToStore> = {
  fromStore(state: GlobalEditorState) {
    const gridState = state.editors.grid;
    const hasStoredCells = gridState.cells.length > 0;

    if (state.graph.nodes.length > 0 && (!hasStoredCells || state.sourceEditor !== EditorType.GRID)) {
      return {
        matrix: matrixFromSnapshot(state.graph),
        castOnMode: gridState.castOnMode,
        cellSize: gridState.cellSize,
      };
    }

    if (hasStoredCells) {
      return {
        matrix: toMatrix(gridState),
        castOnMode: gridState.castOnMode,
        cellSize: gridState.cellSize,
      };
    }

    return {
      matrix: defaultMatrix(),
      castOnMode: gridState.castOnMode,
      cellSize: gridState.cellSize,
    };
  },
  createSnapshot(input: GridAdapterInput) {
    const { matrix, castOnMode } = input;
    KnitNode.idCounter = 0;
    const graph = new KnitGraph();
    const width = matrix[0]?.length ?? 0;

    graph.state.cast_on(width, castOnMode === "flat" ? KnitMode.FLAT : KnitMode.ROUND);
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
  toStore(input: GridAdapterInput) {
    const snapshot = this.createSnapshot(input);
    const grid = {
      ...toFlat(input.matrix),
      castOnMode: input.castOnMode,
      cellSize: input.cellSize,
    };
    return {
      grid,
      graph: snapshot,
    };
  },
};
