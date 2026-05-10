import * as d3 from "d3";
import * as THREE from "three";
import { KnitEdge, KnitEdgeDirection, KnitGraph, KnitMode, KnitNode, KnitNodeType, KnitSide, KnittingState } from "..";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { fromVec3, toVec3 } from "../helpers";
import * as mjs from "mathjs";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import type { ClassHandle, GraphConfig, KnitGraphC, KnitSim, MainModule, NodeC } from "../sim/knitsim-lib";
import KnitSimLib from "../sim/knitsim-lib";
import { toRaw } from "vue";
import { KnitGraph3D } from "./graph";
import type { KnitNode3D } from "./node";
// 3D circle packing based upon https://observablehq.com/@analyzer2004/3d-circle-packing
// expanded with Topic links and fixed height of nodes (TODO)
export let KnitSimModule: MainModule = null;

KnitSimLib({})
  .then((module) => {
    KnitSimModule = module;
    console.log("KnitSimModule", KnitSimModule);
  })
  .catch(console.error);

type WASMValueType<T extends ClassHandle> = Exclude<T, ClassHandle>;
export enum PatternViz3DEvents {
  click = "click",
  mouseover = "mouseover",
  mouseout = "mouseout",
  render = "render",
  paint = "paint",
}
export class PatternViz3D {
  width = 1000;
  height = 500;

  three_div: HTMLElement = null;
  camera: THREE.PerspectiveCamera = null;
  scene: THREE.Scene = null;
  renderer: THREE.Renderer = null;
  raycaster = new THREE.Raycaster();
  inst_nodemesh: THREE.InstancedMesh = null;
  inst_knitmesh: THREE.InstancedMesh = null;
  inst_tubemesh: THREE.InstancedMesh = null;
  dimensions = {
    width: 100,
    height: 20,
    depth: 1000,
  };

  knit_dimensions = {
    step_size_x: 0.5,
    step_size_y: 1,
    offset_bidirectional: 0.1,
    offset_purl: 0.4,
    offset_knit: -0.3,
    yarn_thickness: 0.03,
    loop_width: 0.20
  };

  pool = {
    materials: {} as Record<number, THREE.Material>,
    yarn_material: {} as Record<string, THREE.Material>,
    sphere_mesh: {} as Record<number, THREE.Mesh>,
    sphere_material: {} as Record<KnitSide, THREE.MeshBasicMaterial>,
  };
  graph: KnitGraph3D;

  gui = null;
  highlighted_node: KnitNode3D = null;
  changed_highlighted_node = false;
  show_normals = false;
  show_edges = false;
  show_forces = true;
  show_nodes = true;
  deferCompute = false;
  controls: OrbitControls | null = null;

  isDrawingMode = false;
  activeDrawColor = "#000000";
  isPainting = false;
  hovered_node: KnitNode3D | null = null;

  private pointerMoveHandler = (event: MouseEvent) => this.onPointerMove(event);
  private clickHandler = (event: MouseEvent) => this.updateClickedNode(event);
  private mouseDownHandler = (event: MouseEvent) => this.onMouseDown(event);
  private mouseUpHandler = (event: MouseEvent) => this.onMouseUp(event);

  constructor(
    public query_renderer: string,
    graph: KnitGraph,
    options: { deferCompute?: boolean } = {},
  ) {
    this.graph = new KnitGraph3D(graph);
    this.deferCompute = options.deferCompute ?? false;
    this.init();
  }
  stepSim(time: number) {
    let accumulated_movement = this.graph.step(time);
    for (const node_id in this.graph.nodes) {
      const node = this.graph.nodes[node_id];
      let sphere_matrix = new THREE.Matrix4().makeTranslation(node.position.x, node.position.y, node.position.z)
      this.inst_nodemesh.setMatrixAt(node.id, sphere_matrix);
      if (node.instanced) {
        this.updateInstancedMeshes(node);
      }
      this.inst_nodemesh.instanceMatrix.needsUpdate = true;
    }

    return accumulated_movement;
  }
  private initWasm() {
    this.graph.initGraphWASM({
      step_size_x: this.knit_dimensions.step_size_x,
      step_size_y: this.knit_dimensions.step_size_y,
      offset_bidirectional: this.knit_dimensions.offset_bidirectional,
      offset_purl: this.knit_dimensions.offset_purl,
      offset_knit: this.knit_dimensions.offset_knit,
      yarn_thickness: this.knit_dimensions.yarn_thickness,
      loop_width: this.knit_dimensions.loop_width,
      up_vector: new KnitSimModule.Vector3f(1, 0, 0),
      right_vector: new KnitSimModule.Vector3f(0, 0, 1)
    });
  }
  private initPool() {
    for (const side in KnitSide) {
      this.pool.sphere_material[KnitSide[side]] = new THREE.MeshBasicMaterial({
        color: side == KnitSide.RIGHT ? 0x00ff00 : 0xff0000,
        transparent: true,
        opacity: 0.7,
      });
    }
  }

