export enum KnitNodeType {
    PURL = 'purl',
    KNIT = 'knit',
    SLIP = 'slip',
    YARN_OVER = 'yarn_over',
    INCREASE = 'increase',
    DECREASE = 'decrease',
    BIND_OFF = 'bind_off',
    CAST_ON = 'cast_on',
}
export class YarnSpec {
    color: number;
    weight: number;
    constructor(color: number, weight: number) {
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
    start_row: boolean = false;
    side: KnitSide = KnitSide.RIGHT;
    constructor(type: KnitNodeType = KnitNodeType.KNIT, yarnSpec: YarnSpec = new YarnSpec(0x0011ff, 1), start_row: boolean = false, side: KnitSide = KnitSide.RIGHT) {
        this.yarnSpec = yarnSpec;
        this.type = type;
        this.id = KnitNode.idCounter++;
        this.start_row = start_row;
        this.side = side;
    }
}
export enum KnitEdgeDirection {
    ROW = 'row',
    COLUMN = 'column',
    BOTH = 'both',
    STITCH = 'stitch',
    START = 'start',
}
export enum KnitSide {
    RIGHT,
    WRONG,
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
    connect_with_end: boolean = false;
    last_end_node?: KnitNode;
    row_number: number = 0;
    col_number: number = 0;
    constructor(graph: KnitGraph) {
        this.graph = graph;
    }
    call_position(): number {
        let stack = (new Error()).stack?.split("\n");
        let error_line = stack ? stack[3] : undefined;
        let line = error_line?.match(/:(\d+):\d+\)$/)[1]
        return parseInt(line as string);
    }
    add_edge(edge: KnitEdge) {
        // console.log('add edge', edge);
        this.graph.edges.push(edge);
    }
    knit(n: number, type: KnitNodeType, procedal: KnitNodeType = KnitNodeType.KNIT, yarnSpec: YarnSpec = new YarnSpec(0x0011ff, 1)) {
        for (let i = 0; i < n; i++) {
            let node = new KnitNode(type, yarnSpec, false, this.side);
            node.line_number = this.call_position();
            node.row_number = this.row_number;
            node.col_number = this.col_number;
            this.col_number++;
            node.start_row = this.previous_node ? false : true;
            this.graph.nodes[node.id] = node;
            if (this.last_end_node) {
                // console.log('last_end_node', this.last_end_node, 'previous_node', this.previous_node);
                this.add_edge(new KnitEdge(this.last_end_node.id, node.id, KnitEdgeDirection.COLUMN, this.side));
                this.last_end_node = null;
            } else if (this.previous_node) {
                let traversal = [{ dir: KnitEdgeDirection.COLUMN, in: true }, { dir: KnitEdgeDirection.ROW, in: false }];
                if (procedal == KnitNodeType.SLIP) {
                    traversal = [{ dir: KnitEdgeDirection.ROW, in: true }]
                }
                if (procedal == KnitNodeType.YARN_OVER) {
                    traversal = [{ dir: KnitEdgeDirection.ROW, in: true }, { dir: KnitEdgeDirection.ROW, in: true }, { dir: KnitEdgeDirection.ROW, in: true }]
                }
                let top_node_traversal = this.graph.traverseGraph(this.previous_node, traversal);
                // console.log('traversal result', top_node_traversal, "all edges", this.graph.edges);
                if (top_node_traversal && top_node_traversal.nodes.length > 1) {
                    let bellow_node = top_node_traversal.nodes[top_node_traversal.nodes.length - 1];
                    // console.log('top_node', bellow_node, 'previous_node', this.previous_node);
                    this.add_edge(new KnitEdge(bellow_node.id, node.id, KnitEdgeDirection.COLUMN, this.side));
                }
                this.add_edge(new KnitEdge(this.previous_node.id, node.id, KnitEdgeDirection.ROW, this.side));

            }
            this.previous_node = node;
        }
    }
    end_row() {
        if (this.previous_node) {
            let end_node = this.graph.beginOfRow(this.previous_node);
            this.last_end_node = end_node;
            // console.log('end node for row', end_node, this.previous_node);
            if (end_node) {
                if (this.connect_with_end) {
                    this.add_edge(new KnitEdge(this.previous_node.id, end_node.id, KnitEdgeDirection.ROW, this.side));
                }
            }
        }
        this.row_number++;
        this.col_number = 0;
        switch (this.side) {
            case KnitSide.RIGHT:
                this.side = KnitSide.WRONG;
                break;
            case KnitSide.WRONG:
                this.side = KnitSide.RIGHT;
                break;
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
                console.log('no next node', current, dir, nodes);
                return null;
            }
        }
        return { nodes, edges };
    }
    neighbours(node: N): N[] {

        return this.edgesof(node).map((edge) => Object.values(this.nodes).find((n) => (node.id != n.id) && (n.id == edge.from || n.id == edge.to))).filter(node => node) as N[];
    }
    beginOfRow(node: N): N | undefined {
        let current_node = node;
        while (current_node) {
            let next_edge = this.edges.find(edges => edges.direction == KnitEdgeDirection.ROW && edges.to == current_node.id);
            if (next_edge) {
                current_node = this.nodes[next_edge.from];
            }
            else {
                return current_node;
            }
        }
    }
    execute(code: string) {
        this.state.last_end_node = null;
        this.state.previous_node = null;
        let pattern_function = (new Function(code)) as () => void;
        try {
            pattern_function.apply(this.state);
        } catch (e) {
            console.error(e);
        }

    }



}
