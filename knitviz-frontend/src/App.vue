<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { ROUTE_PATHS } from "@/constants/routes";
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="heading">KnitSim</h1>
      <div class="header-nav">
        <nav>
          <RouterLink to="/">Home</RouterLink>
          <RouterLink :to="ROUTE_PATHS.VIZ">Knitting</RouterLink>
        </nav>
      </div>
    </header>

    <main class="app-container">
      <RouterView />
    </main>
  </div>
</template>

<style>
body {
  font-family: "Roboto Mono", monospace;
  margin: 0;
}

text {
  font-family: "Roboto Mono", monospace;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  line-height: 1.5;
  padding: 0.75rem 1rem;
}

.heading {
  margin: 0;
  font-size: 1.5rem;
}

.header-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

nav {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 1rem;
}

.app-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 760px) {
  .app-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