  private constructTemplateKnit(loop_width: number): Array<THREE.Vector3> {

    let knit_path_arr = []
    // connection to prev node
    // knit_path_arr.push(new THREE.Vector3(0.5*0.5, 0, 0));
    knit_path_arr.push(new THREE.Vector3(0.6*loop_width, 0, 0));

    // loop
    knit_path_arr.push(new THREE.Vector3(loop_width, -0.9, 0.1));
    knit_path_arr.push(new THREE.Vector3(0.7*loop_width, -1.1, -0.1));
    knit_path_arr.push(new THREE.Vector3(-0.7*loop_width, -1.1, -0.1));
    knit_path_arr.push(new THREE.Vector3(-loop_width, -0.9, 0.1));
    // connection to next node
    knit_path_arr.push(new THREE.Vector3(-0.6*loop_width, 0, 0));
    // knit_path_arr.push(new THREE.Vector3(-0.5*0.5, 0, 0));

    return knit_path_arr;
  }

  private initInstancedMeshes() {

    // init instanced node sphere mesh
    const sphereGeometry = new THREE.SphereGeometry(0.1);
    // let sphereMaterial = this.pool.sphere_material[KnitSide.RIGHT];
    let sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
      });
    this.inst_nodemesh = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, Object.keys(this.graph.nodes).length)

    // init tube connection between stitches
    let tube_path_arr = []
    tube_path_arr.push(new THREE.Vector3(0, 0, 0));
    tube_path_arr.push(new THREE.Vector3(0.5, 0.05, 0));
    tube_path_arr.push(new THREE.Vector3(1, 0, 0));

    let curve_tube = new THREE.CatmullRomCurve3(tube_path_arr);

    const tube_geometry = new THREE.TubeGeometry(
        curve_tube,
        tube_path_arr.length * 8,
        1 * this.knit_dimensions.yarn_thickness,
        6,
        false,
      );
      let tube_material =
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.inst_tubemesh = new THREE.InstancedMesh(tube_geometry, tube_material, Object.keys(this.graph.nodes).length)


    // init instanced basic knit/purl mesh
    let knit_path_arr = this.constructTemplateKnit(this.graph.cfg.loop_width)

    let curve_stitch = new THREE.CatmullRomCurve3(knit_path_arr);

    const stitch_geometry = new THREE.TubeGeometry(
        curve_stitch,
        knit_path_arr.length * 8,
        1 * this.knit_dimensions.yarn_thickness,
        6,
        false,
      );
      let stitch_material =
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      this.inst_knitmesh = new THREE.InstancedMesh(stitch_geometry, stitch_material, Object.keys(this.graph.nodes).length);

    this.scene.add(this.inst_nodemesh);
    this.scene.add(this.inst_tubemesh);
    this.scene.add(this.inst_knitmesh);

  }

  updateInstancedMeshes(node : KnitNode3D) {

    let knit_matrix = new THREE.Matrix4();
    let tube_matrix = new THREE.Matrix4();
    
    let transform_list = this.graph.graph_wasm.knitPath(node.id);
    let transform_array = new Array(transform_list.size()).fill(0).map((_, id) => {
      let vec = transform_list.get(id);
      return new THREE.Vector3(vec.x, vec.y, vec.z);
    });

    // Some stitches (e.g., cast-on/degenerated paths) can yield incomplete paths.
    // Skip instanced transform updates for those nodes instead.
    if (!transform_array || transform_array.length < 5) {
      return null;
    }

    for (const vec of transform_array) {
      if (!vec) {
        return null;
      }
    }

    knit_matrix.multiply(new THREE.Matrix4().makeTranslation(transform_array[0]));

    let rot_quat = new THREE.Quaternion();
    let tmp = new THREE.Vector3();

    if(this.graph.graph_wasm.getNode(node.id).mode.value == 0) { // if ROUND KnitModeC
      // rotate facing centre
      tmp.copy(transform_array[2]).normalize();

      if(node.type == KnitNodeType.PURL) {
        rot_quat.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), tmp);
      }
      else {
        // apply quaternion rotation to matrix
        rot_quat.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tmp);
      }
      rot_quat.z = 0;
      knit_matrix.multiply(new THREE.Matrix4().makeRotationFromQuaternion(rot_quat));

      // shearing
      tmp.copy(transform_array[3]);
      rot_quat.invert();
      tmp.applyQuaternion(rot_quat);
      let yx_shear = -tmp.x;
      let yz_shear = -tmp.z;

      knit_matrix.multiply(new THREE.Matrix4().makeShear(0, 0, yx_shear, yz_shear, 0, 0));

    } else { // if FLAT KnitModeC
      // rotate if PURL
      if(node.type == KnitNodeType.PURL) {
        // apply simple rotation to matrix
        knit_matrix.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
      }

      // shearing
      let yx_shear = -transform_array[3].x;
      let yz_shear = -transform_array[3].z;
      if  (node.type == KnitNodeType.PURL) { // invert shearing because previously rotated
        yx_shear = -yx_shear;
        yz_shear = -yz_shear;
      }
      knit_matrix.multiply(new THREE.Matrix4().makeShear(0, 0, yx_shear, yz_shear, 0, 0));
    }

    this.inst_knitmesh.setMatrixAt(node.id, knit_matrix);
    this.inst_knitmesh.instanceMatrix.needsUpdate = true;

    // yarn color change
      this.inst_knitmesh.setColorAt(node.id, new THREE.Color(node.yarnSpec.color));
      this.inst_knitmesh.instanceColor.needsUpdate = true;


    // tube connection
    tmp.copy(transform_array[4]).normalize();
    let tmp2 = new THREE.Vector3().copy(tmp).multiplyScalar(0.6*this.graph.cfg.loop_width);

    if(this.graph.graph_wasm.getNode(node.id).mode.value == 0) { // if ROUND KnitModeC
      let tmp3 = new THREE.Vector3().copy(node.normal).multiplyScalar(0.02);
      tube_matrix.multiply(new THREE.Matrix4().makeTranslation(transform_array[0].add(tmp2).add(tmp3)));
      tube_matrix.multiply(new THREE.Matrix4().makeScale(transform_array[4].length() - tmp2.length()*2, 1, 1));
      rot_quat.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tmp);
      // rot_quat.w = rot_quat.w*0.75;
    } else { // if FLAT KnitModeC
      if(this.graph.graph_wasm.getNode(node.id+1).start_of_row) {
        if (node.position.x >= 0) {
          tube_matrix.multiply(new THREE.Matrix4().makeTranslation(transform_array[0].add(new THREE.Vector3(0.6*this.graph.cfg.loop_width, 0, 0))));
        } else {
          tube_matrix.multiply(new THREE.Matrix4().makeTranslation(transform_array[0].sub(new THREE.Vector3(0.6*this.graph.cfg.loop_width, 0, 0))));
        }
        tube_matrix.multiply(new THREE.Matrix4().makeScale(transform_array[3].length() - tmp2.length()*2, 1, 1));
        tmp.copy(transform_array[3]).normalize();
        rot_quat.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tmp);

      } else if (node.start_of_row) {
        tube_matrix.multiply(new THREE.Matrix4().makeTranslation(transform_array[0].add(tmp2)));
        tube_matrix.multiply(new THREE.Matrix4().makeScale(transform_array[4].length() - tmp2.length()*2, 1, 1));
        rot_quat.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tmp);
      } else {
        tube_matrix.multiply(new THREE.Matrix4().makeTranslation(transform_array[0].add(tmp2)));
        tube_matrix.multiply(new THREE.Matrix4().makeScale(transform_array[4].length() - tmp2.length()*2, 1, 1));
        rot_quat.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tmp);
        rot_quat.w = rot_quat.w*0.5;
      }
    }
    tube_matrix.multiply(new THREE.Matrix4().makeRotationFromQuaternion(rot_quat));
    this.inst_tubemesh.setMatrixAt(node.id, tube_matrix);
    this.inst_tubemesh.instanceMatrix.needsUpdate = true;

    this.inst_tubemesh.setColorAt(node.id, new THREE.Color(node.yarnSpec.color));
    this.inst_tubemesh.instanceColor.needsUpdate = true;

    // check for increase
    if (transform_array.length > 6) return transform_array.slice(5, -1);
    return null;
  }

  computeKnits() {
    this.initWasm();
    this.initPool();
    this.graph.computeHeuristics();
    this.initInstancedMeshes();
    console.log("Computed graph", this.graph);
    let id = 0;
    let sphere_matrix = new THREE.Matrix4();
    let leftover_path = null;
    for (const node_id in this.graph.nodes) {
      const node = this.graph.nodes[node_id];

      // modify sphere instance matrix
      this.inst_nodemesh.setColorAt(node.id, this.pool.sphere_material[node.side].color);

      sphere_matrix.setPosition(node.position.x, node.position.y, node.position.z);
      if (node.start_of_row)
      {
        sphere_matrix.scale(new THREE.Vector3(3, 3, 3));
      }

      this.inst_nodemesh.setMatrixAt(node.id, sphere_matrix);

      if (node.start_of_row)
      {
        sphere_matrix.scale(new THREE.Vector3(1/3, 1/3, 1/3));
      }

      for (let edges of this.graph.outgoing(node)) {
        let to = this.graph.nodes[edges.to];
        let dir = to.position.clone().sub(node.position);
        let outgoing_helper = new THREE.ArrowHelper(
          dir.clone().divideScalar(dir.length()),
          node.position,
          dir.length(),
          0xffff00 + id,
        );
        outgoing_helper.visible = this.show_edges;
        this.scene.add(outgoing_helper);
        node.outgoing_helpers.push(outgoing_helper);
      }
      this.inst_nodemesh.visible = this.show_nodes;


      node.normal_helper = new THREE.ArrowHelper(node.normal, node.position, 1, 0xff0000);
      node.normal_helper.visible = this.show_normals;
      this.scene.add(node.normal_helper);
      node.force_helper = new THREE.ArrowHelper(node.force, node.position, 1, 0x00ff00);
      node.force_helper.visible = this.show_forces;
      this.scene.add(node.force_helper);

      leftover_path = null;
      if(node.instanced) {
        leftover_path = this.updateInstancedMeshes(node);
      }
      // console.log(leftover_path);
      if(!node.instanced || leftover_path != null) { // if not instanced or increase, make new mesh


        let knit_path = null
        let knit_path_arr = null
        if(leftover_path == null) {

          // make instanced mesh at this node invisible, IF NOT increase
          this.inst_knitmesh.setMatrixAt(node.id, new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0)));
          this.inst_knitmesh.instanceMatrix.needsUpdate = true;
          this.inst_tubemesh.setMatrixAt(node.id, new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0)));
          this.inst_tubemesh.instanceMatrix.needsUpdate = true;

          // impose order on points by projecting them onto the plane and sorting them, first one is the 'reference' for the coordinate system
          knit_path = this.graph.graph_wasm.knitPath(node.id);
          knit_path_arr = new Array(knit_path.size()).fill(0).map((_, id) => {
            let vec = knit_path.get(id);
            return new THREE.Vector3(vec.x, vec.y, vec.z);
          });
        } else {
          knit_path_arr = leftover_path;
        }


        let curve = new THREE.CatmullRomCurve3(knit_path_arr);

        // yarn geometry
        let geometry = new THREE.TubeGeometry(
          curve,
          knit_path_arr.length * 8,
          node.yarnSpec.weight * this.knit_dimensions.yarn_thickness,
          6,
          false,
        );

        let  material =
          this.pool.yarn_material[node.yarnSpec.color] ||
          new THREE.MeshBasicMaterial({ color: node.yarnSpec.color, side: THREE.DoubleSide });


        let mesh = new THREE.Mesh(geometry, material);

        node.curve = curve;
        node.yarn_geometry = geometry;
        node.material = material;
        node.mesh = mesh;
        this.scene.add(mesh);

      this.pool.yarn_material[node.yarnSpec.color] = material;
      id++;
    }
  }

    // this.inst_nodemesh.instanceColor.needsUpdate = true;
    this.inst_nodemesh.instanceMatrix.needsUpdate = true;

    // let color = new THREE.Color();
    // this.inst_nodemesh.getColorAt(25, color);
    // console.log("Color at id ", 25, " ", color);
  }

  init() {
    d3.select(this.query_renderer).selectAll(".threed_graph").remove();
    this.three_div = d3.select(this.query_renderer).append("div").attr("class", "threed_graph").node();

    this.three_div.addEventListener("mousemove", this.pointerMoveHandler);
    this.three_div.addEventListener("click", this.clickHandler);
    this.three_div.addEventListener("mousedown", this.mouseDownHandler);
    this.three_div.addEventListener("mouseup", this.mouseUpHandler);
    
    this.width = this.three_div.clientWidth;
    this.height = this.three_div.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.three_div.appendChild(this.renderer.domElement);


    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.2, 1500);
    this.camera.aspect = this.width / this.height;

    this.camera.position.set(0, 0, -35);
    this.camera.updateProjectionMatrix();

    this.scene = new THREE.Scene();
    this.scene.position.x = 0;
    // this.scene.position.y = -this.dimensions.height / 2;
    this.scene.position.z = 0;
    this.scene.background = new THREE.Color(0xe8fff9);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    this.gui = new GUI();
    this.gui.add(this, "show_normals", this.show_normals);
    this.gui.add(this, "show_edges", this.show_edges);
    this.gui.add(this, "show_nodes", this.show_nodes);
    this.gui.add(this, "show_forces", this.show_forces);

    this.initPool();
    if (!this.deferCompute) {
      this.computeKnits();
    }

    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI / 2.5;
    controls.minDistance = 10;
    controls.maxDistance = 650;
    // controls.autoRotate = true;
    controls.addEventListener("change", () => {
      // tooltip.clear();
      if (this.renderer && this.renderer instanceof THREE.WebGLRenderer) {
        this.renderer.clear();
      }
      this.renderer.render(this.scene, this.camera);
    });
    controls.update();
    this.controls = controls;
    this.renderer.render(this.scene, this.camera);

    // let counter = 0;
    // let sum = 0;

    (this.renderer as any).setAnimationLoop(() => {
      this.controls?.update();
      // let startTime = performance.now();
      this.render();
      // let endTime = performance.now();
      // let time = endTime-startTime;
      // counter++;
      // sum += endTime-startTime;
      // if (counter == 100) {
      //   counter = 0;
      //   sum = sum / 100;
      //   console.log(sum);
      // }

      // console.log(time);
    });
  }
  render() {
    if (!this.renderer || !this.scene || !this.camera || !this.three_div) {
      return;
    }

    for (const node_id in this.graph.nodes) {
      const node = this.graph.nodes[node_id];
      node.preRender(this);
    }
    for (const listener of this.eventListeners.render) {
      listener(this.highlighted_node);
    }
    let row_nodes = [];
    let positions: Record<number, THREE.Vector2Like> = {};
    if (this.highlighted_node && this.graph.graph_wasm) {
      let node_c = this.graph.graph_wasm.getNode(this.highlighted_node.id);
      let row = this.graph.graph_wasm.row(node_c);
      row_nodes = new Array(row.nodes.size()).fill(0).map((_, idx) => {
        let n = row.nodes.get(idx);
        return this.graph.nodes[n.id];
      });
      row.delete();
      let bounds = this.renderer.domElement.getBoundingClientRect();
      for (let i = 0; i < row_nodes.length; i++) {
        let node = row_nodes[i];
        //node.highlightPreRender(this, node.id == this.highlighted_node.id ? 0xff00ff : 0x00ffff);
        let vector = node.position.clone().project(this.camera);
        let x = bounds.x + (vector.x * 0.5 + 0.5) * bounds.width;
        let y = bounds.y + (vector.y * -0.5 + 0.5) * bounds.height;
        positions[node.id] = {
          x: x,
          y: y,
        };
      }

      let neighbours = this.graph.graph_wasm.edgesOf(node_c)
      for (let i = 0; i < neighbours.size(); i++) {
          let edge = neighbours.get(i)
          let to = this.graph.nodes[edge.to]
          let from = this.graph.nodes[edge.from]
          if (edge.from == this.highlighted_node.id) {
              // to.node_sphere_mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
              // to.node_sphere_mesh.visible = true
              // this.inst_nodemesh.setColorAt(edge.to, new THREE.Color(0xffffff ));
              // this.inst_nodemesh.visible = this.show_nodes;
              // this.inst_nodemesh.instanceColor.needsUpdate = true;
          } else {
              // from.node_sphere_mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
              // from.node_sphere_mesh.visible = true;
              // this.inst_nodemesh.setColorAt(edge.from, new THREE.Color(0xffffff ));
              // this.inst_nodemesh.visible = this.show_nodes;
              // this.inst_nodemesh.instanceColor.needsUpdate = true;
          }

      }
    }

    d3.select(this.three_div)
      .selectAll(".overlay-text")
      .data(row_nodes)
      .join("div")
      .attr("class", "overlay-text")
      .style("position", "absolute")
      .style("color", "darkred")
      .style("pointer-events", "none")
      .style("font-size", "15px")
      .style("z-index", "1000")
      .style("left", (d) => {
        let pos = positions[d.id];
        if (pos) {
          return `${pos.x}px`;
        }
        return "0px";
      })
      .style("top", (d) => {
        let pos = positions[d.id];
        if (pos) {
          return `${pos.y}px`;
        }
        return "0px";
      })
      .html((d) => {
        return `R${d.row_number}<br>C${d.col_number}`;
      })
      .each((d, i, g) => {
        d.row_number_text = g[i] as HTMLElement;
      });

    this.changed_highlighted_node = false;
    // KnitSimModule.doLeakCheck()
    this.renderer.render(this.scene, this.camera);
  }

  highlightNode(node: KnitNode3D | null) {
    if (!this.inst_nodemesh) {
      return;
    }
    if (node.id != this.highlighted_node?.id) {
      this.changed_highlighted_node = true;

      for (const listener of this.eventListeners.mouseout) {
        listener(node);
      }
    }
    if (this.highlighted_node) {
      // un-highlight previous node, this.hightlighted_node is the previous selected node, when an new node (parameter: node) is selected
      // this.highlighted_node.node_sphere_mesh.material = this.pool.sphere_material[this.highlighted_node.side];
      var previousColor = this.pool.sphere_material[this.highlighted_node.side].color;
      var previousSelectedNodeId = this.highlighted_node.id;
      this.inst_nodemesh.setColorAt(previousSelectedNodeId, previousColor);
      this.inst_nodemesh.instanceColor.needsUpdate = true;
      // this.highlighted_node.node_sphere_mesh.visible = this.show_nodes;
      this.inst_nodemesh.visible = this.show_nodes;
      this.highlighted_node = null;
    }
    if (node) {
      this.highlighted_node = node;
      // node.node_sphere_mesh.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
      this.inst_nodemesh.setColorAt(node.id, new THREE.Color(0xff00ff));
      this.inst_nodemesh.instanceColor.needsUpdate = true; // dirty bit
      this.inst_nodemesh.visible = true;
      // node.node_sphere_mesh.visible = true;
    }

  }

  pointer = new THREE.Vector2();
  private pickNode(event: MouseEvent): KnitNode3D | null {
    if (!this.camera || !this.renderer) {
      return null;
    }

    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.x) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.y) / bounds.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children);
    if (intersects.length === 0) {
      return null;
    }

    const intersect = intersects.find(
      (entry) => entry.object.name != undefined && entry.instanceId != undefined,
    );
    if (!intersect || intersect.instanceId === undefined) {
      return null;
    }

    return this.graph.nodes[intersect.instanceId] ?? null;
  }

  onPointerMove(event: MouseEvent) {
    const node = this.pickNode(event);

    if (this.hovered_node && (!node || node.id !== this.hovered_node.id)) {
      for (const listener of this.eventListeners.mouseout) {
        listener(this.hovered_node);
      }
    }

    this.hovered_node = node;

    if (!node) {
      return;
    }

    if (this.isDrawingMode && this.isPainting) {
      this.paintNode(node);
      return;
    }

    for (const listener of this.eventListeners.mouseover) {
      listener(node);
    }
  }
  
  paintNode(node: KnitNode3D) {
    if (!node || !node.mesh) {
      return;
    }

    const colorValue = parseInt(this.activeDrawColor.replace("#", ""), 16);
    node.yarnSpec.color = this.activeDrawColor;

    const material =
      this.pool.yarn_material[this.activeDrawColor] ||
      new THREE.MeshBasicMaterial({ color: colorValue, side: THREE.DoubleSide });
    
    node.material = material;
    node.mesh.material = material;
    this.pool.yarn_material[this.activeDrawColor] = material;

    for (const listener of this.eventListeners.paint) {
      listener(node);
    }

    this.render();
  }

  onMouseDown(event: MouseEvent) {
    if (!this.isDrawingMode) {
      return;
    }

    this.isPainting = true;
    this.onPointerMove(event);
  }

  onMouseUp(event: MouseEvent) {
    this.isPainting = false;
  }

  setDrawingMode(enabled: boolean) {
    this.isDrawingMode = enabled;
    this.isPainting = false;

    if (this.controls) {
      this.controls.enabled = !enabled;
    }
  }

  setDrawingColor(hexColor: string) {
    this.activeDrawColor = hexColor;
  }
  
  updateClickedNode(event: MouseEvent) {
    const clickedNode = this.pickNode(event);
    this.highlightNode(clickedNode);

    for (const listener of this.eventListeners.click) {
      listener(clickedNode);
    }
  }
  eventListeners: Record<PatternViz3DEvents, ((node: KnitNode3D | null) => void)[]> = Object.keys(PatternViz3DEvents)
    .map((event) => {
      return {
        [event]: [],
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, ...curr };
    }, {}) as Record<PatternViz3DEvents, ((node: KnitNode3D | null) => void)[]>;
  on(event: PatternViz3DEvents, callback: (node: KnitNode3D | null) => void) {
    switch (event) {
      case PatternViz3DEvents.click:
        this.eventListeners.click.push(callback);
        break;
      case PatternViz3DEvents.mouseover:
        this.eventListeners.mouseover.push(callback);
        break;
      case PatternViz3DEvents.mouseout:
        this.eventListeners.mouseout.push(callback);
        break;
      case PatternViz3DEvents.render:
        this.eventListeners.render.push(callback);
        break;
      case PatternViz3DEvents.paint:
        this.eventListeners.paint.push(callback);
        break;
      default:
        throw new Error(`Event ${event} not supported`);
    }
  }
  resize() {
    if (!this.three_div || !this.renderer || !this.camera) {
      return;
    }

    const nextWidth = this.three_div.clientWidth;
    const nextHeight = this.three_div.clientHeight;
    if (!nextWidth || !nextHeight) {
      return;
    }

    this.width = nextWidth;
    this.height = nextHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.render();
  }
  dispose() {
    if (this.renderer && this.renderer instanceof THREE.WebGLRenderer) {
      this.renderer.setAnimationLoop(null);
    }
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    if (this.three_div) {
      this.three_div.removeEventListener("mousemove", this.pointerMoveHandler);
      this.three_div.removeEventListener("click", this.clickHandler);
      this.three_div.removeEventListener("mousedown", this.mouseDownHandler);
      this.three_div.removeEventListener("mouseup", this.mouseUpHandler);
      this.three_div.remove();
      this.three_div = null;
    }
    this.hovered_node = null;
    if (this.scene) {
      this.scene.clear();
    }
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
    }
    if (this.renderer && this.renderer instanceof THREE.WebGLRenderer) {
      this.renderer.dispose();
    }
    this.graph.dispose();
  }
}
