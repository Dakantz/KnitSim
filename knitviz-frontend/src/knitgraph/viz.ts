

import * as d3 from 'd3'
import * as THREE from 'three'
import { KnitEdge, KnitEdgeDirection, KnitGraph, KnitNode, KnitNodeType, KnitSide } from '.'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { fromVec3, toVec3 } from './helpers'
import * as mjs from 'mathjs'
// 3D circle packing based upon https://observablehq.com/@analyzer2004/3d-circle-packing
// expanded with Topic links and fixed height of nodes (TODO)


export class KnitNode3D extends KnitNode {
    position: THREE.Vector3
    curve: THREE.Curve<THREE.Vector3>
    yarn_geometry: THREE.TubeGeometry
    material: THREE.Material
    mesh: THREE.Mesh
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

    };
    graph: KnitGraph3D
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
        for (let node_id of node_ids) {
            let node = this.graph.nodes[node_id]
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
                        to_node.position = new THREE.Vector3(from_node.position.x + this.knit_dimensions.step_size_x,
                            from_node.position.y,
                            from_node.position.z)
                        break
                    default:
                    case KnitEdgeDirection.COLUMN:
                        to_node.position = new THREE.Vector3(from_node.position.x,
                            from_node.position.y,
                            from_node.position.z + this.knit_dimensions.step_size_y)
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
            // console.log("Node", node, "neighbours", neighbours, "edges", this.graph.edgesof(node))
            for (let neighbour of neighbours) {
                // this.scene.add(new THREE.ArrowHelper(node.position.clone().sub(neighbour.position), neighbour.position, 1,0))
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
            let normal = toVec3(eig.eigenvectors[0].vector as number[])
            id++
            // this.debug_vec(node.position, normal, 0xff0000 - id * 100)

            // impose order on points by projecting them onto the plane and sorting them, first one is the 'reference' for the coordinate system
            let projected = relative_positions.map(v => v.projectOnPlane(normal))
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
                offset *= -1
            }
            let central_point = node.position.clone().add(normal.multiplyScalar(offset))
            let curve = new THREE.CatmullRomCurve3(sorted_neighbours.flatMap(neighbour => [central_point, neighbour.position.clone()]), true)

            let geometry = new THREE.TubeGeometry(curve, 200, node.yarnSpec.weight * this.knit_dimensions.yarn_thickness, 8, true)
            let material = new THREE.MeshToonMaterial({ side: THREE.DoubleSide, wireframe: true })
            let mesh = new THREE.Mesh(geometry, material)

            node.curve = curve
            node.yarn_geometry = geometry
            node.material = material
            node.mesh = mesh
            this.pool.yarn_material[node.yarnSpec.color] = material
            this.scene.add(mesh)
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
            this.renderer.render(this.scene, this.camera);
        });


    }
    debug_vec(origin: THREE.Vector3, direction: THREE.Vector3, color: number) {
        const arrowHelper = new THREE.ArrowHelper(direction, origin, 1, color);
        this.scene.add(arrowHelper);
        this.renderer.render(this.scene, this.camera);
    }
}