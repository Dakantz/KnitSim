

import * as d3 from 'd3'
import * as THREE from 'three'
import { KnitEdge, KnitEdgeDirection, KnitGraph, KnitNode, KnitNodeType, KnitSide } from '.'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { fromVec3, toVec3 } from './helpers'
import * as mjs from 'mathjs'
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js'
import type { ClassHandle, GraphConfig, KnitGraphC, KnitSim, MainModule, NodeC } from './sim/knitsim-lib'
import KnitSimLib from './sim/knitsim-lib'
import { toRaw } from 'vue'
// 3D circle packing based upon https://observablehq.com/@analyzer2004/3d-circle-packing
// expanded with Topic links and fixed height of nodes (TODO)
let KnitSimModule: MainModule = null;

KnitSimLib({
}).then((module) => {
    KnitSimModule = module
    console.log("KnitSimModule", KnitSimModule)
}).catch(console.error)

type WASMValueType<T extends ClassHandle> = Exclude<T, ClassHandle>;
export class KnitNode3D extends KnitNode {
    position: THREE.Vector3 = new THREE.Vector3()
    curve: THREE.CatmullRomCurve3
    yarn_geometry: THREE.TubeGeometry
    material: THREE.Material
    mesh: THREE.Mesh
    normal: THREE.Vector3 = new THREE.Vector3()
    force: THREE.Vector3 = new THREE.Vector3()

    node_sphere_mesh: THREE.Mesh
    normal_helper: THREE.ArrowHelper
    outgoing_helpers: THREE.ArrowHelper[] = []
    force_helper: THREE.ArrowHelper

    row_number_text: HTMLElement = null
    line_number_element: HTMLElement = null
    constructor(node: KnitNode, position: THREE.Vector3) {
        super(node.type, node.yarnSpec, node.start_of_row, node.side, node.id)
        for (let key in node) {
            this[key] = node[key]
        }
        this.position = new THREE.Vector3()
    }

    preRender(viz: PatternViz3D) {
        if (this.node_sphere_mesh)
            this.node_sphere_mesh.visible = viz.show_nodes
        if (this.normal_helper)
            this.normal_helper.visible = viz.show_normals
        if (this.force_helper)
            this.force_helper.visible = viz.show_forces
        for (let helper of this.outgoing_helpers) {
            helper.visible = viz.show_edges
        }
        if (viz.changed_highlighted_node) {
            this.node_sphere_mesh.material = viz.pool.sphere_material[this.side]
            if (this.row_number_text) {
                viz.three_div.removeChild(this.row_number_text)
                this.row_number_text = null
            }
        }
        if (this.row_number_text) {
            let bounds = viz.renderer.domElement.getBoundingClientRect()
            const vector = this.position.clone().project(viz.camera);
            let x = bounds.x + (vector.x * 0.5 + 0.5) * bounds.width;
            let y = bounds.y + (vector.y * -0.5 + 0.5) * bounds.height;
            this.row_number_text.style.left = `${x}px`;
            this.row_number_text.style.top = `${y}px`;
        }
    }
    highlightPreRender(viz: PatternViz3D, color: number) {
        if (this.node_sphere_mesh) {
            this.node_sphere_mesh.material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 });
            this.node_sphere_mesh.visible = true
        }

    }

}
export class KnitGraph3D extends KnitGraph<KnitNode3D, KnitEdge> {
    graph_wasm: KnitGraphC
    graph_sim: KnitSim
    cfg: GraphConfig
    constructor(graph: KnitGraph) {
        super()
        for (let key in graph) {
            this[key] = toRaw(graph[key])
        }

        this.edges = [...graph.edges]
        this.edges = this.edges.map((edge) => toRaw(edge))
        this.nodes = {}
        for (let key in graph.nodes) {
            let node = graph.nodes[key]
            this.nodes[node.id] = new KnitNode3D(toRaw(node), new THREE.Vector3())
        }

    }
    step(time: number) {

        if (!this.graph_wasm) {
            return
        }
        console.log("Stepping sim", time, this.graph_wasm, this.graph_wasm.isDeleted())
        let accumulated_movement = this.graph_sim.step(time, 0.1, 0.2)
        console.log("Accumulated movement", accumulated_movement)
        this.graph_wasm.computeKnitPaths()
        this.syncGraphWASM()
        return accumulated_movement
    }

