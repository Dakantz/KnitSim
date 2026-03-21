import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/home/HomeView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/viz",
      name: "viz",
      component: () => import("../views/editorView/EditorsView.vue"),
    },
  ],
});

export default router;
