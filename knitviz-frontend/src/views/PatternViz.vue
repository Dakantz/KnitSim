<template>
    <main>
        <div class="pattern_viz">
            <div class="code_editor">
                <div>
                    <button @click="state.code = state.examples[k]" v-for="k in Object.keys(state.examples)">{{ k
                    }}</button>
                </div>
                <Code v-model="state.code">
                </Code>
                <button @click="runCode">Run</button>
                <div>
                    <button @click="startSim" v-if="!state.simulation.running">Simulate</button>
                    <button @click="stopSim" v-if="state.simulation.running">Stop</button>
                    <span>Step: {{ state.simulation.step }} / Delta: {{ state.simulation.acc_delta }}</span>
                </div>


            </div>
            <div id="pattern_viz_3d">
            </div>
        </div>


    </main>
</template>

<script setup lang="ts">
import Code from '@/components/editor/Code.vue';
import { KnitGraph } from '../knitgraph';
import { PatternViz3D } from '../knitgraph/viz';
import { onUnmounted, reactive, ref, toRaw } from 'vue';
const state = reactive({
    graph: null as KnitGraph | null,
    simulation: {
        running: false,
        speed: 1,
        step: 0,
        timeStep: 0.1,
        timeout: null as number | null,
        acc_delta: 0.0,
    },
    examples: {
        simple_flat: `
    this.cast_on(24)
    const knit_row=()=>{
        for (let i = 0; i < 6; i++) {
            this.knit(2, 'purl')
            this.knit(2, 'knit')
        }
        this.end_row()
    }
    for (let i = 0; i < 6; i++) {
        knit_row()
    }
    for(let i = 0; i < 6; i++){
        this.knit(24, 'purl')
        this.end_row()
        this.knit(24, 'knit')
        this.end_row()
    }
    for(let i = 0; i < 6; i++){
        this.knit(24, 'knit')
        this.end_row()
        this.knit(24, 'knit')
        this.end_row()
    }`,
        simple_circular: `
    this.cast_on(24, 'round')
    const knit_row=()=>{
        for (let i = 0; i < 6; i++) {
            this.knit(2, 'purl')
            this.knit(2, 'knit')
        }
        this.end_row()
    }
    for (let i = 0; i < 6; i++) {
        knit_row()
    }
    for(let i = 0; i < 6; i++){
        this.knit(24, 'purl')
        this.end_row()
        this.knit(24, 'knit')
        this.end_row()
    }
    for(let i = 0; i < 6; i++){
        this.knit(24, 'knit')
        this.end_row()
        this.knit(24, 'knit')
        this.end_row()
    }`,
    },
    code: ref(''),
    viz: null as PatternViz3D | null,

})
onUnmounted(() => {
    if (state.simulation.running) {
        stopSim()
    }
})
const runCode = () => {
    if (state.viz) {
        // state.viz.destroy()
    }
    state.graph = new KnitGraph()
    state.graph.execute(state.code)
    console.log('Ran code:', state.graph)
    state.viz = new PatternViz3D('#pattern_viz_3d', state.graph)
}
const startSim = () => {
    state.simulation.running = true
    state.simulation.step = 0
    let lastTime = Date.now()
    const step = () => {
        if (state.simulation.running) {
            const now = Date.now()
            const dt = (now - lastTime) / 1000
            lastTime = now
            let viz = toRaw(state.viz)
            state.simulation.acc_delta = viz.stepSim(dt)
            state.simulation.step++
            let avg_delta = state.simulation.acc_delta / Object.keys(state.graph.nodes).length
            if (avg_delta < 1e-6 && state.simulation.step > 10) {
                stopSim()
            }
        }
    }
    state.simulation.timeout = setInterval(step, state.simulation.timeStep)
}
const stopSim = () => {
    state.simulation.running = false
    clearInterval(state.simulation.timeout)
}
</script>

<style lang="scss">
.pattern_viz {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    height: 90vh;
    width: 95vw;
}

.code_editor {
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: start;
    height: 90%;
    width: 100%;
}

#pattern_viz_3d {
    height: 90%;
    width: 100%;
    border: 1px solid rgb(168, 212, 190);
}

.threed_graph {
    height: 100%;
    width: 100%;
}
</style>