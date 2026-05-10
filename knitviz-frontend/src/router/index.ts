import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/home/HomeView.vue";
import { ROUTE_PATHS } from "@/constants/routes";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: ROUTE_PATHS.VIZ,
      name: "viz",
      component: () => import("../views/editorView/EditorsView.vue"),
    },
  ],
});

export default router;
