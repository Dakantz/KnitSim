<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <v-app class="app">
    <header>
      <h1 class="heading" to="/">KnitSim</h1>
      <div class="wrapper">
        <nav>
          <RouterLink to="/">Home</RouterLink>
          <RouterLink to="/viz">Knitting</RouterLink>
        </nav>
      </div>
    </header>
    <RouterView />
  </v-app>
</template>

<style>
body {
  font-family: "Roboto Mono", monospace;
  margin: 0px;
}
text {
  font-family: "Roboto Mono", monospace;
}

header {
  display: flex;
  line-height: 1.5;
  max-height: 100vh;
}

.heading {
  display: flex;
  justify-items: center;
  justify-content: center;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

.header {
  display: flex;
  place-items: start;
  padding-right: calc(var(--section-gap) / 2);
}

.logo {
  margin: 0 2rem 0 0;
}

header .wrapper {
  display: flex;
  place-items: flex-start;
  flex-wrap: wrap;
  padding-top: 1rem;
}

nav {
  text-align: left;
  margin-left: -1rem;
  font-size: 1rem;

  margin-top: 1.5rem;
  margin-bottom: 1rem;
}
</style>
