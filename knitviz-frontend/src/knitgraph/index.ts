export enum KnitNodeType {
    PURL = 'PURL',
    KNIT = 'KNIT',
    SLIP = 'SLIP',
    YARN_OVER = 'YARN_OVER',
    INCREASE = 'INCREASE',
    DECREASE = 'DECREASE',
    BIND_OFF = 'BIND_OFF',
    CAST_ON = 'CAST_ON',
}
export enum KnitMode {
    ROUND = 'ROUND',
    FLAT = 'FLAT'
}
export enum KnitEdgeDirection {
    ROW = 'ROW',
    COLUMN = 'COLUMN',
    BOTH = 'BOTH',
    STITCH = 'STITCH',
    START = 'START',
}
export enum KnitSide {
    RIGHT = 'RIGHT',
    WRONG = 'WRONG',
}
export class YarnSpec {
    color: number | string;
    weight: number;
    constructor(color: number | string, weight: number) {
        this.color = color;
        this.weight = weight;
    }
}
export class KnitNode {
    id: number = 0;
    line_number: number = 0;
    row_number: number = 0;
    col_number: number = 0;
    static idCounter: number = 0;
    type: KnitNodeType;
    yarnSpec: YarnSpec;
    start_of_row: boolean = false;
    side: KnitSide = KnitSide.RIGHT;
    previous_node?: KnitNode;
    constructor(type: KnitNodeType = KnitNodeType.KNIT, yarnSpec: YarnSpec = new YarnSpec(0x0011ff, 1), start_row: boolean = false, side: KnitSide = KnitSide.RIGHT, id: number = null) {
        this.yarnSpec = yarnSpec;
        this.type = type;
        this.id = id || KnitNode.idCounter++;
        this.start_of_row = start_row;
        this.side = side;
    }
}
export class KnitEdge {
    from: number;
    to: number;
    direction: KnitEdgeDirection = KnitEdgeDirection.ROW;
    constructor(from: number, to: number, direction: KnitEdgeDirection = KnitEdgeDirection.ROW, side: KnitSide = KnitSide.RIGHT) {
        this.from = from;
        this.direction = direction;
        this.to = to;
    }
}
export class KnittingState {
    graph: KnitGraph;
    previous_node?: KnitNode;

