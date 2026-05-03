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
  "Diagonal Fade": {
    rows: 18,
    cols: 24,
    cells: Array.from({ length: 18 * 24 }, (_, index) => {
      const row = Math.floor(index / 24);
      const col = index % 24;
      const diagonalBand = Math.floor((row + col) / 4) % 3;

      if (diagonalBand === 0) {
        return {
          row,
          col,
          type: "KNIT",
          color: "#4f88ff",
        };
      }

      if (diagonalBand === 1) {
        return {
          row,
          col,
          type: "PURL",
          color: "#ffd27a",
        };
      }

      return {
        row,
        col,
        type: "YARN_OVER",
        color: "#ff8d73",
      };
    }),
  },
  "Center Texture": {
    rows: 20,
    cols: 26,
    cells: Array.from({ length: 20 * 26 }, (_, index) => {
      const row = Math.floor(index / 26);
      const col = index % 26;
      const distanceToCenter = Math.abs(col - 13);
      const isCenterBand = distanceToCenter <= 2;

      if (isCenterBand && row % 2 === 0) {
        return {
          row,
          col,
          type: "YARN_OVER",
          color: "#be6aff",
        };
      }

      return {
        row,
        col,
        type: isCenterBand ? "PURL" : "KNIT",
        color: isCenterBand ? "#9e79ff" : "#5d8cff",
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
