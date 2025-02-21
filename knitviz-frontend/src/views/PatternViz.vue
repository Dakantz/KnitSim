<template>
    <main>
        <div class="pattern_viz">
            <div class="code_editor">
                <Code v-model="state.code">
                </Code>
            </div>
            <button @click="runCode">Run</button>
            <div id="pattern_viz_3d">
            </div>
        </div>


    </main>
</template>

<script setup lang="ts">
import Code from '@/components/editor/Code.vue';
import { KnitGraph } from '@/knitgraph';
import { PatternViz3D } from '@/knitgraph/viz';
import { reactive, ref } from 'vue';
const state = reactive({
    graph: null as KnitGraph | null,
    code: ref(`
    const knit_row=()=>{
        for (let i = 0; i < 6; i++) {
            this.knit(2, 'purl')
            this.knit(2, 'knit')
        }
        this.end_row()
    
        for(let i = 0; i < 6; i++){
            this.knit(2, 'purl')
            this.knit(2, 'knit')
        }
        this.end_row()

    }
    for (let i = 0; i < 15; i++) {
        knit_row()
    }
    for(let i = 0; i < 6; i++){
        this.knit(24, 'purl')
        this.end_row()
        this.knit(24, 'knit')
        this.end_row()
    }
        `),
    viz: null as PatternViz3D | null,
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
</script>

<style lang="scss">
.pattern_viz {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 80vh;
    width: 95vw;
}

.code_editor {
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: start;
    height: 50%;
    width: 100%;
}
#pattern_viz_3d {
    height: 50%;
    width: 100%;
}
.threed_graph{
    height: 100%;
    width: 100%;
}
</style>