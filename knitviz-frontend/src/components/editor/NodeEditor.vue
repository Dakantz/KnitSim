<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { KnitNodeType, KnitSide } from "@/knitgraph";
import type { GraphNodeSnapshot } from "@/knitgraph/snapshot";
import type { NodeDraft, NodeDraftsById } from "@/components/editor/editor.types";

const props = defineProps<{
  selectedNode: GraphNodeSnapshot | null;
  selectedNodeId: number | null;
  snapshotNodes: GraphNodeSnapshot[];
  nodeDrafts: NodeDraftsById;
}>();

const emit = defineEmits<{
  (e: "select-node", value: number): void;
  (e: "update-node-drafts", value: NodeDraftsById): void;
}>();

const nodeTypeOptions = Object.values(KnitNodeType);
const sideOptions = Object.values(KnitSide);
const snapshotNodeListRef = ref<HTMLElement | null>(null);
const nodeFilter = ref("");

const hasSelection = computed(() => Boolean(props.selectedNode));
const snapshotNodeIds = computed(() => props.snapshotNodes.map((node) => node.id).sort((a, b) => a - b));
const draftNodeIdSet = computed(() => new Set(Object.keys(props.nodeDrafts).map((id) => Number(id))));
const selectedNodeHasDraft = computed(() => {
  if (!props.selectedNode) {
    return false;
  }

  return draftNodeIdSet.value.has(props.selectedNode.id);
});

const filteredNodeIds = computed(() => {
  const filter = nodeFilter.value.trim();
  if (!filter) {
    return snapshotNodeIds.value;
  }

  return snapshotNodeIds.value.filter((nodeId) => String(nodeId).includes(filter));
});

