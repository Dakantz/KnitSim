
import * as d3 from 'd3'
import * as THREE from 'three'
import type { PatternViz3D } from './viz'
import type { EditorView } from 'codemirror'
import type { KnitNode3D } from './node'

export class KnitGraphOverlayManager {
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>
    overlays: { [key: string]: KnitGraphOverlay } = {}
    constructor(public viz: PatternViz3D, public editor: EditorView) {

        this.init()

    }

    init() {
        this.svg = d3.select("body").append("svg")
            .attr("width", window.innerWidth)
            .attr("height", window.innerHeight)
            .style("position", "absolute")
            .style("top", "0px")
            .style("left", "0px")
            .style("pointer-events", "none")
    }

    addOverlay(n: KnitNode3D) {
        let overlay = new KnitGraphOverlay(this, n)
        if (this.overlays[n.id]) {
            this.removeOverlay(n)
        }
        this.overlays[n.id] = overlay
    }
    removeOverlay(n: KnitNode3D) {
        if (this.overlays[n.id]) {
            this.overlays[n.id].overlay.remove()
            this.overlays[n.id].link.remove()
            delete this.overlays[n.id]
        }
    }
    updateOverlay(n: KnitNode3D) {
        if (this.overlays[n.id]) {
            this.overlays[n.id].update()
        }
    }
    update() {
        for (let key in this.overlays) {
            this.overlays[key].update()
        }
    }

}
export class KnitGraphOverlay {
    overlay: d3.Selection<SVGGElement, unknown, HTMLElement, any>
    link: d3.Selection<SVGElement, unknown, HTMLElement, any>
    constructor(public manager: KnitGraphOverlayManager, public n: KnitNode3D) {

        this.overlay = this.manager.svg.append("g")
            .attr("class", "overlay")
            .attr("id", n.id)
        this.link = this.overlay.append("path").attr("class", "link")
            .attr("d", "M0,0 L0,0")
            .style("stroke", "grey")
            .style("stroke-width", "2px")
            .style("pointer-events", "none")
            .style("fill", "none")
            .style("alpha", "0.5")

    }

    update() {
        let bounds = this.manager.viz.renderer.domElement.getBoundingClientRect()
        const vector = this.n.position.clone().project(this.manager.viz.camera);
        if (vector.x > 1 || vector.x < -1 || vector.y > 1 || vector.y < -1) {
            this.overlay.attr("visibility", "hidden")
            this.link.attr("visibility", "hidden")
            return
        }
        this.overlay.attr("visibility", "visible")
        this.link.attr("visibility", "visible")
        let x = bounds.x + (vector.x * 0.5 + 0.5) * bounds.width;
        let y = bounds.y + (vector.y * -0.5 + 0.5) * bounds.height;

        let from = { x: x, y: y }
        let coords_line = this.manager.editor.state.doc.line(this.n.line_number - 2)
        let line = this.manager.editor.coordsAtPos(coords_line.to)
        let to = { x: line.left, y: line.top }
        // console.log("From", from, "To", to, coords_line, "L", this.n.line_number)

        this.link.attr("d", `M ${from.x},${from.y} 
                C ${to.x},${from.y} 
                ${from.x},${to.y} 
                ${to.x},${to.y}`)
    }
}
