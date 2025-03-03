

import * as d3 from 'd3'
import * as THREE from 'three'
import { KnitEdge, KnitEdgeDirection, KnitGraph, KnitNode, KnitNodeType, KnitSide } from '.'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { fromVec3, toVec3 } from './helpers'
import * as mjs from 'mathjs'
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js'
// 3D circle packing based upon https://observablehq.com/@analyzer2004/3d-circle-packing
// expanded with Topic links and fixed height of nodes (TODO)


export class KnitNode3D extends KnitNode {
    position: THREE.Vector3
    curve: THREE.Curve<THREE.Vector3>
    yarn_geometry: THREE.TubeGeometry
    material: THREE.Material
    mesh: THREE.Mesh
    normal: THREE.Vector3

    node_sphere_mesh: THREE.Mesh
    node_normal_helper: THREE.ArrowHelper
    node_outgoing_helpers: THREE.ArrowHelper[] = []
    constructor(node: KnitNode, position: THREE.Vector3) {
        super()
        for (let key in node) {
            this[key] = node[key]
        }
        this.position = new THREE.Vector3()
    }
}
export class KnitGraph3D extends KnitGraph<KnitNode3D, KnitEdge> {
    constructor(graph: KnitGraph) {
        super()
        for (let key in graph) {
            this[key] = graph[key]
        }
        this.edges = [...graph.edges]
        this.nodes = {}
        for (let key in graph.nodes) {
            let node = graph.nodes[key]
            this.nodes[node.id] = new KnitNode3D(node, new THREE.Vector3())
        }
    }
}



export class PatternViz3D {
    width = 1000
    height = 500


