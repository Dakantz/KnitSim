#include "Graph.hpp"
#include "Helpers.hpp"
#include <stdio.h>
#include <iostream>
void knitsim::KnitGraphC::computeHeuristicLayout()
{
    auto position = Eigen::Vector3f(0, 0, 0);
    auto node_ids = std::vector<uint32_t>();
    for (auto node : nodes)
    {
        node_ids.push_back(node.id);
    }
    // std::sort(node_ids.begin(), node_ids.end());

    auto start_normal = this->config.up_vector;
    auto plane_normal = start_normal.cross(this->config.right_vector);

    for (auto node_id : node_ids)
    {
        // std::cout << "Node id:" << node_id << std::endl;
        auto node = node_map[node_id];
        auto row = this->row(*node);
        Eigen::Vector3f offset_position;
        float x_offset_modifier = node->side == KnitSideC::WRONG ? 1 : -1;
        auto node_it = std::find_if(row.nodes.begin(), row.nodes.end(), [node_id](const Node &node)
                                    { return node.id == node_id; });
        // std::cout << "Node:" << node->id << " row size:" << row.nodes.size() << ", closed:" << row.closed << std::endl;
        auto start_node = std::find_if(row.nodes.begin(), row.nodes.end(), [](const Node &node)
                                       { return node.start_of_row; });
        if (row.closed && start_node != row.nodes.end())
        {
            // std::cout << "row is closed" << std::endl;
            auto node_it_offset = node_it - start_node;
            float angle = x_offset_modifier * ((float)node_it_offset / row.nodes.size()) * M_PI * 2;
            float radius = row.nodes.size() * this->config.step_size_x / M_PI;
            float x = radius * cos(angle);
            float y = radius * sin(angle);
            Eigen::Vector3f circle_pos = this->config.up_vector * x + this->config.right_vector * y;
            node->position = (*start_node).position + circle_pos + plane_normal * config.step_size_y;
        }
        else
        {
            offset_position = config.up_vector * (x_offset_modifier * config.step_size_x);
        }
        auto edges = this->outgoing(*node);
        for (auto edge : edges)
        {
            auto to_node = node_map[edge.to];
            switch (edge.direction)
            {
            case KnitEdgeDirectionC::ROW:
                to_node->position = node->position + offset_position;
                break;
            case KnitEdgeDirectionC::COLUMN:
                to_node->position = node->position + plane_normal * config.step_size_y;
                break;
            default:
                break;
            }
        }
    }
}
void knitsim::KnitGraphC::calculateNormals()
{
    for (auto &node : nodes)
    {
        auto neighbors = this->neighbours(node);
        if (neighbors.size() < 2)
        {
            continue;
        }

        std::vector<Eigen::Vector3f> positions;
        positions.push_back(node.position);
        for (auto neighbor : neighbors)
        {
            positions.push_back(neighbor.position);
        }
        Eigen::MatrixXf X(positions.size(), 3);
        for (size_t i = 0; i < positions.size(); i++)
        {
            X.row(i) = positions[i].transpose();
        }
        auto XtX = X.transpose() * X;
        Eigen::EigenSolver<Eigen::MatrixXf> es(XtX);
        if (es.info() != Eigen::Success)
        {
            throw std::runtime_error("Eigen solver failed");
        }
        auto eigenvalues = es.eigenvalues();
        auto eigenvectors = es.eigenvectors();

        // std::cout << "Eigenvalues:" << std::endl;
        // std::cout << eigenvalues << std::endl;
        // std::cout << "Eigenvectors:" << std::endl;
        // std::cout << eigenvectors << std::endl;

        node.normal = eigenvectors.col(2).real();

        auto orientation_normal = config.up_vector;

        for (auto neighbor : neighbors)
        {
            if (neighbor.normal.norm() > 0)
            {
                orientation_normal = neighbor.normal;
                break;
            }
        }
        if (node.normal.dot(orientation_normal) < 0)
        {
            node.normal = -node.normal;
        }
    }
}
void knitsim::KnitGraphC::recenter(Eigen::Vector3f offset, float d)
{
    Eigen::Vector3f center = this->center();
    for (auto &node : nodes)
    {
        node.position -= center * d + offset;
    }
}

void knitsim::KnitGraphC::computeKnitPaths()
{
    this->knitpaths.clear();
    for (auto &node : nodes)
    {
        auto neighbors = this->neighbours(node);
        auto node_offseted_pos = node.position;
        float offset = 0;
        switch (node.type)
        {
        case KnitNodeTypeC::PURL:
            offset = this->config.offset_purl;
            break;
        case KnitNodeTypeC::KNIT:
        default:
            offset = this->config.offset_knit;
            break;
        }
        if (node.side == KnitSideC::WRONG)
        {
            offset *= -0.9;
        }
        node_offseted_pos += node.normal * offset;



        std::vector<Eigen::Vector3f> path;
        path.push_back(node_offseted_pos);
        for (auto &neighbor : neighbors)
        {
            path.push_back(neighbor.position);
            path.push_back(node_offseted_pos);
        }
        this->knitpaths[node.id] = path;
    }
}