    syncGraphWASM() {
        if (!this.graph_wasm) {
            return
        }
        for (let key in this.nodes) {
            let node = this.nodes[key]
            let wasm_node = this.graph_wasm.getNode(node.id)
            node.position.set(wasm_node.position.x, wasm_node.position.y, wasm_node.position.z)
            node.normal.set(wasm_node.normal.x, wasm_node.normal.y, wasm_node.normal.z)

            let force = this.graph_sim.force(node.id)
            node.force.set(force.x, force.y, force.z)

            let knitPath = this.graph_wasm.knitPath(node.id)

            let knitPathArr = new Array(knitPath.size()).fill(0).map((_, id) => {
                let vec = knitPath.get(id)
                return new THREE.Vector3(vec.x, vec.y, vec.z)
            })
            if (node.mesh) {
                node.curve.points = knitPathArr
                // node.yarn_geometry.dispose()
                // node.yarn_geometry = new THREE.TubeGeometry(node.curve, knitPathArr.length * 8, node.yarnSpec.weight * this.cfg.yarn_thickness, 6, true)
                // node.mesh.geometry = node.yarn_geometry
            }
            if (node.node_sphere_mesh) {
                node.node_sphere_mesh.position.set(node.position.x, node.position.y, node.position.z)
                node.node_sphere_mesh.updateMatrix()
            }
            if (node.normal_helper) {
                node.normal_helper.position.set(node.position.x, node.position.y, node.position.z)
                node.normal_helper.setDirection(node.normal)
                node.normal_helper.updateMatrix()
            }
            if (node.force_helper) {
                node.force_helper.position.set(node.position.x, node.position.y, node.position.z)
                node.force_helper.setDirection(node.force)
                node.force_helper.updateMatrix()
            }
            let outgoing = this.outgoing(node)
            for (let i = 0; i < node.outgoing_helpers.length; i++) {
                let helper = node.outgoing_helpers[i]
                let edge = outgoing[i]
                let to = this.nodes[edge.to]
                let dir = to.position.clone().sub(node.position)
                helper.setDirection(dir.clone().normalize())
                helper.setLength(dir.length())
                helper.position.set(node.position.x, node.position.y, node.position.z)
                helper.updateMatrix()
            }
        }
    }
    initGraphWASM(cfg: GraphConfig) {
        this.cfg = cfg
        let node_vec = new KnitSimModule.NodeVector()
        let edge_vec = new KnitSimModule.EdgeVector()
        for (let key in this.nodes) {
            let node = this.nodes[key]
            let node_wasm = {
                id: node.id,
                line_number: node.line_number,
                row_number: node.row_number,
                col_number: node.col_number,
                start_of_row: node.start_of_row,
                previous_node_id: node.previous_node?.id || -1,
                type: KnitSimModule.KnitNodeTypeC[`KnitNodeTypeC_${node.type.toUpperCase()}`],
                mode: KnitSimModule.KnitModeC.KnitModeC_FLAT,
                side: KnitSimModule.KnitSideC[`KnitSideC_${node.side}`],
                position: new KnitSimModule.Vector3f(node.position.x, node.position.y, node.position.z),
                normal: node.normal ? new KnitSimModule.Vector3f(node.normal.x, node.normal.y, node.normal.z) : new KnitSimModule.Vector3f(0, 0, 0),
                next_dir: new KnitSimModule.Vector3f(0, 0, 0)
            }
            // console.log("Node wasm", node_wasm)
            node_vec.push_back(node_wasm)
        }

        for (let edge of this.edges) {
            edge_vec.push_back({
                from: edge.from,
                to: edge.to,
                direction: KnitSimModule.KnitEdgeDirectionC[`KnitEdgeDirectionC_${edge.direction}`],
                id: edge_vec.size()
            })
        }
        let graph = new KnitSimModule.KnitGraphC(cfg, node_vec, edge_vec)
        this.graph_wasm = graph
        this.graph_sim = new KnitSimModule.KnitSim(graph, {
            f_expansion_factor: 0.3,
            f_flattening_factor: 0.4,
            f_repel_factor: 0.01,
            offset_scaler: 0.7
        })
        return graph
    }
    computeHeuristics() {
        let time = Date.now()
        this.graph_wasm.computeHeuristicLayout()
        this.graph_wasm.calculateNormals()
        this.graph_wasm.computeKnitPaths()
        this.syncGraphWASM()
        console.log("Computed heuristics in", Date.now() - time)
    }
}



