#pragma once
#include "enums.hpp"
#include <vector>
#include <optional>
#include <map>
#include <Eigen/Dense>
#include "Elements.hpp"
#include "Helpers.hpp"
#include <iostream>
namespace knitsim
{

    class KnitGraphC
    {
    private:
        std::vector<Node> nodes;
        std::vector<Edge> edges;
        std::map<uint32_t, Node *> node_map;
        /*
        from map contains [node_id] -> [list of nodes that have an edge from this node]
        to map contains [node_id] -> [list of nodes that have an edge to this node]
        */
        std::map<uint32_t, std::vector<Node *>> node_outgoings;
        std::map<uint32_t, std::vector<Node *>> node_incomings;
        std::map<uint32_t,
                 std::vector<Eigen::Vector3f>>
            knitpaths;
        GraphConfig config;

    public:
        KnitGraphC(GraphConfig &config, std::vector<Node> &nodes, std::vector<Edge> &edges)
        {
            this->config = config;
            this->setNodes(nodes);
            this->setEdges(edges);
        }
        void setConfig(GraphConfig &config)
        {
            this->config = config;
        }
        const GraphConfig &getConfig() const
        {
            return config;
        }
        void setNodes(std::vector<Node> &nodes)
        {
            this->nodes = nodes;
            node_map.clear();
            for (auto &node : this->nodes)
            {
                // std::cout << "Node:" << node.id << std::endl;
                // std::cout << "Position:" << node.position << std::endl;
                node_map[node.id] = &node;
            }
        }
        void setEdges(std::vector<Edge> &edges)
        {
            this->edges = edges;
            node_outgoings.clear();
            node_incomings.clear();
            for (auto edge : edges)
            {
                if (node_outgoings.find(edge.from) == node_outgoings.end())
                {
                    node_outgoings[edge.from] = {};
                }
                node_outgoings[edge.from].push_back(node_map[edge.to]);
                if (node_incomings.find(edge.to) == node_incomings.end())
                {
                    node_incomings[edge.to] = {};
                }
                node_incomings[edge.to].push_back(node_map[edge.from]);
            }
        }
        std::vector<Node> &getNodes()
        {
            return nodes;
        }
        std::vector<Edge> &getEdges()
        {
            return edges;
        }
        Node getNode(uint32_t id) const
        {
            return *node_map.at(id);
        }
        std::vector<Node> getFromNodes(uint32_t id) const
        {
            std::vector<Node> nodes;
            if (node_outgoings.find(id) == node_outgoings.end())
            {
                return nodes;
            }
            for (auto n : node_incomings.at(id))
            {
                nodes.push_back(*n);
            }
            return nodes;
        }
        std::vector<Node> getToNodes(uint32_t id) const
        {
            std::vector<Node> nodes;
            if (node_incomings.find(id) == node_incomings.end())
            {
                return nodes;
            }
            for (auto n : node_outgoings.at(id))
            {
                nodes.push_back(*n);
            }
            return nodes;
        }
        std::vector<Edge> edgesOf(Node &node, std::optional<KnitEdgeDirectionC> direction = std::nullopt) const
        {
            std::vector<Edge> result;
            for (auto edge : edges)
            {
                if ((edge.from == node.id || edge.to == node.id) && (direction == std::nullopt || edge.direction == direction))
                {
                    result.push_back(edge);
                }
            }
            return result;
        }
        std::vector<Edge> incoming(const Node &node, std::optional<KnitEdgeDirectionC> direction = std::nullopt) const
        {
            std::vector<Edge> result;
            for (auto edge : edges)
            {
                if (edge.to == node.id && (direction == std::nullopt || edge.direction == direction))
                {
                    result.push_back(edge);
                }
            }
            return result;
        }
        std::vector<Edge> outgoing(const Node &node, std::optional<KnitEdgeDirectionC> direction = std::nullopt) const
        {
            std::vector<Edge> result;
            for (auto edge : edges)
            {
                if (edge.from == node.id && (direction == std::nullopt || edge.direction == direction))
                {
                    result.push_back(edge);
                }
            }
            return result;
        }
        std::vector<Node> outgoingNodes(const Node &node, std::optional<KnitEdgeDirectionC> direction = std::nullopt) const
        {
            std::vector<Node> result;
            for (auto edge : outgoing(node, direction))
            {
                if (direction == std::nullopt || edge.direction == direction)
                {
                    if (node_outgoings.find(edge.from) != node_outgoings.end())
                    {
                        for (auto n : node_outgoings.at(edge.to))
                        {
                            result.push_back(*n);
                        }
                    }
                }
            }
            return result;
        }
        std::vector<Node> incomingNodes(const Node &node, std::optional<KnitEdgeDirectionC> direction = std::nullopt) const
        {
            std::vector<Node> result;
            for (auto edge : incoming(node))
            {
                if (direction == std::nullopt || edge.direction == direction)
                {
                    if (node_outgoings.find(edge.from) != node_outgoings.end())
                    {
                        for (auto n : node_outgoings.at(edge.from))
                        {
                            result.push_back(*n);
                        }
                    }
                }
            }
            return result;
        }
        std::vector<Node> neighbours(Node &node, std::optional<KnitEdgeDirectionC> direction = std::nullopt) const
        {
            std::vector<Node> result;
            for (auto edge : edges)
            {
                if ((direction == std::nullopt || edge.direction == direction))
                {
                    if (edge.from == node.id)
                        result.push_back(getNode(edge.to));
                    else if (edge.to == node.id)
                        result.push_back(getNode(edge.from));
                }
            }
            return result;
        }

