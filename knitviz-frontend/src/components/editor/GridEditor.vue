<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, watch } from "vue";
import Btn from "@/components/ui/Btn.vue";
import { useGlobalEditorStore } from "@/stores/globalEditorStore";
import { useGridSamplesStore } from "@/stores/samples/gridsamples";
import { gridAdapter } from "@/components/editor/adapters/gridAdapter";
import type { GraphSnapshot } from "@/knitgraph/snapshot";
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

const STITCH_OPTIONS = ["KNIT", "PURL", "YARN_OVER"] as const;
const PAINT_MODES = ["COLOR_AND_STITCH", "COLOR_ONLY"] as const;
const CAST_ON_MODES = ["round", "flat"] as const;
const LABEL_MODES = ["ABBREVIATION", "UNICODE"] as const;
type PaintMode = (typeof PAINT_MODES)[number];
type CastOnMode = (typeof CAST_ON_MODES)[number];
type LabelMode = (typeof LABEL_MODES)[number];

const emit = defineEmits<{
	(e: "generate", payload: {
		graph: GraphSnapshot;
		grid: GridEditorState;
	}): void;
}>();

const store = useGlobalEditorStore();
const sampleStore = useGridSamplesStore();
const gridState = reactive({
	activeStitch: DEFAULT_GRID_STITCH_TYPE,
	activeColor: DEFAULT_GRID_COLOR,
	rows: DEFAULT_GRID_ROWS,
	cols: DEFAULT_GRID_COLS,
	paintMode: "COLOR_AND_STITCH" as PaintMode,
	castOnMode: "round" as CastOnMode,
	labelMode: "ABBREVIATION" as LabelMode,
	cellSize: 20,
	isPainting: false,
	cellMatrix: [] as GridCellState[][],
});

const stitchOptions = STITCH_OPTIONS;
const paintModes = PAINT_MODES;
const castOnModes = CAST_ON_MODES;
const labelModes = LABEL_MODES;
const sampleNames = sampleStore.names;
const cellGap = 2;
const MIN_CELL_SIZE = 1;
const MAX_CELL_SIZE = 42;
const normalizedCellSize = computed(() => {
	const next = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, gridState.cellSize || 20));
	if (next !== gridState.cellSize) {
		gridState.cellSize = next;
	}

	return next;
});

const loadFromStore = () => {
	const { matrix, castOnMode, cellSize } = gridAdapter.fromStore(store.state);
	gridState.cellMatrix = matrix.map((row) => row.map((cell) => ({ ...cell })));
	gridState.rows = gridState.cellMatrix.length;
	gridState.cols = gridState.cellMatrix[0]?.length ?? 0;
	gridState.castOnMode = castOnMode;
	gridState.cellSize = cellSize;
};

const ensureGridSize = (rows: number, cols: number) => {
	const clampedRows = Math.max(MIN_GRID_ROWS, Math.min(MAX_GRID_ROWS, rows));
	const clampedCols = Math.max(MIN_GRID_COLS, Math.min(MAX_GRID_COLS, cols));

	if (gridState.rows !== clampedRows) {
		gridState.rows = clampedRows;
	}
	if (gridState.cols !== clampedCols) {
		gridState.cols = clampedCols;
	}

	const next = Array.from({ length: clampedRows }, (_, row) =>
		Array.from({ length: clampedCols }, (_, col) => {
			const existingCell = gridState.cellMatrix[row]?.[col];
			return existingCell
				? { ...existingCell, id: `${row}-${col}`, row, col }
				: {
						id: `${row}-${col}`,
						row,
						col,
						type: DEFAULT_GRID_STITCH_TYPE,
						color: DEFAULT_GRID_COLOR,
					};
		}),
	);

	gridState.cellMatrix = next;
};

const paintCell = (row: number, col: number) => {
	const cell = gridState.cellMatrix[row]?.[col];
	if (!cell) {
		return;
	}

	cell.color = gridState.activeColor;
	if (gridState.paintMode === "COLOR_AND_STITCH") {
		cell.type = gridState.activeStitch;
	}
};

const paintStart = (row: number, col: number) => {
	gridState.isPainting = true;
	paintCell(row, col);
};

