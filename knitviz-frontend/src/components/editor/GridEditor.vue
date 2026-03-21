<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import Btn from "@/components/ui/Btn.vue";
import { useGlobalEditorStore, type GridCellState } from "@/stores/globalEditorStore";
import { gridAdapter } from "@/components/editor/adapters/gridAdapter";
import type { GraphSnapshot } from "@/knitgraph/snapshot";

const emit = defineEmits<{
	(e: "generate", payload: {
		graph: GraphSnapshot;
		grid: { rows: number; cols: number; cells: GridCellState[] };
	}): void;
}>();

const store = useGlobalEditorStore();
const state = reactive({
	activeStitch: "KNIT",
	activeColor: "#3366ff",
	rows: 12,
	cols: 24,
	matrix: [] as GridCellState[][],
});

const stitchOptions = ["KNIT", "PURL", "YARN_OVER"];

const loadFromStore = () => {
	const { matrix } = gridAdapter.fromStore(store.state);
	state.matrix = matrix.map((row) => row.map((cell) => ({ ...cell })));
	state.rows = state.matrix.length;
	state.cols = state.matrix[0]?.length ?? 0;
};

const ensureGridSize = (rows: number, cols: number) => {
	const normalizedRows = Math.max(4, Math.min(40, rows));
	const normalizedCols = Math.max(4, Math.min(40, cols));

	if (state.rows !== normalizedRows) {
		state.rows = normalizedRows;
	}
	if (state.cols !== normalizedCols) {
		state.cols = normalizedCols;
	}

	const next = Array.from({ length: normalizedRows }, (_, row) =>
		Array.from({ length: normalizedCols }, (_, col) => {
			const existing = state.matrix[row]?.[col];
			return existing
				? { ...existing, id: `${row}-${col}`, row, col }
				: {
						id: `${row}-${col}`,
						row,
						col,
						type: "KNIT",
						color: "#7ca9ff",
					};
		}),
	);

	state.matrix = next;
};

const paint = (row: number, col: number) => {
	const cell = state.matrix[row]?.[col];
	if (!cell) {
		return;
	}

	cell.type = state.activeStitch;
	cell.color = state.activeColor;
};

const reset = () => {
	loadFromStore();
};

const fill = () => {
	state.matrix.forEach((row) => {
		row.forEach((cell) => {
			cell.type = state.activeStitch;
			cell.color = state.activeColor;
		});
	});
};

const generate = () => {
	const payload = gridAdapter.toStore(state.matrix);
	emit("generate", payload);
};

const totalCells = computed(() => state.rows * state.cols);

loadFromStore();

watch(
	() => [state.rows, state.cols],
	([rows, cols]) => {
		ensureGridSize(rows, cols);
	},
);

watch(
	() => store.state.revision,
	() => {
		loadFromStore();
	},
);

defineExpose({
	generate,
	reset,
});
</script>

<template>
	<section class="grid_editor">
		<div class="toolbar">
			<label>
				Rows
				<input v-model.number="state.rows" type="number" min="4" max="40" />
			</label>
			<label>
				Cols
				<input v-model.number="state.cols" type="number" min="4" max="40" />
			</label>
			<label>
				Stitch
				<select v-model="state.activeStitch">
					<option v-for="option in stitchOptions" :key="option" :value="option">{{ option }}</option>
				</select>
			</label>
			<label>
				Color
				<input v-model="state.activeColor" type="color" />
			</label>
			<Btn btn_width="7rem" @click="fill">Fill</Btn>
			<Btn btn_width="7rem" @click="reset">Reset</Btn>
			<Btn btn_width="8rem" @click="generate">Generate</Btn>
			<span class="summary">{{ totalCells }} cells</span>
		</div>

		<div class="grid_surface">
			<div v-for="(row, rowIndex) in state.matrix" :key="rowIndex" class="grid_row">
				<button
					v-for="(cell, colIndex) in row"
					:key="cell.id"
					class="grid_cell"
					:title="`${cell.type} (${cell.row}, ${cell.col})`"
					:style="{ backgroundColor: cell.color }"
					@click="paint(rowIndex, colIndex)"
				></button>
			</div>
		</div>
	</section>
</template>

<style scoped lang="scss">
.grid_editor {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: end;
	gap: 0.75rem;
}

label {
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
	font-size: 0.9rem;
}

input,
select {
	border: 1px solid #b8b7b7;
	padding: 0.35rem 0.5rem;
	background: white;
}

.summary {
	margin-left: auto;
}

.grid_surface {
	border: 1px solid #b8b7b7;
	overflow: auto;
	max-height: 56vh;
	padding: 0.5rem;
}

.grid_row {
	display: flex;
}

.grid_cell {
	height: 22px;
	width: 22px;
	border: 1px solid rgba(0, 0, 0, 0.08);
	cursor: pointer;
}

.grid_cell:hover {
	outline: 1px solid #6e8799;
}
</style>
