<template>
    <main>
        <div class="pattern_viz">
            <div class="code_editor">
                <h2> Code Editor </h2>
                <div class="code_editor_header">
                    <div>Prefill: </div>
                    <Btn @click="state.code = state.examples[k]" v-for="k in Object.keys(state.examples)">{{ k
                        }}</Btn>
                </div>
                <Code>
                </Code>
                <div class="code_editor_header">
                    <Btn @click="runCode">Run</Btn>
                    <Btn @click="startSim" v-if="!state.simulation.running">Simulate</Btn>
                    <Btn @click="stopSim" v-if="state.simulation.running">Stop</Btn>
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
import { PatternViz3D, PatternViz3DEvents } from '../knitgraph/3d/viz';
import { onUnmounted, reactive, ref, toRaw, watch } from 'vue';
import { useEditorStore } from '@/stores/editor';
import { KnitGraphOverlayManager } from '@/knitgraph/3d/overlay';
import type { EditorView } from 'codemirror';
import Btn from '@/components/ui/Btn.vue';

const store = useEditorStore();

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
        'Simple Flat': `this.cast_on(24)
const knit_row=(switched)=>{
    for (let i = 0; i < 6; i++) {
        if (switched) {
            this.color(0xbcba45)
            this.knit(2, 'purl')
            this.color('blue')
            this.knit(2, 'knit')
        } else {
            this.color(0xbcba45)
            this.knit(2, 'knit')
            this.color('blue')
            this.knit(2, 'purl')
        }
    }
    this.end_row()
}
for (let i = 0; i < 6; i++) {
    knit_row(false)
}
for (let i = 0; i < 6; i++) {
    knit_row(i%2 === 0)
}
for(let i = 0; i < 6; i++){

    for(let j = 0; j < 4; j++) {
        if(j%2 === 0){
            this.color(0xffb000)
        } else {
            this.color(0xdc267f)
        }
        this.knit(6, 'knit')
    }
    this.end_row()
    for(let j = 0; j < 4; j++) {
        if(j%2 === 0){
            this.color(0xffb000)
        } else {
            this.color(0xdc267f)
        }
        this.knit(6, 'purl')
    }
    this.end_row()
}
for(let i = 0; i < 6; i++){
    this.knit(24, 'knit')
    this.end_row()
    this.knit(24, 'knit')
    this.end_row()
}`,
        'Simple Circular': `this.cast_on(24, 'round')
const knit_row=(switched)=>{
    for (let i = 0; i < 6; i++) {
        if (switched) {
            this.color(0xbcba45)
            this.knit(2, 'purl')
            this.color('blue')
            this.knit(2, 'knit')
        } else {
            this.color(0xbcba45)
            this.knit(2, 'knit')
            this.color('blue')
            this.knit(2, 'purl')
        }
    }
    this.end_row()
}
for (let i = 0; i < 6; i++) {
    knit_row(false)
}
for (let i = 0; i < 6; i++) {
    knit_row(i%2 === 0)
}
for(let i = 0; i < 6; i++){
    this.color(0xbcba45)
    this.knit(24, 'purl')
    this.end_row()
    this.color('blue')
    this.knit(24, 'knit')
    this.end_row()
}
for(let i = 0; i < 6; i++){
    this.knit(24, 'knit')
    this.end_row()
    this.knit(24, 'knit')
    this.end_row()
}`,
'Beanie': `this.cast_on(24, 'round')
let knits = 24
for (let i = 0; i < 12; i++) {
    this.color(0xbcba45)
    this.knit(knits, 'knit')
    knits -= 2
    this.end_row()
    this.color('blue')
    this.knit(knits, 'purl')
    knits -= 2
    this.end_row()
}`,
'Beanie Complex': `
let knits = 48
this.cast_on(knits, 'round')
for (let i = 0; i < 6; i++) {
    this.color(0xbcba45)
    this.knit(knits/4-1, 'knit')
    this.knit(1, 'knit', 'yarn_over')
    this.knit(knits/4-1, 'knit')
    this.knit(1, 'knit', 'yarn_over')
    this.knit(knits/4-1, 'knit')
    this.knit(1, 'knit', 'yarn_over')
    this.knit(knits/4, 'knit')
    knits -= 4
    this.end_row()
    this.color('blue')
    this.knit(knits/4-1, 'purl')
    this.knit(1, 'purl', 'yarn_over')
    this.knit(knits/4-1, 'purl')
    this.knit(1, 'purl', 'yarn_over')
    this.knit(knits/4-1, 'purl')
    this.knit(1, 'purl', 'yarn_over')
    this.knit(knits/4, 'purl')
    knits -= 4
    this.end_row()
}
`
    },
    code: ref(''),
    viz: null as PatternViz3D | null,
    overlay_manager: null as KnitGraphOverlayManager | null,

})
onUnmounted(() => {
    if (state.simulation.running) {
        stopSim()
    }
})
watch(() => state.code, (newCode) => {

    
    reset()
    store.setCode(newCode)
})
const reset = () => {
    state.simulation.running = false
    state.simulation.step = 0
    state.simulation.acc_delta = 0.0
    if (state.simulation.timeout) {
        clearInterval(state.simulation.timeout)
        state.simulation.timeout = null
    }

    if (state.viz) {
        state.viz.dispose()
        state.overlay_manager.dispose()
        // state.viz.destroy()
    }
}
const runCode = () => {
    reset()
    state.graph = new KnitGraph()
    state.graph.execute(store.code)
    console.log('Ran code:', state.graph)
    state.viz = new PatternViz3D('#pattern_viz_3d', state.graph as KnitGraph)
    state.overlay_manager = new KnitGraphOverlayManager(state.viz as PatternViz3D,
        store.view as EditorView)
    state.viz.on(PatternViz3DEvents.mouseover, (e) => {
        if (state.overlay_manager) {
            state.overlay_manager.addOverlay(e)
        }
    })
    state.viz.on(PatternViz3DEvents.mouseout, (e) => {
        if (state.overlay_manager) {
            state.overlay_manager.removeOverlay(e)
        }
    })
    state.viz.on(PatternViz3DEvents.render, (e) => {
        if (state.overlay_manager) {
            state.overlay_manager.update()
        }
    })
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
.code_editor_header {
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
    width: 100%;
    margin-bottom: 1rem;
    gap: 1rem;
}
</style>