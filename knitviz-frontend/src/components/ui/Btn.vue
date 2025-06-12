<script setup lang="ts">
import { ref, watch, reactive, computed, onMounted, type ModelRef, defineEmits } from 'vue'
const state = reactive({
    clicked: false
})
const model: ModelRef<boolean> = defineModel({})
const props = defineProps({
    btn_height: {
        type: String,
        default: '1.4rem'
    },
    btn_width: {
        type: String,
        default: '10rem'
    },
    toggleable: {
        type: Boolean,
        default: false
    }
})
const emit = defineEmits<{
    (e: 'click', evt: MouseEvent): void
}>()
function update(evt) {
    state.clicked = true
    setTimeout(() => {
        state.clicked = false
    }, 2000)
    evt.preventDefault()
    emit('click', evt)
    if (props.toggleable) {
        model.value = !model.value
    }
}
</script>
<template>
    <span class="wrapper_clickable" >
        <button v-if="props.toggleable" class="clickable_container" @click="update" 
            :class="{'clickable_container_clicked': state.clicked, 'clickable_selected': model }">
            <slot></slot>
        </button>
        <div v-else @click="update">
            <input type="checkbox" id="btnControl" />
            <label class="clickable_container" for="btnControl" :class="{'clickable_container_clicked': state.clicked, 'clickable_selected': model }">
                <slot></slot>
            </label>

        </div>
    </span>
</template>
<style scoped>
.clickable_container {
    cursor: pointer;
    padding: 0.5rem;
    border: 1px solid #b8b7b7;
    height: v-bind("props.btn_height");
    width: v-bind("props.btn_width");
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    justify-items: center;
}

.clickable_container:hover {
    border-color: #8fa3a8;
}
.clickable_container_clicked {
    animation-play-state: running;
    animation: clickable_container_click 0.2s ease-in-out;
}
@keyframes clickable_container_click {
    0% {
        background-color: #d5e9ed ;
    }
    100% {
        background-color: #ffffff;
    }
    
}

.clickable_container:active {
    border-color: #8fa0a8;
}

.clickable_selected {
    background-color: #d5e9ed;
}

.wrapper_clickable {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2px;
}
#btnControl {
    display: none;
}
</style>