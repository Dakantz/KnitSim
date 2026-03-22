<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { KnitNodeType, KnitSide } from "@/knitgraph";
import type { GraphNodeSnapshot } from "@/knitgraph/snapshot";
import type { DraftPreviewPayload, NodeDraft, NodeDraftsById } from "@/components/editor/editor.types";

const props = defineProps<{
  selectedNode: GraphNodeSnapshot | null;
  selectedNodeId: number | null;
  snapshotNodes: GraphNodeSnapshot[];
  nodeDrafts: NodeDraftsById;
}>();

const emit = defineEmits<{
  (e: "select-node", value: number): void;
  (e: "update-node-drafts", value: NodeDraftsById): void;
  (e: "preview-node-draft", value: DraftPreviewPayload): void;
}>();

const nodeTypeOptions = Object.values(KnitNodeType);
const sideOptions = Object.values(KnitSide);
const snapshotNodeListRef = ref<HTMLElement | null>(null);

const hasSelection = computed(() => Boolean(props.selectedNode));
const snapshotNodeIds = computed(() => props.snapshotNodes.map((node) => node.id).sort((a, b) => a - b));

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
  emit("preview-node-draft", {
    id: node.id,
    draft: {
      color: nextDraft.color,
      type: nextDraft.type,
      side: nextDraft.side,
    },
  });
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
        <ul ref="snapshotNodeListRef">
          <li v-for="nodeId in snapshotNodeIds" :key="nodeId">
            <button
              class="snapshot-node-btn"
              :data-node-id="nodeId"
              :class="{ selected: selectedNodeId === nodeId }"
              type="button"
              @click="emit('select-node', nodeId)"
            >
              node {{ nodeId }}
            </button>
          </li>
        </ul>
      </aside>

      <div class="property-panel" v-if="hasSelection">
        <h4>Node {{ selectedNode?.id }}</h4>
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
  border: var(--border-container);
  background: var(--color-background-soft);
  color: var(--color-text);
  padding: 0.2rem 0.35rem;
  cursor: pointer;
}

.snapshot-node-btn.selected {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
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
