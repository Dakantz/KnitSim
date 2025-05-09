import { toRaw } from "vue"
import { KnitEdge, KnitGraph } from ".."
import type { GraphConfig, KnitGraphC, KnitSim } from "../sim/knitsim-lib"
import { KnitSimModule } from "./viz"

import * as d3 from 'd3'
import * as THREE from 'three'
import { KnitNode3D } from "./node"


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
                node.yarn_geometry.dispose()
                node.yarn_geometry = new THREE.TubeGeometry(node.curve, knitPathArr.length * 4, node.yarnSpec.weight * this.cfg.yarn_thickness, 4, true)
                node.mesh.geometry = node.yarn_geometry
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
            f_expansion_factor: 0.8,
            f_flattening_factor: 0.4,
            f_repel_factor: 0.05,
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
