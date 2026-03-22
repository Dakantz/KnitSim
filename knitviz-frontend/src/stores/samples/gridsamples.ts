import { defineStore } from "pinia";
import { DEFAULT_GRID_COLOR, DEFAULT_GRID_STITCH_TYPE } from "@/components/editor/editor.constants";
import type { GridCellState } from "@/components/editor/editor.types";

type GridCellInput = {
  row: number;
  col: number;
  type: GridCellState["type"];
  color: string;
};

type GridSample = {
  rows: number;
  cols: number;
  cells: GridCellInput[];
};

const createCell = (row: number, col: number): GridCellState => ({
  id: `${row}-${col}`,
  row,
  col,
  type: DEFAULT_GRID_STITCH_TYPE,
  color: DEFAULT_GRID_COLOR,
});

const gridSampleMap: Record<string, GridSample> = {
  "Checker Board": {
    rows: 18,
    cols: 24,
    cells: Array.from({ length: 18 * 24 }, (_, index) => {
      const row = Math.floor(index / 24);
      const col = index % 24;
      const isKnit = (row + col) % 2 === 0;
      return {
        row,
        col,
        type: isKnit ? "KNIT" : "PURL",
        color: isKnit ? "#5d8cff" : "#ffd36e",
      };
    }),
  },
  "Horizontal Bands": {
    rows: 22,
    cols: 25,
    cells: Array.from({ length: 22 * 25 }, (_, index) => {
      const row = Math.floor(index / 25);
      const col = index % 25;
      const band = row % 6;
      if (band <= 2) {
        return {
          row,
          col,
          type: "KNIT",
          color: DEFAULT_GRID_COLOR,
        };
      }

      return {
        row,
        col,
        type: "PURL",
        color: "#ff9f6e",
      };
    }),
  },
};

export const useGridSamplesStore = defineStore("gridSamples", () => {
  const names = Object.keys(gridSampleMap);

  const buildMatrix = (name: string) => {
    const sample = gridSampleMap[name];
    if (!sample) {
      return null;
    }

    const matrix = Array.from({ length: sample.rows }, (_, row) =>
      Array.from({ length: sample.cols }, (_, col) => createCell(row, col)),
    );

    for (const cell of sample.cells) {
      if (!matrix[cell.row]?.[cell.col]) {
        continue;
      }

      matrix[cell.row][cell.col] = {
        id: `${cell.row}-${cell.col}`,
        row: cell.row,
        col: cell.col,
        type: cell.type,
        color: cell.color,
      };
    }

    return matrix;
  };

  return {
    names,
    buildMatrix,
  };
});