    side: KnitSide = KnitSide.RIGHT;
    round_knit: boolean = false;
    last_end_node?: KnitNode;
    last_start_node?: KnitNode;
    row_number: number = 0;
    col_number: number = 0;
    current_yarn = new YarnSpec(0x0011ff, 1);
    private offset = 3
    constructor(graph: KnitGraph) {
        this.graph = graph;
    }
    private call_position(): number {
        let stack = (new Error()).stack?.split("\n");
        let error_line = stack ? stack[this.offset] : undefined;
        let line = error_line?.match(/:(\d+):\d+\)$/)[1]
        return parseInt(line as string);
    }
    do_round_knit() {
        this.round_knit = true;
    }
    do_flat_knit() {
        this.round_knit = false;
    }
    add_edge(edge: KnitEdge) {
        // console.log('add edge', edge);
        this.graph.edges.push(edge);
    }
    cast_on(n: number, mode: KnitMode = KnitMode.FLAT) {
        mode = (mode as string).toUpperCase() as KnitMode;
        this.previous_node = undefined;
        this.last_end_node = undefined;
        this.row_number = 0;
        this.col_number = 0;
        this.round_knit = mode == KnitMode.ROUND;
        this.offset++
        // as we are on level deeper in the stack, we need to go back one more level
        this.knit(n, KnitNodeType.CAST_ON);
        this.offset--;
        this.end_row();
    }
    color(color: number | string, weight: number = 1) {
        this.current_yarn = new YarnSpec(color, weight);
    }
    knit(n: number, type: KnitNodeType, procedal: KnitNodeType = KnitNodeType.KNIT) {
        type = (type as string).toUpperCase() as KnitNodeType;
        procedal = (procedal as string).toUpperCase() as KnitNodeType;
        for (let i = 0; i < n; i++) {

            let node = new KnitNode(type, this.current_yarn, false, this.side);
            node.line_number = this.call_position();
            node.row_number = this.row_number;
            node.col_number = this.col_number;
            this.col_number++;
            node.start_of_row = this.previous_node ? false : true;
            this.graph.nodes[node.id] = node;
            if (this.last_end_node) {
                // console.log('last_end_node', this.last_end_node, 'previous_node', this.previous_node);
                if (this.round_knit) {
                    // this.add_edge(new KnitEdge(this.last_end_node.id, node.id, KnitEdgeDirection.ROW, this.side));
                    if (this.last_start_node) {
                        this.add_edge(new KnitEdge(this.last_start_node.id, node.id, KnitEdgeDirection.COLUMN, this.side));
                    }
                } else {
                    this.add_edge(new KnitEdge(this.last_end_node.id, node.id, KnitEdgeDirection.COLUMN, this.side));
                }
                node.previous_node = this.last_end_node;
                this.last_end_node = null;
            }

            if (this.previous_node) {
                let backdir = true;
                if (this.round_knit) {
                    //when going back, the side is reversed - always!
                    backdir = false
                    // backdir = this.side != KnitSide.RIGHT;
                }
                let traversal = [{ dir: KnitEdgeDirection.COLUMN, in: true }, { dir: KnitEdgeDirection.ROW, in: backdir }];
                if (procedal == KnitNodeType.SLIP) {
                    console.log('slip stitch', node, this.previous_node);
                    traversal = [{ dir: KnitEdgeDirection.COLUMN, in: true }]
                }
                if (procedal == KnitNodeType.YARN_OVER) {
                    console.log('yarn over', node, this.previous_node);
                    traversal = [{ dir: KnitEdgeDirection.COLUMN, in: true }, { dir: KnitEdgeDirection.ROW, in: backdir }, { dir: KnitEdgeDirection.ROW, in: backdir }]
                }
                let top_node_traversal = this.graph.traverseGraph(this.previous_node, traversal);
                // console.log('traversal result', top_node_traversal, "all edges", this.graph.edges);
                if (top_node_traversal && top_node_traversal.nodes.length > 1) {
                    let bellow_node = top_node_traversal.nodes[top_node_traversal.nodes.length - 1];
                    // console.log('top_node', bellow_node, 'previous_node', this.previous_node);
                    this.add_edge(new KnitEdge(bellow_node.id, node.id, KnitEdgeDirection.COLUMN, this.side));
                }
                this.add_edge(new KnitEdge(this.previous_node.id, node.id, KnitEdgeDirection.ROW, this.side));
                node.previous_node = this.previous_node;
            }
            this.previous_node = node;
        }
    }
    end_row() {
        if (this.previous_node) {
            this.last_end_node = this.previous_node;
            let start_node = this.graph.beginOfRow(this.previous_node);
            this.last_start_node = start_node;
            // this.last_end_node = end_node;
            // console.log('end node for row', start_node, this.previous_node);
            if (start_node) {
                if (this.round_knit) {
                    //questionable, is this edge really needed?
                    this.add_edge(new KnitEdge(this.previous_node.id, start_node.id, KnitEdgeDirection.ROW, this.side));
                }
            }
        }
        this.row_number++;
        this.col_number = 0;
        if (!this.round_knit) {
            switch (this.side) {
                case KnitSide.RIGHT:
                    this.side = KnitSide.WRONG;
                    break;
                case KnitSide.WRONG:
                    this.side = KnitSide.RIGHT;
                    break;
            }
        }
        this.previous_node = undefined
    }


}
export class KnitGraph<N extends KnitNode = KnitNode, E extends KnitEdge = KnitEdge> {

