import { KnitNode } from "..";
import type { PatternViz3D } from "./viz";

import * as d3 from "d3";
import * as THREE from "three";

export class KnitNode3D extends KnitNode {
  position: THREE.Vector3 = new THREE.Vector3();
  curve: THREE.CatmullRomCurve3;
  yarn_geometry: THREE.TubeGeometry;
  material: THREE.Material;
  mesh: THREE.Mesh;
  normal: THREE.Vector3 = new THREE.Vector3();
  force: THREE.Vector3 = new THREE.Vector3();

  node_sphere_mesh: THREE.Mesh;
  normal_helper: THREE.ArrowHelper;
  outgoing_helpers: THREE.ArrowHelper[] = [];
  force_helper: THREE.ArrowHelper;

  row_number_text: HTMLElement = null;
  line_number_element: HTMLElement = null;
  constructor(node: KnitNode, position: THREE.Vector3) {
    super(node.type, node.yarnSpec, node.start_of_row, node.side, node.id);
    for (let key in node) {
      this[key] = node[key];
    }
    this.position = new THREE.Vector3();
  }

  preRender(viz: PatternViz3D) {
    if (this.node_sphere_mesh) this.node_sphere_mesh.visible = viz.show_nodes;
    if (this.normal_helper) this.normal_helper.visible = viz.show_normals;
    if (this.force_helper) this.force_helper.visible = viz.show_forces;
    for (let helper of this.outgoing_helpers) {
      helper.visible = viz.show_edges;
    }
    if (viz.changed_highlighted_node) {
      this.node_sphere_mesh.material = viz.pool.sphere_material[this.side];
      // if (this.row_number_text) {
      //     viz.three_div.removeChild(this.row_number_text)
      //     this.row_number_text = null
      // }
    }
    if (this.row_number_text) {
      let bounds = viz.renderer.domElement.getBoundingClientRect();
      const vector = this.position.clone().project(viz.camera);
      if (vector.x > 1 || vector.x < -1 || vector.y > 1 || vector.y < -1) {
        this.row_number_text.style.visibility = "hidden";
        return;
      }
      this.row_number_text.style.visibility = "visible";
      let x = bounds.x + (vector.x * 0.5 + 0.5) * bounds.width;
      let y = bounds.y + (vector.y * -0.5 + 0.5) * bounds.height;
      this.row_number_text.style.left = `${x}px`;
      this.row_number_text.style.top = `${y}px`;
    }
  }
  highlightPreRender(viz: PatternViz3D, color: number) {
    if (this.node_sphere_mesh) {
      this.node_sphere_mesh.material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 });
      this.node_sphere_mesh.visible = true;
    }
  }
}