export class PatternViz3D {
    width = 1000
    height = 500


    three_div: HTMLElement = null
    camera: THREE.PerspectiveCamera = null
    scene: THREE.Scene = null
    renderer: THREE.Renderer = null
    raycaster = new THREE.Raycaster();
    dimensions = {
        width: 100,
        height: 20,
        depth: 1000,
    }

    knit_dimensions = {
        step_size_x: 0.5,
        step_size_y: 1,
        offset_bidirectional: 0.1,
        offset_purl: 0.4,
        offset_knit: -0.3,
        yarn_thickness: 0.03
    }

    pool = {
        materials: {} as Record<number, THREE.Material>,
        yarn_material: {} as Record<string, THREE.Material>,
        sphere_mesh: {} as Record<number, THREE.Mesh>,
        sphere_material: {} as Record<KnitSide, THREE.MeshBasicMaterial>

    };
    graph: KnitGraph3D

    gui = null
    highlighted_node: KnitNode3D = null
    changed_highlighted_node = false
    show_normals = false
    show_edges = false
    show_forces = true
    show_nodes = true
    constructor(public query_renderer: string, graph: KnitGraph) {
        this.graph = new KnitGraph3D(graph)
        this.init()
    }
    stepSim(time: number) {
        return this.graph.step(time)
    }
    private initWasm() {
        this.graph.initGraphWASM({
            step_size_x: this.knit_dimensions.step_size_x,
            step_size_y: this.knit_dimensions.step_size_y,
            offset_bidirectional: this.knit_dimensions.offset_bidirectional,
            offset_purl: this.knit_dimensions.offset_purl,
            offset_knit: this.knit_dimensions.offset_knit,
            yarn_thickness: this.knit_dimensions.yarn_thickness,
            up_vector: new KnitSimModule.Vector3f(1, 0, 0),
            right_vector: new KnitSimModule.Vector3f(0, 0, 1)
        })
    }
    private initPool() {
        for (const side in KnitSide) {
            this.pool.sphere_material[KnitSide[side]] = new THREE.MeshBasicMaterial({ color: side == KnitSide.RIGHT ? 0x00ff00 : 0xff0000, transparent: true, opacity: 0.7 })
        }
    }
    computeKnits() {
        this.initWasm()
        this.initPool()
        this.graph.computeHeuristics()
        console.log("Computed graph", this.graph)
        let id = 0
        for (const node_id in this.graph.nodes) {
            const node = this.graph.nodes[node_id]
            const sphereGeometry = new THREE.SphereGeometry(node.start_of_row ? 0.3 : 0.1);
            // sphereGeometry.translate(node.position.x, node.position.y, node.position.z)
            const sphereMaterial = this.pool.sphere_material[node.side]
            node.node_sphere_mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
            node.node_sphere_mesh.position.set(node.position.x, node.position.y, node.position.z)
            node.node_sphere_mesh.visible = this.show_nodes
            this.scene.add(node.node_sphere_mesh);
            node.node_sphere_mesh.name = node.id.toString()
            for (let edges of this.graph.outgoing(node)) {
                let to = this.graph.nodes[edges.to]
                let dir = to.position.clone().sub(node.position)
                let outgoing_helper = new THREE.ArrowHelper(dir.clone().divideScalar(dir.length()), node.position, dir.length(), 0xffff00 + id)
                outgoing_helper.visible = this.show_edges
                this.scene.add(outgoing_helper)
                node.outgoing_helpers.push(outgoing_helper)
            }


            node.normal_helper = new THREE.ArrowHelper(node.normal, node.position, 1, 0xff0000)
            node.normal_helper.visible = this.show_normals
            this.scene.add(node.normal_helper)
            node.force_helper = new THREE.ArrowHelper(node.force, node.position, 1, 0x00ff00)
            node.force_helper.visible = this.show_forces
            this.scene.add(node.force_helper)
            // impose order on points by projecting them onto the plane and sorting them, first one is the 'reference' for the coordinate system
            let knit_path = this.graph.graph_wasm.knitPath(node.id)
            let knit_path_arr = new Array(knit_path.size()).fill(0).map((_, id) => {
                let vec = knit_path.get(id)
                return new THREE.Vector3(vec.x, vec.y, vec.z)
            })

            let curve = new THREE.CatmullRomCurve3(knit_path_arr, true)

            let geometry = new THREE.TubeGeometry(curve, knit_path_arr.length * 8, node.yarnSpec.weight * this.knit_dimensions.yarn_thickness, 6, true)
            let material = this.pool.yarn_material[node.yarnSpec.color] || new THREE.MeshBasicMaterial({ color: node.yarnSpec.color, side: THREE.DoubleSide })
            let mesh = new THREE.Mesh(geometry, material)

            node.curve = curve
            node.yarn_geometry = geometry
            node.material = material
            node.mesh = mesh
            this.scene.add(mesh)

            this.pool.yarn_material[node.yarnSpec.color] = material
            id++
            // this.scene.add(mesh)
            // if (id > 10) {
            //     break
            // }
            // console.log("Computed node", node, "with neighbours", sorted_neighbours, "and curve", curve, "and normal", normal)
        }


    }
    init() {
        d3.select(this.query_renderer).selectAll("*").remove()
        this.three_div = d3.select(this.query_renderer).append("div").attr("class", "threed_graph").node()
        this.three_div.addEventListener("mousemove", (event) => this.onPointerMove(event));
        this.three_div.addEventListener("click", (event) => this.updateClickedNode(event));
        this.width = this.three_div.clientWidth
        this.height = this.three_div.clientHeight
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.three_div.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.2, 1500);
        this.camera.aspect = this.width / this.height;
        this.camera.position.set(35, 35, 0);
        this.camera.updateProjectionMatrix();


