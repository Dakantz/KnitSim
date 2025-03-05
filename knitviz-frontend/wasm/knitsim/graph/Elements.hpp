#pragma once
#include "enums.hpp"
#include <vector>
#include <optional>
#include <map>
#include <Eigen/Dense>
namespace knitsim
{

    class Node
    {
    private:
    public:
        uint32_t id;
        uint32_t line_number;
        uint32_t row_number;
        uint32_t col_number;
        bool start_of_row;
        KnitNodeTypeC type;
        KnitModeC mode;
        KnitSideC side;
        uint32_t previous_node_id;
        Eigen::Vector3f position;
        Eigen::Vector3f normal;
        Eigen::Vector3f next_dir;

        Node()
        {
        }
    };

    class Edge
    {
    private:
    public:
        uint32_t id;
        uint32_t from;
        uint32_t to;
        // Node *from_node;
        // Node *to_node;

        KnitEdgeDirectionC direction;
        Edge()
        {
        }
    };
}