    three_div: HTMLElement = null
    camera: THREE.PerspectiveCamera = null
    scene: THREE.Scene = null
    renderer: THREE.Renderer = null
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
        sphere_mesh: {} as Record<number, THREE.Mesh>
    };
    graph: KnitGraph3D

    gui = null

    show_normals = false
    show_edges = false
    show_nodes = true
    constructor(public query_renderer: string, graph: KnitGraph) {
        this.graph = new KnitGraph3D(graph)
        this.init()
    }
    computeKnits() {
        let position = new THREE.Vector3(0, 0, 0)
        let node_ids = Object.keys(this.graph.nodes).map(k => parseInt(k)).sort((a, b) => a - b)
        this.graph.nodes[node_ids[0]].position = position
        console.log("Node ids", node_ids)
        let visited: Record<number, KnitNode3D> = {}
        let up_vector = new THREE.Vector3(1, 0, 0)
        let right_vector = new THREE.Vector3(0, 0, 1)
        let start_normal = up_vector.clone()



        let plane_normal = right_vector.clone().cross(up_vector)
        plane_normal.normalize()

        for (let node_id of node_ids) {
            let node = this.graph.nodes[node_id]
            let { round, closed } = this.graph.row(node)
            let offset_position = new THREE.Vector3()
            let x_offset_modifier = node.side == KnitSide.WRONG ? 1 : -1
            let node_pos = round.indexOf(node)
            let start_node = round.find(n => n.start_of_row)
            if (closed && start_node) {

                let angle = x_offset_modifier * (node_pos / round.length) * Math.PI * 2
                let radius = round.length * this.knit_dimensions.step_size_x / (Math.PI)

                let x = Math.cos(angle) * radius
                let y = Math.sin(angle) * radius

                let circle_pos = up_vector.clone().multiplyScalar(x).add(right_vector.clone().multiplyScalar(y))
                //start node should be at pos 0,0
                circle_pos.sub(up_vector.clone().multiplyScalar(radius))

                // console.log("Node", node, "round", round, "pos", node_pos, "start", start_node,
                //     "angle", angle, "radius", radius, "circle_pos", circle_pos)
                node.position = start_node.position.clone().add(circle_pos).add(plane_normal.clone().multiplyScalar(this.knit_dimensions.step_size_y))
            } else {
                offset_position = up_vector.clone().multiplyScalar(x_offset_modifier * this.knit_dimensions.step_size_x)
            }

            let edges = this.graph.outgoing(node)
            for (let edge of edges) {
                let to_node = this.graph.nodes[edge.to]
                let from_node = this.graph.nodes[edge.from]
                let other_node = to_node.id == node.id ? from_node : to_node
                // if (visited[from_node.id]) {
                //     continue
                // }
                // visited[to_node.id] = to_node
                // visited[from_node.id] = from_node

                switch (edge.direction) {
                    case KnitEdgeDirection.ROW:
                        to_node.position = from_node.position.clone().add(offset_position)
                        break
                    default:
                    case KnitEdgeDirection.COLUMN:
                        to_node.position = from_node.position.clone().add(plane_normal.clone().multiplyScalar(this.knit_dimensions.step_size_y))
                        break
                }
                // console.log("Edge", edge, "from", from_node, "to", to_node, "other", other_node)
            }
        }
        let id = 0
        console.log("Visited", visited)
        for (const node_id in this.graph.nodes) {
            const node = this.graph.nodes[node_id]
            let neighbours = this.graph.neighbours(node)
            const sphereGeometry = new THREE.SphereGeometry(node.start_of_row ? 0.3 : 0.1);
            sphereGeometry.translate(node.position.x, node.position.y, node.position.z)
            const sphereMaterial = new THREE.MeshBasicMaterial({ color: node.side == KnitSide.RIGHT ? 0xffff00 : 0x00ff00 });
            node.node_sphere_mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
            node.node_sphere_mesh.visible = this.show_nodes
            this.scene.add(node.node_sphere_mesh);

            // console.log("Node", node, "neighbours", neighbours, "edges", this.graph.edgesof(node))
            for (let edges of this.graph.outgoing(node)) {
                let to = this.graph.nodes[edges.to]
                let dir = to.position.clone().sub(node.position)
                let outgoing_helper = new THREE.ArrowHelper(dir.clone().divideScalar(dir.length()), node.position, dir.length(), 0x0000ff + id * 100)
                outgoing_helper.visible = this.show_edges
                this.scene.add(outgoing_helper)
                node.node_outgoing_helpers.push(outgoing_helper)
            }

            // console.log("Node", node, "neighbours", neighbours) 
            if (neighbours.length < 2) {
                continue
            }
            // fit plane to neighbours
            let relative_positions = neighbours.map(neighbour => neighbour.position.clone().sub(node.position))
            let matrix_positions = relative_positions.map(fromVec3)
            let xtx = mjs.multiply(mjs.transpose(matrix_positions), matrix_positions)
            let eig = mjs.eigs(xtx)
            node.normal = toVec3(eig.eigenvectors[0].vector as number[])

            let neighbour_normals = neighbours.map(neighbour => this.graph.nodes[neighbour.id].normal)
            let orientation_normal = neighbour_normals.find(nn => nn && nn.length() > 0)
            if (!orientation_normal) {
                console.log("No orientation normal found for node", node)
                orientation_normal = start_normal
            }
            let projected_normal = node.normal.dot(orientation_normal)
            console.log("Node", node, "normal", node.normal, "orientation", orientation_normal, "projected", projected_normal)
            let negative = projected_normal < 0
            if (projected_normal < 0) {
                node.normal = node.normal.clone().multiplyScalar(-1)
            }
            node.node_normal_helper = new THREE.ArrowHelper(orientation_normal, node.position, 1, negative ? 0xff0000 : 0x00ff00)
            node.node_normal_helper.visible = this.show_normals


            this.scene.add(node.node_normal_helper)
            // impose order on points by projecting them onto the plane and sorting them, first one is the 'reference' for the coordinate system
            let projected = relative_positions.map(v => v.clone().projectOnPlane(node.normal.clone()))
            let reference = projected[0]
            let angles_to_reference = projected.map((v, i) => {
                let angle = v.angleTo(reference)
                return { angle, i }
            })
            angles_to_reference.sort((a, b) => a.angle - b.angle)
            let sorted_neighbours = angles_to_reference.map(a => neighbours[a.i])

            let offset = 0
            switch (node.type) {
                case KnitNodeType.KNIT:
                    offset = this.knit_dimensions.offset_knit
                    break
                case KnitNodeType.PURL:
                    offset = this.knit_dimensions.offset_purl
                    break
            }
            if (node.side == KnitSide.WRONG) {
                offset *= -0.9
            }
            let central_point = node.position.clone().add(node.normal.clone().multiplyScalar(offset))
            let curve = new THREE.CatmullRomCurve3(sorted_neighbours.flatMap(neighbour => [central_point, neighbour.position.clone(), central_point]), true)

            let geometry = new THREE.TubeGeometry(curve, 200, node.yarnSpec.weight * this.knit_dimensions.yarn_thickness, 8, true)
            let material = this.pool.yarn_material[node.yarnSpec.color] || new THREE.MeshToonMaterial({ color: node.yarnSpec.color, side: THREE.DoubleSide })
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
            node.node_sphere_mesh.visible = this.show_nodes
            node.node_normal_helper.visible = this.show_normals
            for (let helper of node.node_outgoing_helpers) {
                helper.visible = this.show_edges
            }
        }
        this.renderer.render(this.scene, this.camera);
    }
    debug_vec(origin: THREE.Vector3, direction: THREE.Vector3, color: number) {
        const arrowHelper = new THREE.ArrowHelper(direction, origin, 1, color);
        this.scene.add(arrowHelper);
        this.renderer.render(this.scene, this.camera);
    }
}