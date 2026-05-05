#pragma once
#include "enums.hpp"
#include <Eigen/Dense>
#include <map>
#include <optional>
#include <vector>
namespace knitsim {

  class Node {
   private:
   public:
    uint32_t id;
    uint32_t line_number;
    uint32_t row_number;
    uint32_t col_number;
    bool start_of_row;
    KnitNodeTypeC type;
    bool yarn_over = false; // node can be still purl or knit, incompatible with type
    KnitModeC mode;
    KnitSideC side;
    int32_t previous_node_id;
    bool has_above_node = false;
    Eigen::Vector3f position;
    Eigen::Vector3f knit_position;
    Eigen::Vector3f normal;
    Eigen::Vector3f next_dir;
    bool instanced = true; // as basic knits/purls outnumber everything else

    Node() {}
  };

  class Edge {
   private:
   public:
    uint32_t id;
    uint32_t from;
    uint32_t to;
    // Node *from_node;
    // Node *to_node;

    KnitEdgeDirectionC direction;
    Edge() {}
  };
} // namespace knitsim