    nodes: Record<number, N>;
    edges: E[];
    state: KnittingState;
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.state = new KnittingState(this);
    }
    edgesof(node: N, direction?: KnitEdgeDirection): E[] {
        let edges = this.edges.filter((edge) => edge.from == node.id || edge.to == node.id);
        if (direction) {
            return edges.filter((edge) => edge.direction == direction);
        }
        return edges;
    }
    incoming(node: N, direction?: KnitEdgeDirection): E[] {
        let edges = this.edges.filter((edge) => edge.to == node.id);
        if (direction) {
            return edges.filter((edge) => edge.direction == direction);
        }
        return edges;
    }
    outgoing(node: N, direction?: KnitEdgeDirection): E[] {
        let edges = this.edges.filter((edge) => edge.from == node.id);
        if (direction) {
            return edges.filter((edge) => edge.direction == direction);
        }
        return edges;
    }

    outgiongNode(node: N, direction?: KnitEdgeDirection): N {
        let nodes = this.edgesof(node).map((edge) => this.nodes[edge.to]) as N[];
        if (direction) {
            // console.log('filtering nodes (out)', nodes, direction);
            nodes = nodes.filter((n) => this.edges.find((e) => e.to == n.id && e.from == node.id && e.direction == direction));
        }
        nodes.sort((a, b) => a.id - b.id);
        return nodes.pop() as N;
    }

    incomingNode(node: N, direction?: KnitEdgeDirection): N {
        let nodes = this.edgesof(node).map((edge) => this.nodes[edge.from]) as N[];
        if (direction) {
            // console.log('filtering nodes (in)', nodes, direction);
            nodes = nodes.filter((n) => this.edges.find((e) => e.from == n.id && e.to == node.id && e.direction == direction));
        }
        nodes.sort((a, b) => a.id - b.id);
        return nodes.pop() as N;
    }
    traverseGraph(node: N, directions: { dir: KnitEdgeDirection, in: boolean }[]): { nodes: N[], edges: E[] } | null {
        let nodes = [node];
        let edges = []
        let current = node;
        for (const dir of directions) {
            let next;
            if (dir.in) {
                next = this.incomingNode(current, dir.dir);
            }
            else {
                next = this.outgiongNode(current, dir.dir);
            }
            if (next) {
                nodes.push(next);
                if (dir.in) {
                    edges.push(this.edges.filter((edge) => edge.to == current.id && edge.from == next.id));
                } else {
                    edges.push(this.edges.filter((edge) => edge.from == current.id && edge.to == next.id));
                }
                current = next;
            } else {
                // console.log('no next node', current, dir, nodes);
                return null;
            }
        }
        return { nodes, edges };
    }
    neighbours(node: N): N[] {

        return this.edgesof(node).map((edge) => Object.values(this.nodes).find((n) => (node.id != n.id) && (n.id == edge.from || n.id == edge.to))).filter(node => node) as N[];
    }
    row(node: N): { round: N[], closed: boolean } {
        let current_node = node;
        let forward_nodes = [node]
        let closed = false;
        while (current_node) {
            //check downward facing edges too as round knitting just goes around and links back to the start using this way
            let col_edge = this.edges.find(edges => edges.direction == KnitEdgeDirection.COLUMN && edges.to == current_node.id);
            if (col_edge && col_edge.from == node.id) {
                closed = true;
                break;
            }
            let next_edge = this.edges.find(edges => edges.direction == KnitEdgeDirection.ROW && edges.from == current_node.id);
            if (next_edge) {
                if (next_edge.to == node.id) {
                    closed = true;
                } else {
                    current_node = this.nodes[next_edge.to];
                    forward_nodes.push(current_node)
                    continue
                }
            }
            break;

        }
        let start_node = forward_nodes.find((node) => node.start_of_row);
        if (start_node) {
            let start_index = forward_nodes.indexOf(start_node);
            forward_nodes = forward_nodes.slice(start_index).concat(forward_nodes.slice(0, start_index));
        }
        return { round: forward_nodes, closed };
    }
    beginOfRow(node: N): N | undefined {
        let current_node = node;
        while (current_node) {
            if (current_node.start_of_row) {
                return current_node;
            }
            let next_edge = this.edges.find(edges => edges.direction == KnitEdgeDirection.ROW && edges.to == current_node.id);
            if (next_edge && next_edge.from != node.id) {
                current_node = this.nodes[next_edge.from];
            }
            else {
                return current_node;
            }
        }
    }
    execute(code: string) {
        this.state = new KnittingState(this);
        this.edges = [];
        this.nodes = [];

        let pattern_function = (new Function(code)) as () => void;
        try {
            pattern_function.apply(this.state);
        } catch (e) {
            console.error(e);
        }

    }



}