const paintDrag = (row: number, col: number) => {
	if (!gridState.isPainting) {
		return;
	}

	paintCell(row, col);
};

const paintStop = () => {
	gridState.isPainting = false;
};

const applySample = (name: string) => {
	const matrix = sampleStore.buildMatrix(name);
	if (!matrix) {
		return;
	}

	gridState.cellMatrix = matrix;
	gridState.rows = matrix.length;
	gridState.cols = matrix[0]?.length ?? 0;
};

const reset = () => {
	loadFromStore();
};

const fill = () => {
	gridState.cellMatrix.forEach((row) => {
		row.forEach((cell) => {
			cell.color = gridState.activeColor;

			if (gridState.paintMode === "COLOR_AND_STITCH") {
				cell.type = gridState.activeStitch;
			}
		});
	});
};

const generate = () => {
	const payload = gridAdapter.toStore({
		matrix: gridState.cellMatrix,
		castOnMode: gridState.castOnMode,
		cellSize: normalizedCellSize.value,
	});
	emit("generate", payload);
};

const cellsTotal = computed(() => gridState.rows * gridState.cols);
const cellsFlat = computed(() => gridState.cellMatrix.flat());
const svgWidth = computed(() => gridState.cols * (normalizedCellSize.value + cellGap) + cellGap);
const svgHeight = computed(() => gridState.rows * (normalizedCellSize.value + cellGap) + cellGap);
const gridLabelFontSize = computed(() => `${Math.max(9, Math.floor(normalizedCellSize.value * 0.46))}px`);

const symbolSets = {
	ABBREVIATION: {
		KNIT: "K",
		PURL: "P",
		YARN_OVER: "YO",
		KNIT_OVER: "YO",
	},
	UNICODE: {
		KNIT: "■",
		PURL: "●",
		YARN_OVER: "○",
		KNIT_OVER: "○",
	},
} as const;

const legendItems = computed(() => {
	const set = symbolSets[gridState.labelMode];
	return [
		{ type: "KNIT", label: set.KNIT, title: "Knit" },
		{ type: "PURL", label: set.PURL, title: "Purl" },
		{ type: "YARN_OVER", label: set.YARN_OVER, title: "Yarn over / knit over" },
	];
});

const getShortType = (type: string) => {
	const set = symbolSets[gridState.labelMode];
	return set[type as keyof typeof set] ?? type.slice(0, 1);
};

loadFromStore();

const stopGridSizeWatch = watch(
	() => [gridState.rows, gridState.cols],
	([rows, cols]) => {
		ensureGridSize(rows, cols);
	},
);

const stopRevisionWatch = watch(
	() => store.state.revision,
	() => {
		loadFromStore();
	},
);

defineExpose({
	generate,
	reset,
});

onMounted(() => {
	window.addEventListener("mouseup", paintStop);
});

onUnmounted(() => {
	window.removeEventListener("mouseup", paintStop);

	stopGridSizeWatch();
	stopRevisionWatch();
});
</script>