        std::vector<TraversalResult> traverseGraph(Node &start_node, std::vector<TraversalInstruction> &instructions) const
        {
            std::vector<TraversalResult> results;

            std::vector<Node> nodes = {start_node};
            std::vector<Edge> edges;
            Node *current_node = &start_node;
            for (auto instruction : instructions)
            {
                Node *next = NULL;
                std::vector<Edge> rel_edges;
                if (instruction.in)
                {
                    rel_edges = incoming(*current_node, instruction.direction);
                }
                else
                {
                    rel_edges = outgoing(*current_node, instruction.direction);
                }

                if (rel_edges.size() == 0)
                {
                    return {};
                }

                auto edge = rel_edges[0];
                std::vector<Node *> next_nodes = {};
                if (instruction.in && node_outgoings.find(edge.from) != node_outgoings.end())
                {
                    next_nodes = node_outgoings.at(edge.from);
                }
                else if (!instruction.in && node_incomings.find(edge.to) != node_incomings.end())
                {
                    next_nodes = node_incomings.at(edge.to);
                }

                if (next_nodes.size() == 0)
                {
                    return {};
                }

                next = next_nodes[0];

                edges.push_back(edge);
                nodes.push_back(*next);
                current_node = next;
            }
            results.push_back(TraversalResult(nodes, edges));
            return results;
        }
        RowResult rowUnordered(const Node &start_node) const
        {
            std::vector<Node> nodes = {start_node};
            const Node *current_node = &start_node;
            while (current_node)
            {
                auto col_edge = incoming(*current_node, KnitEdgeDirectionC::COLUMN);
                if (col_edge.size() > 0)
                {
                    for (auto edge : col_edge)
                    {
                        if (edge.from == start_node.id)
                        {
                            return RowResult(nodes, false);
                        }
                    }
                }
                auto row_edges = outgoing(*current_node, KnitEdgeDirectionC::ROW);
                if (row_edges.size() == 0)
                {
                    return RowResult(nodes, false);
                }
                for (auto edge : row_edges)
                {
                    if (edge.to == start_node.id)
                    {
                        return RowResult(nodes, true);
                    }
                    else
                    {
                        // std::cout << "Row search for " << start_node.id << ": adding node:" << edge.to << std::endl;

                        current_node = node_map.at(edge.to);
                        nodes.push_back(*current_node);
                        break;
                    }
                }
            }
            return RowResult(nodes, false);
        }
        RowResult row(Node &start_node) const
        {
            auto res = rowUnordered(start_node);
            auto start_iter = std::find_if(res.nodes.begin(), res.nodes.end(), [](const Node &node)
                                           { return node.start_of_row == true; });
            if (start_iter != res.nodes.end() && start_iter != res.nodes.begin())
            {
                std::rotate(res.nodes.begin(), start_iter, res.nodes.end());
            }
            return res;
        }
        Eigen::Vector3f center() const
        {
            Eigen::Vector3f center = Eigen::Vector3f(0, 0, 0);
            for (auto node : nodes)
            {
                center += node.position;
            }
            return center / nodes.size();
        }
        std::vector<Eigen::Vector3f> knitPath(uint32_t node_id) const
        {
            if (knitpaths.find(node_id) != knitpaths.end())
            {
                return knitpaths.at(node_id);
            }
            return {};
        }
        void computeKnitPaths();
        void computeHeuristicLayout();
        void calculateNormals();
        void recenter(Eigen::Vector3f offset = Eigen::Vector3f(0, 0, 0), float dampening = 0.1);
    };
}