<script setup lang="ts">
import Btn from '@/components/ui/Btn.vue';

</script>

<template>
  <main>

    <div >
      <!-- <h1>KnitViz</h1> -->
      <h2>Visualize your knitting patterns in 3D!</h2>
      <Btn @click="$router.push('/viz')" :btn_height="'3rem'">Start Visualizing</Btn>
      <div>
        A few words of caution: this is an early prototype, and the 3D visualization is still a work in progress.
        <ul>
          <li>It is not yet optimized for performance, so it may be slow on large patterns.</li>
          <li>It is not yet fully tested, so there may be bugs.</li>
          <li>You may need to reload after running one simulation/run.</li>
        </ul>
        >Start anyways? <Btn @click="$router.push('/viz')" :btn_height="'1rem'">Yes</Btn>
      </div>
    </div>
  </main>
</template>
<style lang="css" scoped>
main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* height: 100vh; */
}
h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
} 
</style>