<template>
	<section class="grid-editor">
		<div class="sample-bar" v-if="sampleNames.length > 0">
			<span>Grid Samples</span>
			<Btn btn_width="7.5rem" btn_height="2.6rem" v-for="name in sampleNames" :key="name" @click="applySample(name)">
				{{ name }}
			</Btn>
		</div>

		<div class="toolbar">
			<label>
				Rows
				<input v-model.number="gridState.rows" type="number" :min="MIN_GRID_ROWS" :max="MAX_GRID_ROWS" />
			</label>
			<label>
				Cols
				<input v-model.number="gridState.cols" type="number" :min="MIN_GRID_COLS" :max="MAX_GRID_COLS" />
			</label>
			<label>
				Stitch
				<select v-model="gridState.activeStitch">
					<option v-for="option in stitchOptions" :key="option" :value="option">{{ option }}</option>
				</select>
			</label>
			<label>
				Paint
				<select v-model="gridState.paintMode">
					<option v-for="mode in paintModes" :key="mode" :value="mode">{{ mode === "COLOR_ONLY" ? "Color only" : "Color + stitch" }}</option>
				</select>
			</label>
			<label>
				Cast On
				<select v-model="gridState.castOnMode">
					<option v-for="mode in castOnModes" :key="mode" :value="mode">{{ mode }}</option>
				</select>
			</label>
			<label>
				Cell Size
				<input v-model.number="gridState.cellSize" type="number" :min="MIN_CELL_SIZE" :max="MAX_CELL_SIZE" />
			</label>
			<label>
				Labels
				<select v-model="gridState.labelMode">
					<option v-for="mode in labelModes" :key="mode" :value="mode">{{ mode === "ABBREVIATION" ? "Abbreviation" : "Unicode" }}</option>
				</select>
			</label>
			<label>
				Color
				<input v-model="gridState.activeColor" type="color" />
			</label>
			<Btn btn_width="6.5rem" btn_height="2.6rem" @click="fill">Fill</Btn>
			<Btn btn_width="6.5rem" btn_height="2.6rem" @click="reset">Reset</Btn>
			<span class="summary">{{ cellsTotal }} cells</span>
		</div>

		<div class="legend-bar">
			<strong>Legend:</strong>
			<span v-for="item in legendItems" :key="item.type" class="legend-item">
				<span class="legend-chip">{{ item.label }}</span>
				<span>{{ item.title }}</span>
			</span>
		</div>

		<div class="grid-container">
			<svg
				class="grid-canvas"
				:viewBox="`0 0 ${svgWidth} ${svgHeight}`"
				:width="svgWidth"
				:height="svgHeight"
				@mouseleave="paintStop"
			>
				<g
					v-for="cell in cellsFlat"
					:key="cell.id"
					:transform="`translate(${cell.col * (normalizedCellSize + cellGap) + cellGap}, ${cell.row * (normalizedCellSize + cellGap) + cellGap})`"
					@mousedown.prevent="paintStart(cell.row, cell.col)"
					@mouseenter="paintDrag(cell.row, cell.col)"
				>
					<rect
						class="grid-cell"
						:width="normalizedCellSize"
						:height="normalizedCellSize"
						:fill="cell.color"
						:aria-label="`${cell.type} (${cell.row}, ${cell.col})`"
					/>
					<text
						:x="normalizedCellSize / 2"
						:y="normalizedCellSize / 2"
						class="grid-label"
						:style="{ fontSize: gridLabelFontSize }"
						dominant-baseline="middle"
						text-anchor="middle"
					>
						{{ getShortType(cell.type) }}
					</text>
				</g>
			</svg>
		</div>
	</section>
</template>

<style scoped lang="scss">
.grid-editor {
	display: flex;
	flex-direction: column;
	gap: 0.55rem;
	height: 100%;
	min-height: 0;
}

label {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
}

input,
select {
	border: var(--border-container);
	padding: 0.22rem 0.35rem;
	background: white;
}

.summary {
	margin-left: auto;
}

.legend-bar {
	display: flex;
	align-items: center;
	gap: 0.55rem;
	flex-wrap: wrap;
	color: var(--color-text);
	font-size: 0.9rem;
}

.legend-item {
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	padding: 0.2rem 0.45rem;
	border: var(--border-container);
	border-radius: 0.32rem;
	background: var(--color-background-soft);
}

.legend-chip {
	min-width: 1.55rem;
	text-align: center;
	font-weight: 700;
	font-family: "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", "Segoe UI Symbol", "Arial Unicode MS", sans-serif;
}

.grid-container {
	border: var(--border-container);
	border-radius: var(--border-container-radius);
	background: #f9fcfb;
	overflow: auto;
	height: 100%;
	padding: 0.35rem;
}

.grid-canvas {
	display: block;
}

.grid-cell {
	cursor: pointer;
	stroke: rgba(25, 52, 66, 0.2);
	stroke-width: 1.2;
}

.grid-cell:hover {
	stroke: #2d6a88;
}

.grid-label {
	font-weight: 700;
	fill: rgba(17, 31, 39, 0.75);
	pointer-events: none;
	user-select: none;
	font-family: "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", "Segoe UI Symbol", "Arial Unicode MS", sans-serif;
}
</style>