const toColorString = (color: number | string) => {
  if (typeof color === "number") {
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  return color;
};

const toNodeDraft = (node: GraphNodeSnapshot): NodeDraft => ({
  ...node,
  color: toColorString(node.color),
});

const selectedNodeDraft = computed<NodeDraft | null>(() => {
  if (!props.selectedNode) {
    return null;
  }
  
  return props.nodeDrafts[props.selectedNode.id] ?? toNodeDraft(props.selectedNode);
});

const selectedNodeColor = computed({
  get: () => String(selectedNodeDraft.value?.color ?? "#000000"),
  set: (value: string) => updateSelectedNodeDraft({ color: value }),
});

const selectedNodeType = computed({
  get: () => selectedNodeDraft.value?.type ?? KnitNodeType.KNIT,
  set: (value: KnitNodeType) => updateSelectedNodeDraft({ type: value }),
});

const selectedNodeSide = computed({
  get: () => selectedNodeDraft.value?.side ?? KnitSide.RIGHT,
  set: (value: KnitSide) => updateSelectedNodeDraft({ side: value }),
});

const selectedNodeLineNumber = computed({
  get: () => selectedNodeDraft.value?.lineNumber ?? 0,
  set: (value: number) => updateSelectedNodeDraft({ lineNumber: value }),
});

const selectedNodeRowNumber = computed({
  get: () => selectedNodeDraft.value?.rowNumber ?? 0,
  set: (value: number) => updateSelectedNodeDraft({ rowNumber: value }),
});

const selectedNodeColNumber = computed({
  get: () => selectedNodeDraft.value?.colNumber ?? 0,
  set: (value: number) => updateSelectedNodeDraft({ colNumber: value }),
});

const selectedNodeWeight = computed({
  get: () => selectedNodeDraft.value?.weight ?? 1,
  set: (value: number) => updateSelectedNodeDraft({ weight: value }),
});

const selectedNodeStartOfRow = computed({
  get: () => Boolean(selectedNodeDraft.value?.startOfRow),
  set: (value: boolean) => updateSelectedNodeDraft({ startOfRow: value }),
});

const selectedNodePreviousNodeId = computed({
  get: () => selectedNodeDraft.value?.previousNodeId,
  set: (value: number | null) => updateSelectedNodeDraft({ previousNodeId: value }),
});

const isDraftEqualToNode = (draft: NodeDraft, node: GraphNodeSnapshot) => {
  const base = toNodeDraft(node);
  return (
    draft.id === base.id &&
    draft.type === base.type &&
    draft.side === base.side &&
    draft.color === base.color &&
    draft.weight === base.weight &&
    draft.lineNumber === base.lineNumber &&
    draft.rowNumber === base.rowNumber &&
    draft.colNumber === base.colNumber &&
    draft.startOfRow === base.startOfRow &&
    draft.previousNodeId === base.previousNodeId
  );
};

const updateSelectedNodeDraft = (patch: Partial<NodeDraft>) => {
  if (!props.selectedNode) {
    return;
  }

  const node = props.selectedNode;
  const currentDraft = props.nodeDrafts[node.id] ?? toNodeDraft(node);
  const nextDraft: NodeDraft = {
    ...currentDraft,
    ...patch,
  };

  const nextDrafts: NodeDraftsById = { ...props.nodeDrafts };

  if (isDraftEqualToNode(nextDraft, node)) {
    delete nextDrafts[node.id];
  } else {
    nextDrafts[node.id] = nextDraft;
  }

  emit("update-node-drafts", nextDrafts);
};

const resetSelectedNodeDraft = () => {
  if (!props.selectedNode) {
    return;
  }

  const selectedId = props.selectedNode.id;
  const nextDrafts: NodeDraftsById = { ...props.nodeDrafts };
  
  delete nextDrafts[selectedId];
  emit("update-node-drafts", nextDrafts);
};

watch(
  () => props.selectedNodeId,
  async (selectedId) => {
    if (selectedId === null) {
      return;
    }

    await nextTick();
    const selectedButton = snapshotNodeListRef.value?.querySelector<HTMLButtonElement>(
      `.snapshot-node-btn[data-node-id="${selectedId}"]`,
    );
    selectedButton?.scrollIntoView({ block: "nearest" });
  },
);
</script>

<template>
  <div class="node-panel">
    <div class="node-layout">
      <aside class="snapshot-list">
        <h4>Snapshot Node IDs</h4>
        <label class="snapshot-filter">
          Filter
          <input v-model="nodeFilter" type="text" placeholder="Node ID..." />
        </label>
        <ul ref="snapshotNodeListRef">
          <li v-for="nodeId in filteredNodeIds" :key="nodeId">
            <button
              class="snapshot-node-btn"
              :data-node-id="nodeId"
              :class="{ selected: selectedNodeId === nodeId, drafted: draftNodeIdSet.has(nodeId) }"
              type="button"
              @click="emit('select-node', nodeId)"
            >
              node {{ nodeId }}
              <span v-if="draftNodeIdSet.has(nodeId)" class="draft-badge">draft</span>
            </button>
          </li>
        </ul>
      </aside>

      <div class="property-panel" v-if="hasSelection">
        <div class="property-panel-header">
          <h4>Node {{ selectedNode?.id }}</h4>
          <button
            v-if="selectedNodeHasDraft"
            class="reset-draft-btn"
            type="button"
            @click="resetSelectedNodeDraft"
          >
            Reset Draft
          </button>
        </div>
        <p>Editing all mutable node properties.</p>
        <label>
          ID
          <input :value="selectedNodeDraft?.id" type="number" readonly />
        </label>
        <label>
          Line Number
          <input v-model.number="selectedNodeLineNumber" type="number" readonly/>
        </label>
        <label>
          Row Number
          <input v-model.number="selectedNodeRowNumber" type="number" readonly/>
        </label>
        <label>
          Col Number
          <input v-model.number="selectedNodeColNumber" type="number" readonly/>
        </label>
        <label>
          Color
          <input v-model="selectedNodeColor" type="color" />
        </label>
        <label>
          Weight
          <input v-model.number="selectedNodeWeight" type="number" step="0.01" min="0" />
        </label>
        <label>
          Start Of Row
          <input v-model="selectedNodeStartOfRow" type="checkbox" />
        </label>
        <label>
          Type
          <select v-model="selectedNodeType">
            <option v-for="type in nodeTypeOptions" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>
        <label>
          Side
          <select v-model="selectedNodeSide">
            <option v-for="side in sideOptions" :key="side" :value="side">{{ side }}</option>
          </select>
        </label>
        <label>
          Previous Node ID
          <input
            :value="selectedNodePreviousNodeId ?? ''"
            type="number"
            readonly
          />
        </label>
      </div>

      <div class="property-panel" v-else>
        <h4>No Node Selected</h4>
        <p>Click a node in the renderer or choose a node ID from the list.</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.node-panel {
  margin-top: 0.55rem;
  border: var(--border-container);
  background: var(--color-background-soft);
  padding: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 0;
  height: 100%;
}

.node-layout {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
}

.snapshot-list {
  flex: 0 0 25%;
  margin-right: 0.5rem;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.snapshot-filter {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.35rem;
}

.snapshot-filter input {
  border: var(--border-container);
  background: var(--color-background);
  color: var(--color-text);
  min-height: 1.85rem;
  padding: 0.1rem 0.3rem;
}

.snapshot-list ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow-y: auto;
  min-height: 0;
}

input[readonly] {
  background: var(--color-background-soft) !important;
}

input[disabled] {
  background: var(--color-background-soft) !important;
  color: var(--color-text-muted) !important;
  cursor: not-allowed;
}

.snapshot-node-btn {
  width: 100%;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: var(--border-container);
  background: var(--color-background-soft);
  color: var(--color-text);
  padding: 0.2rem 0.35rem;
  cursor: pointer;
}

.snapshot-node-btn.drafted {
  border-color: #7f58ff;
}

.snapshot-node-btn.selected {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.draft-badge {
  font-size: 0.68rem;
  line-height: 1;
  border: 1px solid #7f58ff;
  color: #7f58ff;
  border-radius: 0.75rem;
  padding: 0.12rem 0.35rem;
}

.property-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.property-panel-header h4 {
  margin: 0;
}

.reset-draft-btn {
  border: var(--border-container);
  border-radius: 0.35rem;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  min-height: 1.9rem;
  padding: 0.1rem 0.6rem;
}

.property-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 0;
  overflow: auto;
}

.node-panel label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.node-panel input,
.node-panel select {
  border: var(--border-container);
  background: var(--color-background);
  color: var(--color-text);
  min-height: 1.85rem;
  padding: 0.1rem 0.3rem;
}

@media (max-width: 720px) {
  .node-layout {
    grid-template-columns: 1fr;
  }
}
</style>
