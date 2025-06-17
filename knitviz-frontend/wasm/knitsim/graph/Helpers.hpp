#pragma once
#include "Elements.hpp"
#include "enums.hpp"
#include <Eigen/Dense>
namespace knitsim {
  class GraphConfig {
   public:
    float step_size_x;
    float step_size_y;
    float offset_bidirectional;
    float offset_purl;
    float offset_knit;
    float yarn_thickness;
    Eigen::Vector3f up_vector;
    Eigen::Vector3f right_vector;

    GraphConfig(
        float step_size_x = 0.5, float step_size_y = 1, float offset_bidirectional = 0.1, float offset_purl = 0.4,
        float offset_knit = -0.3, float yarn_thickness = 0.03, Eigen::Vector3f up_vector = Eigen::Vector3f(1, 0, 0),
        Eigen::Vector3f right_vector = Eigen::Vector3f(0, 0, 1)
    ) {
      this->step_size_x = step_size_x;
      this->step_size_y = step_size_y;
      this->offset_bidirectional = offset_bidirectional;
      this->offset_purl = offset_purl;
      this->offset_knit = offset_knit;
      this->yarn_thickness = yarn_thickness;
      this->up_vector = up_vector;
      this->right_vector = right_vector;
    }
  };

  class TraversalResult {
   public:
    std::vector<Node> nodes;
    std::vector<Edge> edges;
    TraversalResult(std::vector<Node> nodes = {}, std::vector<Edge> edges = {}) {
      this->nodes = nodes;
      this->edges = edges;
    }
  };
  class TraversalInstruction {
   public:
    bool in;
    KnitEdgeDirectionC direction;
    TraversalInstruction(KnitEdgeDirectionC direction, bool in = true) {
      this->in = in;
      this->direction = direction;
    }
  };
  class RowResult {
   public:
    std::vector<Node> nodes;
    bool closed;
    RowResult(std::vector<Node> nodes = {}, bool closed = false) {
      this->nodes = nodes;
      this->closed = closed;
    }
    RowResult(const RowResult &other) {
      this->nodes = other.nodes;
      this->closed = other.closed;
    }
    RowResult &operator=(const RowResult &other) {
      if (this != &other) {
        this->nodes = other.nodes;
        this->closed = other.closed;
      }
      return *this;
    }
  };
} // namespace knitsim