        this.scene = new THREE.Scene();
        this.scene.position.x = 0;
        // this.scene.position.y = -this.dimensions.height / 2;
        this.scene.position.z = 0;
        this.scene.background = new THREE.Color(0xc1ffdb);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        this.gui = new GUI()
        this.gui.add(this, 'show_normals', this.show_normals)
        this.gui.add(this, 'show_edges', this.show_edges)
        this.gui.add(this, 'show_nodes', this.show_nodes)
        this.gui.add(this, 'show_forces', this.show_forces)

        this.computeKnits()

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
        this.renderer.render(this.scene, this.camera);
        (this.renderer as any).setAnimationLoop(() => {
            controls.update();
            this.render();
        });


    }
    render() {
        for (const node_id in this.graph.nodes) {
            const node = this.graph.nodes[node_id]
            node.preRender(this)
        }
        if (this.highlighted_node && this.changed_highlighted_node) {
            let node_c = this.graph.graph_wasm.getNode(this.highlighted_node.id)
            let row = this.graph.graph_wasm.row(node_c)
            let row_nodes = new Array(row.nodes.size()).fill(0).map((_, idx) => {
                let n = row.nodes.get(idx)
                return this.graph.nodes[n.id]
            })
            row.delete()
            let positions: Record<number, THREE.Vector2Like> = {}
            let bounds = this.renderer.domElement.getBoundingClientRect()
            for (let i = 0; i < row_nodes.length; i++) {
                let node = row_nodes[i]
                node.highlightPreRender(this, node.id == this.highlighted_node.id ? 0xff00ff : 0x00ffff)
                let vector = node.position.clone().project(this.camera);
                let x = bounds.x + (vector.x * 0.5 + 0.5) * bounds.width;
                let y = bounds.y + (vector.y * -0.5 + 0.5) * bounds.height;
                positions[node.id] = {
                    x: x,
                    y: y
                }
            }
            let overlay_texts = d3.select(this.three_div).selectAll(".overlay-text").data(row_nodes).join("div")
                .attr("class", "overlay-text")
                .style("position", "absolute")
                .style("color", "darkred")
                .style("pointer-events", "none")
                .style("font-size", "15px")
                .style("z-index", "1000")
                .style("left", (d) => {
                    let pos = positions[d.id]
                    if (pos) {
                        return `${pos.x}px`
                    }
                    return "0px"
                })
                .style("top", (d) => {
                    let pos = positions[d.id]
                    if (pos) {
                        return `${pos.y}px`
                    }
                    return "0px"
                })
                .html((d) => {
                    return `R${d.row_number}<br>C${d.col_number}`
                }).each((d, i, g) => {
                    d.row_number_text = g[i] as HTMLElement
                })


            // let neighbours = this.graph.graph_wasm.edgesOf(node_c)
            // for (let i = 0; i < neighbours.size(); i++) {
            //     let edge = neighbours.get(i)
            //     let to = this.graph.nodes[edge.to]
            //     let from = this.graph.nodes[edge.from]
            //     if (edge.from == this.highlighted_node.id) {
            //         to.node_sphere_mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
            //         to.node_sphere_mesh.visible = true
            //     } else {
            //         from.node_sphere_mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
            //         from.node_sphere_mesh.visible = true
            //     }


            // }
        }
        this.changed_highlighted_node = false
        // KnitSimModule.doLeakCheck()
        this.renderer.render(this.scene, this.camera);
    }

    highlightNode(node: KnitNode3D) {
        if (node.id != this.highlighted_node?.id) {
            this.changed_highlighted_node = true
        }
        if (this.highlighted_node) {
            this.highlighted_node.node_sphere_mesh.material = this.pool.sphere_material[this.highlighted_node.side]
            this.highlighted_node.node_sphere_mesh.visible = this.show_nodes
            this.highlighted_node = null
        }
        if (node) {
            this.highlighted_node = node
            node.node_sphere_mesh.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
            node.node_sphere_mesh.visible = true
        }
    }

    pointer = new THREE.Vector2();
    onPointerMove(event: MouseEvent) {

        if (!this.camera) {
            return
        }
        // calculate pointer position in normalized device coordinates
        // (-1 to +1) for both components
        if (this.three_div) {
            let bounds = this.renderer.domElement.getBoundingClientRect()
            this.pointer.x = ((event.clientX - bounds.x) / (bounds.width)) * 2 - 1;
            this.pointer.y = -((event.clientY - bounds.y) / (bounds.height)) * 2 + 1;
            // console.log("Pointer", this.pointer, event.clientX, event.clientY, bounds.x, bounds.y, bounds.width, bounds.height)
        }
        // calculate objects intersecting the picking ray
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children);
        if (intersects.length > 0) {
            const intersect = intersects.find((intersect) => intersect.object.name != undefined && intersect.object.name.length > 0)
            if (!intersect) {
                return
            }
            const id = parseInt(intersect.object.name)
            const node = this.graph.nodes[id]
            this.highlightNode(node)
        }

    }
    updateClickedNode(event: MouseEvent) {
        this.onPointerMove(event);
    }
}