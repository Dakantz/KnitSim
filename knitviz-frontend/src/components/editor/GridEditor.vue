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
import type { GridCellState } from "@/components/editor/editor.types";

const emit = defineEmits<{
	(e: "generate", payload: {
		graph: GraphSnapshot;
		grid: { rows: number; cols: number; cells: GridCellState[] };
	}): void;
}>();

const store = useGlobalEditorStore();
const sampleStore = useGridSamplesStore();
const gridState = reactive({
	activeStitch: DEFAULT_GRID_STITCH_TYPE,
	activeColor: DEFAULT_GRID_COLOR,
	rows: DEFAULT_GRID_ROWS,
	cols: DEFAULT_GRID_COLS,
	isPainting: false,
	cellMatrix: [] as GridCellState[][],
});

const stitchOptions = ["KNIT", "PURL", "YARN_OVER"];
const sampleNames = sampleStore.names;
const cellSize = 20;
const cellGap = 2;

const loadFromStore = () => {
	const { matrix } = gridAdapter.fromStore(store.state);
	gridState.cellMatrix = matrix.map((row) => row.map((cell) => ({ ...cell })));
	gridState.rows = gridState.cellMatrix.length;
	gridState.cols = gridState.cellMatrix[0]?.length ?? 0;
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

	cell.type = gridState.activeStitch;
	cell.color = gridState.activeColor;
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
			cell.type = gridState.activeStitch;
			cell.color = gridState.activeColor;
		});
	});
};

const generate = () => {
	const payload = gridAdapter.toStore(gridState.cellMatrix);
	emit("generate", payload);
};

const cellsTotal = computed(() => gridState.rows * gridState.cols);
const cellsFlat = computed(() => gridState.cellMatrix.flat());
const svgWidth = computed(() => gridState.cols * (cellSize + cellGap) + cellGap);
const svgHeight = computed(() => gridState.rows * (cellSize + cellGap) + cellGap);

const getShortType = (type: string) => {
	if (type === "YARN_OVER") {
		return "YO";
	}

	return type.slice(0, 1);
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
				Color
				<input v-model="gridState.activeColor" type="color" />
			</label>
			<Btn btn_width="6.5rem" btn_height="2.6rem" @click="fill">Fill</Btn>
			<Btn btn_width="6.5rem" btn_height="2.6rem" @click="reset">Reset</Btn>
			<span class="summary">{{ cellsTotal }} cells</span>
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
					:transform="`translate(${cell.col * (cellSize + cellGap) + cellGap}, ${cell.row * (cellSize + cellGap) + cellGap})`"
					@mousedown.prevent="paintStart(cell.row, cell.col)"
					@mouseenter="paintDrag(cell.row, cell.col)"
				>
					<rect
						class="grid-cell"
						:width="cellSize"
						:height="cellSize"
						:fill="cell.color"
						:aria-label="`${cell.type} (${cell.row}, ${cell.col})`"
					/>
					<text
						:x="cellSize/2"
						:y="cellSize/2"
						class="grid-label"
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
	font-size: 9px;
	font-weight: 700;
	fill: rgba(17, 31, 39, 0.75);
	pointer-events: none;
	user-select: none;
}
</style>
