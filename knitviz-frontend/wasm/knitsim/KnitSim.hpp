#pragma once
#include "graph/Graph.hpp"
namespace knitsim
{
    class KnitSimConfig
    {
    public:
        float f_flattening_factor = 0.1;
        float f_expansion_factor = 0.2;
        float offset_scaler = 0.8;
    };
    class KnitNodeWrapper
    {
    public:
        Node *node;
        Eigen::Vector3f velocity = Eigen::Vector3f(0, 0, 0);

    public:
        KnitNodeWrapper(Node *node) : node(node) {}
    };
    class KnitSim
    {
    private:
        KnitGraphC &graph;
        KnitSimConfig cfg;
        std::vector<KnitNodeWrapper> wrappers;

    public:
        KnitSim(KnitGraphC &graph, KnitSimConfig cfg) : graph(graph), cfg(cfg)
        {
            initialize();
        }
        void initialize()
        {
            wrappers.clear();
            for (auto &node : graph.getNodes())
            {
                auto wrapper = KnitNodeWrapper(&node);
                wrappers.push_back(wrapper);
            }
            graph.computeHeuristicLayout();
            graph.calculateNormals();
        }
        float step(float time, float damping = 0.2, float force_damping = 0.2)
        {
            std::map<uint32_t, Eigen::Vector3f> forces;
            for (auto &wrapper : wrappers)
            {
                forces[wrapper.node->id] = Eigen::Vector3f(0, 0, 0);
            }
            for (auto &wrapper : wrappers)
            {
                auto node = wrapper.node;
                auto edges = graph.edgesOf(*node);
                auto node_force = Eigen::Vector3f(0, 0, 0);
                for (auto &edge : edges)
                {
                    float target_len = 0;
                    switch (edge.direction)
                    {
                    case KnitEdgeDirectionC::ROW:
                        target_len = graph.getConfig().step_size_x * cfg.offset_scaler;
                        break;
                    case KnitEdgeDirectionC::COLUMN:
                        target_len = graph.getConfig().step_size_y * cfg.offset_scaler;
                        break;
                    default:
                        break;
                    }
                    auto other_node = edge.from == node->id ? graph.getNode(edge.to) : graph.getNode(edge.from);
                    auto edge_dir = (other_node.position - node->position).normalized();
                    auto expansion_force = (graph.getNode(edge.to).position - node->position).norm() - target_len;
                    node_force += edge_dir * expansion_force * cfg.f_expansion_factor;

                    auto edge_angle = edge_dir.dot(node->normal);
                    auto flattening_force = edge_angle * cfg.f_flattening_factor;
                    forces[other_node.id] += edge_dir * flattening_force;
                }
                forces[node->id] += node_force;
            }
            float acc_differences = 0;
            for (auto &wrapper : wrappers)
            {
                auto node = wrapper.node;
                auto force = forces[node->id];
                auto vel_damped = wrapper.velocity * (1 - damping);
                auto acceleration = force * force_damping;
                wrapper.velocity = acceleration * time + vel_damped;
                auto pos_delta = wrapper.velocity * time;
                node->position += pos_delta;
                acc_differences += pos_delta.norm();
            }
            return acc_differences;
        }
    };
} // namespace knitsim