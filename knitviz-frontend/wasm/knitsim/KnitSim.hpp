#pragma once
#include "graph/Graph.hpp"
namespace knitsim
{
    class KnitSimConfig
    {
    public:
        float f_flattening_factor = 0.1;
        float f_expansion_factor = 0.2;
        float f_repel_factor = 0.1;
        float offset_scaler = 0.8;
    };
    class KnitNodeWrapper
    {
    public:
        Node *node;
        Eigen::Vector3f velocity = Eigen::Vector3f(0, 0, 0);
        Eigen::Vector3f force = Eigen::Vector3f(0, 0, 0);

    public:
        KnitNodeWrapper() : node(nullptr)
        {
        }
        KnitNodeWrapper(Node *node) : node(node) {}
    };
    class KnitSim
    {
    private:
        KnitGraphC &graph;
        KnitSimConfig cfg;
        std::map<uint32_t, KnitNodeWrapper> wrappers;

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
                wrappers[node.id] = wrapper;
            }
            graph.computeHeuristicLayout();
            graph.calculateNormals();
            computeForces();
        }
        Eigen::Vector3f getForce(uint32_t id)
        {
            if (wrappers.find(id) == wrappers.end())
            {
                return Eigen::Vector3f(0, 0, 0);
            }
            return wrappers.at(id).force;
        }
        float computeForces()
        {
            for (auto &wrapper : wrappers)
            {
                wrapper.second.force = Eigen::Vector3f(0, 0, 0);
            }
            for (auto &kv : wrappers)
            {
                auto &wrapper = kv.second;
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
                    auto edge_v = other_node.position - node->position;
                    auto edge_dir = edge_v.normalized();
                    auto expansion_force = edge_v.norm() - target_len;
                    node_force += edge_dir * expansion_force * cfg.f_expansion_factor;

                    auto edge_angle = edge_dir.dot(node->normal);
                    auto flattening_force = edge_angle * cfg.f_flattening_factor;
                    wrappers[other_node.id].force += -node->normal * flattening_force;
                }
                wrappers[node->id].force += node_force;
            }
            for (auto &wrapper : wrappers)
            {
                auto node = wrapper.second.node;
                auto neighbors = graph.neighbours(*node);
                for (auto &neighbor : neighbors)
                {
                    auto repel_force = cfg.f_repel_factor / ((neighbor.position - node->position).squaredNorm());
                    wrappers[node->id].force += repel_force * (neighbor.position - node->position).normalized();
                }
            }
            float total_force = 0;
            for (auto &wrapper : wrappers)
            {
                total_force += wrapper.second.force.norm();
            }
            return total_force;
        }
        float step(float time, float damping = 0.2, float force_damping = 0.2)
        {
            // std::cout << "Calculating Normals" << std::endl;
            graph.calculateNormals();
            // std::cout << "Calculating Forces" << std::endl;
            float total = computeForces();
            std::cout << "Total Force:" << total << std::endl;
            // std::cout << "Stepping" << std::endl;
            float acc_differences = 0;
            for (auto &kv : wrappers)
            {
                auto &wrapper = kv.second;
                auto node = wrapper.node;
                auto force = wrapper.force;
                auto vel_damped = wrapper.velocity * (1 - damping);
                auto acceleration = force * force_damping;
                wrapper.velocity = acceleration * time + vel_damped;
                auto pos_delta = wrapper.velocity * time;
                node->position += pos_delta;
                acc_differences += pos_delta.norm();
            }
            graph.recenter(Eigen::Vector3f(0, 0, 0), damping);
            graph.computeKnitPaths();
            return acc_differences;
        }
    };
} // namespace knitsim