#include "Graph.hpp"
#include "Helpers.hpp"
#include <iostream>
#include <stdio.h>
void knitsim::KnitGraphC::computeHeuristicLayout() {
  auto position = Eigen::Vector3f(0, 0, 0);
  auto node_ids = std::vector<uint32_t>();
  for (auto node : nodes) {
    node_ids.push_back(node.id);
  }
  // std::sort(node_ids.begin(), node_ids.end());

  auto start_normal = this->config.up_vector;
  auto plane_normal = start_normal.cross(this->config.right_vector);

  for (auto node_id : node_ids) {
    // std::cout << "Node id:" << node_id << std::endl;
    auto node = node_map[node_id];
    auto row = this->row(*node);
    Eigen::Vector3f offset_position = Eigen::Vector3f(0, 0, 0);
    float x_offset_modifier = node->side == KnitSideC::WRONG ? 1 : -1;
    auto node_it =
        std::find_if(row.nodes.begin(), row.nodes.end(), [node_id](const Node &n) { return n.id == node_id; });
    // std::cout << "Node:" << node->id << " row size:" << row.nodes.size() << ", closed:" << row.closed << std::endl;
    auto start_node =
        std::find_if(row.nodes.begin(), row.nodes.end(), [](const Node &n) { return n.start_of_row == true; });
    if (row.closed) {
      if (start_node != row.nodes.end()) {
        auto node_it_offset = node_it - start_node;
        float progress = ((float)node_it_offset) / row.nodes.size();
        // std::cout << "iterator position: " << progress << ", start:" << node_it->start_of_row << ", size: " <<
        // row.nodes.size() << std::endl;
        float angle = x_offset_modifier * progress * M_PI * 2;
        float radius = row.nodes.size() * this->config.step_size_x / M_PI;
        float x = radius * cos(angle);
        float y = radius * sin(angle);
        Eigen::Vector3f circle_pos =
            this->config.up_vector * x + this->config.right_vector * y - this->config.up_vector * radius;
        node->position = (*start_node).position + circle_pos + plane_normal * config.step_size_y * progress;
      }
    } else {
      // std::cerr << "Node not found in row" << node->id << "/" << row.nodes.size() << std::endl;

      offset_position = config.up_vector * (x_offset_modifier * config.step_size_x);
    }
    auto edges = this->outgoing(*node);
    for (auto edge : edges) {
      auto to_node = node_map[edge.to];
      switch (edge.direction) {
      case KnitEdgeDirectionC::ROW:
        if (!row.closed) {
          // if row is not closed, we need to add the offset position
          to_node->position = node->position + offset_position;
        }
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
void knitsim::KnitGraphC::calculateNormals() {
  for (auto &node : nodes) {
    auto neighbors = this->neighbours(node);
    // std::cout << "Node:" << node.id << " neighbors:" << neighbors.size() << std::endl;
    if (neighbors.size() < 2) {
      continue;
    }

    std::vector<Eigen::Vector3f> positions = {node.position};
    Eigen::Vector3f node_pos_sum = node.position;
    // positions.push_back(node.position);
    for (auto neighbor : neighbors) {
      positions.push_back(neighbor.position);
      node_pos_sum += neighbor.position;
      // std::cout << "Neighbor:" << neighbor.id << "pos" << neighbor.position << std::endl;
    }
    Eigen::Vector3f node_pos_avg = node_pos_sum / (neighbors.size() + 1);
    Eigen::MatrixXf X(positions.size(), 3);
    for (size_t i = 0; i < positions.size(); i++) {
      X.row(i) = (positions[i] - node_pos_avg).transpose();
    }
    // Eigen::Matrix<float, 3, 3> XtX = X.transpose() * X;
    Eigen::JacobiSVD<Eigen::MatrixXf> es(X.transpose(), Eigen::ComputeThinU | Eigen::ComputeThinV);
    if (es.info() != Eigen::Success) {
      std::cerr << "EigenSolver failed for" << node.id << std::endl;
      continue;
    }
    auto eigenvalues = es.singularValues();
    auto eigenvectors = es.matrixU();

    // std::cout << "Eigenvalues:" << std::endl;
    // std::cout << eigenvalues << std::endl;
    // std::cout << "Eigenvectors:" << std::endl;
    // std::cout << eigenvectors << std::endl;

    node.normal = eigenvectors.col(2).real();

    auto orientation_normal = config.up_vector;

    for (auto neighbor : neighbors) {
      if (neighbor.normal.norm() > 0) {
        orientation_normal = neighbor.normal;
        break;
      }
    }
    if (node.normal.dot(orientation_normal) < 0) {
      node.normal = -node.normal;
    }
  }
}
void knitsim::KnitGraphC::recenter(Eigen::Vector3f offset, float d) {
  Eigen::Vector3f center = this->center();
  for (auto &node : nodes) {
    node.position -= center * d + offset;
  }
}

// void knitsim::KnitGraphC::computeKnitPaths(float loop_width) {
//   this->knitpaths.clear();
//   for (auto &node : nodes) {
//     auto neighbors = this->neighbours(node);
//     auto node_offseted_pos = node.position;
//     float offset = 0;
//     switch (node.type) {
//     case KnitNodeTypeC::PURL:
//       offset = this->config.offset_purl;
//       break;
//     case KnitNodeTypeC::KNIT:
//     default:
//       offset = this->config.offset_knit;
//       break;
//     }
//     if (node.side == KnitSideC::WRONG) {
//       offset *= -0.9;
//     }
//     node_offseted_pos += node.normal * offset;

//     std::vector<Eigen::Vector3f> path;
//     path.push_back(node_offseted_pos);
//     for (auto &neighbor : neighbors) {
//       path.push_back(neighbor.position);
//       path.push_back(node_offseted_pos);
//     }
//     this->knitpaths[node.id] = path;
//   }
// }

void knitsim::KnitGraphC::computeKnitPaths(float loop_width, bool instancing) {
  this->knitpaths.clear();
  float offset;
  uint32_t row_yo_num;
  bool is_round = false;

  // size_t num_cast_on = 0;
  // size_t num_knits = 0;
  // size_t num_bind_off = 0;
  // size_t num_increase = 0;
  // size_t num_decrease = 0;
  // size_t num_yarn_over = 0;

  // determine if ROUND mode, default FLAT
  // doesn't change, enough to look once
  // ROUND mode never set, check if node is in one plane (first nodes of row always z=0)


  unsigned int tmp = 2;
  if(nodes.size()-1 < tmp) tmp = nodes.size()-1;
  if(nodes[0].mode == KnitModeC::ROUND || nodes[tmp].position[2] != 0  ) is_round = true;

  // precompute offset knit position per node
  for (auto &node : nodes) {

    std::cout << nodes[node.id].target_node_id << std::endl;

    offset = 0;
    // apply type mod
    switch(node.side) {
      case(KnitSideC::RIGHT):
        offset = this->config.offset_knit;
        break;

      case(KnitSideC::WRONG):
        offset = this->config.offset_purl;
        break;

      default:
      offset = this->config.offset_bidirectional;
        break;
    }
    // apply side mod
    if(node.side == KnitSideC::WRONG) {
      offset *= -0.9;
    }
    node.knit_position = node.position + node.normal*offset*0.5;

    // reset number of yarn_overs if new row
    if(node.start_of_row) {
      row_yo_num = 0;
    }

    // correct edges if yarn_over
    if(node.yarn_over) {
      // yarn_over_num++;
      row_yo_num++; // increase number of yarn_overs in current row
    }

    auto edges = edgesOf(node);

    if(row_yo_num > 0) {
      // correct incoming column edge
      for(auto e : edges) {
        if(e.to == node.id && e.direction == KnitEdgeDirectionC::COLUMN) {
          yo_fix_map.insert({e.from, row_yo_num});
        }
      }
    }

    // check for above node
    // node.has_above_node = false;
    for (auto e : edges) {
      if(e.to == node.id && getNode(e.from).position[1] > node.position[1]) {
        if(is_round && e.from != (uint32_t)node.previous_node_id && e.from > 1) {
          node.has_above_node = true;
        } else if(!is_round)
          node.has_above_node = true;
        break;
      }
    }
    // set has_above_node based on col number
    // if above nodes don't have same col number, current node must have no above connection yet


    if(row_length_list.size() > 0 && row_length_list.back() < node.col_number) { // check if more nodes than prev row
      node.has_above_node = false;
    }

    if((node.id < nodes.size()-1 && getNode(node.id+1).start_of_row) || node.id == nodes.size()-1) {
      row_length_list.push_back(node.col_number);
    }
    // std::cout << ", prev_row_len: " << prev_row_length;

    // set ROUND
    // remove if set beforehand
    if(is_round) {
      node.mode = KnitModeC::ROUND;
    }

    // std::cout << node.id << " : " << node.has_above_node << std::endl;
  }

  // construct paths per node
  for (auto &node : nodes) {

    std::vector<Eigen::Vector3f> path;

    if(node.id == 0) {
      path = constructCastOn(node, loop_width, instancing);
      node.instanced = false;
      // num_cast_on++;
    }
    else if (node.row_number == getNode(nodes.size()-1).row_number) { // construct bind off in last row
      // TODO: add sanitiy check when above row shorter than last
      path = constructBindOff(node);
      node.instanced = false;
      // num_bind_off++;
    }
    else {

        if(instancing) { // INSTANCED rendering

          auto iter = yo_fix_map.find(node.id);
          if(iter == yo_fix_map.end()) {
            path = getInstanceTransforms(node, is_round, loop_width, 0);
          } else {
            path = getInstanceTransforms(node, is_round, loop_width, iter->second);
          }

          // if(path.size() > 6) {num_increase+=2; num_knits++;}
          // else if(node.yarn_over) {num_yarn_over++;}
          // else {num_knits++;}
        }
        else { // NON-INSTANCED rendering

          auto iter = yo_fix_map.find(node.id);
          if(iter == yo_fix_map.end()) {
            path = getExtendedKnits(node, is_round, loop_width, 0);
          } else {
            path = getExtendedKnits(node, is_round, loop_width, iter->second);
          }
          node.instanced = false;
        }

      // }
    }

    this->knitpaths[node.id] = path;

    std::cout << nodes[node.id].target_node_id << std::endl;
  }

  // std::cout << "# cast on = " << num_cast_on << std::endl;
  // std::cout << "# knits = " << num_knits << std::endl;
  // std::cout << "# bind off = " << num_bind_off << std::endl;
  // std::cout << "# increase = " << num_increase << std::endl;
  // std::cout << "# decrease = " << num_decrease << std::endl;
  // std::cout << "# yarn over = " << num_yarn_over << std::endl;

  // clear temporary lists
  yo_fix_map.clear();
  row_length_list.clear();
}

std::vector<Eigen::Vector3f> knitsim::KnitGraphC::constructCastOn(Node node, float loop_width, bool instancing)
{
  std::vector<Eigen::Vector3f> path;
  Node prev_node, next_node, front_node;
  Eigen::Vector3f row_pos_mod, col_pos_mod, dist_vec;

  // get horizontal modifier
  row_pos_mod = getNode(1).knit_position-node.knit_position;
  row_pos_mod.normalize();

  bool found = false;
  if(nodes[node.id].target_node_id == 0) {
    // determine distance to underlying node
    auto edges = edgesOf(node);
    int dist = INT_MAX;
    for (auto e : edges) {
      if(e.direction == KnitEdgeDirectionC::COLUMN && e.from == node.id) {
        // ignore yarn over
        if(getNode(e.to).type == KnitNodeTypeC::YARN_OVER) {
          continue;
        }

        dist_vec = node.knit_position - getNode(e.to).knit_position;
        if(dist > dist_vec.norm()) {
          dist = dist_vec.norm();
          front_node = getNode(e.to);
          nodes[node.id].target_node_id = front_node.id;
          found = true;
        }
      }
    }
  } else {
    front_node = getNode(nodes[node.id].target_node_id);
    found = true;
  }

  if (found) {
    node_map.at(front_node.id)->has_above_node = true;
    col_pos_mod = front_node.knit_position - node.knit_position;
    col_pos_mod.normalize();


    // default connection to next node
    if (instancing) {
      path.push_back(node.knit_position + (getNode(1).knit_position-node.knit_position)*0.85);
    } else {
      path.push_back(node.knit_position + (getNode(1).knit_position-node.knit_position)*0.55);
    }
    path.push_back(node.knit_position - row_pos_mod*0.05);

    // loop
    path.push_back(front_node.knit_position - row_pos_mod*loop_width - col_pos_mod*0.1 + node.normal*0.1);
    path.push_back(front_node.knit_position - row_pos_mod*0.7*loop_width + col_pos_mod*0.1 - node.normal*0.1);

    path.push_back(front_node.knit_position + row_pos_mod*0.7*loop_width + col_pos_mod*0.1 - node.normal*0.1);
    path.push_back(front_node.knit_position + row_pos_mod*loop_width - col_pos_mod*0.1 + node.normal*0.1);


    // slipknot
    path.push_back(node.knit_position + row_pos_mod*0.15*0.5 + col_pos_mod*0.05);

    path.push_back(node.knit_position + row_pos_mod*loop_width*0.8 + col_pos_mod*0.15 + node.normal*0.05);
    path.push_back(node.knit_position + col_pos_mod*0.1 + node.normal*0.1);
    path.push_back(node.knit_position - row_pos_mod*loop_width + col_pos_mod*0.1);
    path.push_back(node.knit_position + col_pos_mod*0.1 - node.normal*0.1);
    path.push_back(node.knit_position + row_pos_mod*loop_width*0.5 + col_pos_mod*0.1 - node.normal*0.05);
    path.push_back(node.knit_position + row_pos_mod*loop_width*0.5 + col_pos_mod*0.1 + node.normal*0.05);

    // connection to next nodes cast on tail
    path.push_back(node.knit_position + (getNode(1).knit_position-node.knit_position)*0.5 - col_pos_mod*0.1 + node.normal*0.05);
  } else {
    return constructBindOff(node, loop_width);
  }


  // build in short yarn of node 0
  Node cast_on_node;
  if(node.id + 1 <= nodes.size()) {
    cast_on_node = getNode(node.id + 1);

    while(!cast_on_node.has_above_node) {

      if (cast_on_node.id == 1) {
        prev_node = node;
        row_pos_mod = cast_on_node.knit_position - node.knit_position;
      } else {
        prev_node = getNode(cast_on_node.id-1);
      }
      row_pos_mod = cast_on_node.knit_position - prev_node.knit_position;
      row_pos_mod.normalize();

      // aux knot
      path.push_back(cast_on_node.knit_position - cast_on_node.normal*0.05);
      path.push_back(cast_on_node.knit_position + row_pos_mod*0.8*loop_width + col_pos_mod*0.1);
      path.push_back(cast_on_node.knit_position + col_pos_mod*0.2 + cast_on_node.normal*0.1);
      path.push_back(cast_on_node.knit_position - row_pos_mod*0.8*loop_width + col_pos_mod*0.1);
      path.push_back(cast_on_node.knit_position + cast_on_node.normal*0.05);
      path.push_back(cast_on_node.knit_position + (cast_on_node.knit_position - prev_node.knit_position)*0.5 - col_pos_mod*0.1 + cast_on_node.normal*0.05);

      if(node.id + 1 <= nodes.size())
        cast_on_node = getNode(cast_on_node.id + 1);
      else break;
    }
  }

  return path;
}

std::vector<Eigen::Vector3f> knitsim::KnitGraphC::constructBindOff(Node node, float loop_width) {

  std::vector<Eigen::Vector3f> path;
  Node next_node, prev_node, back_node;
  Eigen::Vector3f row_pos_mod, col_pos_mod;

  // determine horizontal modifier
  if (node.id < nodes.size()-1) {
    next_node = getNode(node.id+1);
    row_pos_mod = (next_node.knit_position-node.knit_position);
    row_pos_mod.normalize();
  } else { // if last node, do final knit
    prev_node = getNode(node.id-1);

    row_pos_mod = node.knit_position-prev_node.knit_position;
    row_pos_mod.normalize();
    col_pos_mod = Eigen::Vector3f(0, -1, 0);
    path.push_back(node.knit_position - (node.knit_position-prev_node.knit_position)*0.5);
    path.push_back(node.knit_position - row_pos_mod*0.6*loop_width);
    path.push_back(node.knit_position + col_pos_mod*0.5);
    path.push_back(node.knit_position + row_pos_mod*0.5 + col_pos_mod*0.7);
    return path;
  }

  // connection to prev node
  prev_node = getNode(node.id-1);
  if(node.start_of_row) {
    path.push_back(node.knit_position - row_pos_mod*0.4*loop_width - (node.knit_position-prev_node.knit_position)*0.55);
  } else {
    path.push_back(node.knit_position - (node.knit_position-prev_node.knit_position)*0.55);
  }
  path.push_back(node.knit_position - row_pos_mod*0.6*loop_width);

  // determine distance to top/back node
  bool found = false;
  if(nodes[node.id].target_node_id == 0) {
    auto edges = edgesOf(node);
    for (auto e : edges) {
      if(e.direction == KnitEdgeDirectionC::COLUMN && e.to == node.id) {
        back_node = getNode(e.from);
        nodes[node.id].target_node_id = back_node.id;
        found = true;
        // std::cout << "Front Node: " << e.to << " of Node: " << node.id << " with # of edges: " << edges.size() << " from total Nodes: " << nodes.size() << std::endl;
      }
    }
  } else {
    back_node = getNode(nodes[node.id].target_node_id);
    found = true;
  }

  if (found) {
    node_map.at(back_node.id)->has_above_node = true;
    col_pos_mod =  node.knit_position - back_node.knit_position;
    col_pos_mod.normalize();
  } else {
    col_pos_mod = Eigen::Vector3f(0, -1, 0);
  }

  // loop
  path.push_back(node.knit_position - row_pos_mod*0.1 + col_pos_mod*0.25 + node.normal*0.05);
  path.push_back(next_node.knit_position + col_pos_mod*0.2 + node.normal*loop_width);
  path.push_back(next_node.knit_position + row_pos_mod*0.3 + col_pos_mod*0.2 + node.normal*0.5*loop_width);

  path.push_back(next_node.knit_position + row_pos_mod*0.3 + col_pos_mod*0.2 - node.normal*0.5*loop_width);
  path.push_back(next_node.knit_position + col_pos_mod*0.2 - node.normal*loop_width);
  path.push_back(node.knit_position + row_pos_mod*0.1 + col_pos_mod*0.25 - node.normal*0.05);


  // connection to next node
  path.push_back(node.knit_position + row_pos_mod*0.6*loop_width);
  path.push_back(node.knit_position + (next_node.knit_position-node.knit_position)*0.55);

  return path;
}

knitsim::Node knitsim::KnitGraphC::getDecreaseNode(Node node, bool is_round) {

  Node next_node = getNode(node.id+1);
  Node front_node;
  Node iter_node = node;
  bool found = false;
  int iter_direction = 1; // default looks for prev nodes, negate to look for next
  while(!found) {
    // check if end/start of row reached, switch direction
    if(iter_node.start_of_row) {
      if(iter_direction < 0) break; // if already switched, stop
      iter_node = next_node;
      iter_direction = -1;
      continue;
    }

    auto edges = edgesOf(iter_node);
    for (auto e : edges) {
      if(e.direction == KnitEdgeDirectionC::COLUMN && e.from == iter_node.id) {
        if(getNode(e.to).yarn_over) {
          continue;
        }

        front_node = getNode(e.to);
        found = true;
      }
    }

    // get prev node
    if(iter_node.id - iter_direction > 0 && iter_node.id - iter_direction < nodes.size()-1) {
      iter_node = getNode(iter_node.id - iter_direction);
    }
    else break;
  }

  // handle yarn over correction
  if(!is_round && node.start_of_row) { // FLAT mode
    auto iter = yo_fix_map.find(iter_node.id);
    if(iter != yo_fix_map.end()) {
      auto yo_fix = iter->second;
      if(front_node.id+yo_fix+1 < nodes.size()-1) {
        if(getNode(front_node.id+yo_fix+1).row_number == getNode(front_node.id+yo_fix).row_number) {
          front_node = getNode(front_node.id+yo_fix+1);
        } else front_node = getNode(front_node.id+yo_fix);
      } else getNode(nodes.size()-1);
    }
  } else if(is_round) { // ROUND mode
    auto iter = yo_fix_map.find(iter_node.id);
    if(iter != yo_fix_map.end()) {
      auto yo_fix = iter->second;

      // subtract/add difference in row length
      yo_fix = yo_fix - (row_length_list[node.row_number-1] - row_length_list[front_node.row_number-1]);
      if (yo_fix < 0) yo_fix = 0;

      if(front_node.id+yo_fix < nodes.size()-1) {
        front_node = getNode(front_node.id+yo_fix);
        // check for closer target
        Node tmp = front_node;
        for(int i=-3; i<=3; i++) {
          if(getNode(front_node.id+i).yarn_over) continue;
          Eigen::Vector3f dist_vec = node.knit_position - getNode(front_node.id+i).knit_position;
          if((node.knit_position - tmp.knit_position).norm() > dist_vec.norm())
            tmp = getNode(front_node.id+i);
        }
        front_node = tmp;
      } else getNode(nodes.size()-1);
    }
  }

  return front_node;
}

std::vector<knitsim::Node> knitsim::KnitGraphC::checkForIncrease(Node frontnext_node) {

  Node tmp;
  std::vector<Node> result;

  tmp.id = 0;
  // current stand: when new row has more nodes than prev, extra nodes always put last

  if (!frontnext_node.has_above_node) {
    result.push_back(frontnext_node);
    tmp = frontnext_node;
    while (tmp.id+1 < nodes.size()-1 && !getNode(tmp.id+1).start_of_row && getNode(tmp.id+1).position[1] - frontnext_node.position[1] < 1) {
      tmp = getNode(tmp.id+1);
      if(!tmp.has_above_node) result.push_back(tmp);
    }
  }

  return result;
}

std::vector<Eigen::Vector3f> knitsim::KnitGraphC::constructIncrease(Node node, std::vector<knitsim::Node>  front_nodes, float loop_width, bool is_round) {
  std::vector<Eigen::Vector3f> path;
  Eigen::Vector3f row_pos_mod, col_pos_mod;

  // determine knit/purl modifier
  int type_mod = 1;
  if(node.type == KnitNodeTypeC::PURL) {
    type_mod = -1;
  }

  for (auto front_node : front_nodes) {

    // std::cout << "front_node.id: " << front_node.id;
    col_pos_mod = front_node.knit_position - node.knit_position;
    col_pos_mod.normalize();

    // when changing sides, compensate for row_pos_mod discrepancy
    Eigen::Vector3f corrected_row_mod;
    Node frontprev_node = getNode(front_node.previous_node_id);
    Node frontnext_node;

    if (front_node.id < nodes.size()-1) {
      frontnext_node = getNode(front_node.id+1);

      if (frontnext_node.start_of_row) {
        corrected_row_mod = front_node.knit_position-frontprev_node.knit_position;
      } else if (front_node.start_of_row) { // if frontprev_node
        corrected_row_mod = frontnext_node.knit_position-front_node.knit_position;
      } else {
        corrected_row_mod = (front_node.knit_position - frontprev_node.knit_position);
      }
    }
    else {
      corrected_row_mod = front_node.knit_position - frontprev_node.knit_position;
    }

    // needs to be crossed, so reverse ROUND fix
    // ROUND mode never set, so FLAT condition would always trigger
    if(!is_round) {
      corrected_row_mod = corrected_row_mod * -1;
    }
    corrected_row_mod.normalize();

    // loop
    path.push_back(front_node.knit_position + corrected_row_mod*loop_width - col_pos_mod*0.1*loop_width + node.normal*0.1*type_mod);
    path.push_back(front_node.knit_position + corrected_row_mod*0.7*loop_width + col_pos_mod*0.1*loop_width - node.normal*0.1*type_mod);

    path.push_back(front_node.knit_position - corrected_row_mod*loop_width + col_pos_mod*0.1*loop_width - node.normal*0.1*type_mod);
    path.push_back(front_node.knit_position - corrected_row_mod*0.7*loop_width - col_pos_mod*0.1*loop_width  + node.normal*0.1*type_mod);


    // back to stitch base
    if(is_round) {
      path.push_back(node.knit_position + corrected_row_mod*loop_width);
    } else {
      path.push_back(node.knit_position - corrected_row_mod*loop_width);
    }
  }

  return path;
}

std::vector<Eigen::Vector3f> knitsim::KnitGraphC::getInstanceTransforms(Node node, bool is_round, float loop_width, uint32_t yo_fix) {
  std::vector<Eigen::Vector3f> transform_arr, aux_path;
  std::vector<Node> inc_nodes;
  Node prev_node, next_node, front_node, frontnext_node, frontprev_node;
  Eigen::Vector3f row_pos_mod, row_knit_pos, col_pos_mod, dist_vec, tmp;

  tmp = Eigen::Vector3f(0, 0, 0);

  if(node.id == 1) { // bug sets prev node of node 1 to -1 instead of 0, dirty fix
    prev_node = getNode(0);
  }
  else {
    prev_node = getNode(node.previous_node_id);
  }

  // no limit check needed, last row can only be bind off
  next_node = getNode(node.id+1);

  // determine horizontal mod
  if (node.start_of_row) {
    row_pos_mod = next_node.position-node.position;
  }
  else {
    row_pos_mod = next_node.position-prev_node.position;
  }

  bool found = false;
  bool yarn_over = false;
  if(nodes[node.id].target_node_id == 0) {
    // determine closest front node
    auto edges = edgesOf(node);
    int dist = INT_MAX;
    for (auto e : edges) {
      if(e.direction == KnitEdgeDirectionC::COLUMN && e.from == node.id) {

        dist_vec = node.knit_position - getNode(e.to).knit_position;
        if(dist > dist_vec.norm()) {
          dist = dist_vec.norm();

          if(e.to+yo_fix < nodes.size()-1) {
            if((getNode(e.to+yo_fix).position - node.knit_position).norm() < dist_vec.norm())
              front_node = getNode(e.to+yo_fix);
            else front_node = getNode(e.to);
          } else {
            if((getNode(nodes.size()-1).position - node.knit_position).norm() < dist_vec.norm())
              front_node = getNode(nodes.size()-1);
            else front_node = getNode(e.to);

          }

          if(front_node.yarn_over) { // check if yarn_over
            yarn_over = true;
          }
          nodes[node.id].target_node_id = front_node.id;
          found = true;
        }
      }
    }

    if(!found) {
      front_node = getDecreaseNode(node, is_round);
      nodes[node.id].target_node_id = front_node.id;
      // if(front_node.id+yo_fix < nodes.size()-1) {
      //   front_node = getNode(front_node.id+yo_fix);
      // } else getNode(nodes.size()-1);

      found = true;
    }

    if((yarn_over || front_node.yarn_over) && found) { // if front is yarn over, skip it and set frontnext node
      front_node = getNode(front_node.id+1);
      nodes[node.id].target_node_id = front_node.id;
    }

  } else {
    front_node = getNode(nodes[node.id].target_node_id);
    found = true;
  }

  if (found) {
    col_pos_mod = front_node.knit_position - node.knit_position;

    if(nodes[node.id].inc_node_ids.size() == 0) {

      if (front_node.id < nodes.size()-1) {
        frontnext_node = getNode(front_node.id+1);

        if(front_node.position[1] - frontnext_node.position[1] < 1 &&
          ((is_round && next_node.start_of_row) || (!is_round && node.start_of_row))) {

          inc_nodes = checkForIncrease(frontnext_node);

          if (inc_nodes.size() != 0)  {
            for (auto inc_node : inc_nodes) {
              nodes[node.id].inc_node_ids.push_back(inc_node.id);
            }
            aux_path = constructIncrease(node, inc_nodes, loop_width, is_round);
          } else {nodes[node.id].inc_node_ids.push_back(0);} // set as no increase for this node
        }
      }
    } else if(nodes[node.id].inc_node_ids[0] != 0) {
      for (auto inc_ids : nodes[node.id].inc_node_ids) {
        inc_nodes.push_back(getNode(inc_ids));
      }
      aux_path = constructIncrease(node, inc_nodes, loop_width, is_round);
    }

    node_map.at(front_node.id)->has_above_node = true;
  }



  row_knit_pos = next_node.knit_position-node.knit_position;

  transform_arr.push_back(node.knit_position);
  transform_arr.push_back(front_node.knit_position);
  transform_arr.push_back(row_pos_mod);
  transform_arr.push_back(col_pos_mod);
  transform_arr.push_back(row_knit_pos);

  // increase
  if(inc_nodes.size() > 0) {
    if(is_round) {
      transform_arr.push_back(node.knit_position + row_knit_pos*loop_width);
    } else {
      transform_arr.push_back(node.knit_position - row_knit_pos*loop_width);
    }
    transform_arr.insert(transform_arr.end(),aux_path.begin(),aux_path.end());
    // transform_arr.push_back(node.knit_position);
    if(is_round) {
      transform_arr.push_back(node.knit_position + row_knit_pos*loop_width);
      transform_arr.push_back(node.knit_position + row_knit_pos*loop_width);
    } else {
      transform_arr.push_back(node.knit_position - row_knit_pos*loop_width);
      transform_arr.push_back(node.knit_position - row_knit_pos*loop_width);
    }
  }

  return transform_arr;
}

std::vector<Eigen::Vector3f> knitsim::KnitGraphC::getExtendedKnits(Node node, bool is_round, float loop_width, uint32_t yo_fix) {
  std::vector<Eigen::Vector3f> path, aux_path;
  std::vector<Node> inc_nodes;
  Node prev_node, next_node, front_node, frontnext_node, frontprev_node;
  Eigen::Vector3f row_pos_mod, row_knit_pos, col_pos_mod, dist_vec, tmp;

  tmp = Eigen::Vector3f(0, 0, 0);

  if(node.id == 1) { // bug sets prev node of node 1 to -1 instead of 0, dirty fix
    prev_node = getNode(0);
  }
  else {
    prev_node = getNode(node.previous_node_id);
  }

  // no limit check needed, last row can only be bind off
  next_node = getNode(node.id+1);

  // determine knit/purl modifier
  int type_mod = 1;
  if(node.type == KnitNodeTypeC::PURL) {
    type_mod = -1;
  }

  // determine horizontal mod
  if (node.start_of_row) {
    row_pos_mod = next_node.position-node.position;
  } else if (next_node.start_of_row) {
    row_pos_mod = node.position-prev_node.position;
  }
  else {
    row_pos_mod = next_node.position-prev_node.position;
  }
  row_pos_mod.normalize();

  bool found = false;
  bool yarn_over = false;
  if(nodes[node.id].target_node_id == 0) {
    // determine closest front node
    auto edges = edgesOf(node);
    int dist = INT_MAX;
    for (auto e : edges) {
      if(e.direction == KnitEdgeDirectionC::COLUMN && e.from == node.id) {

        dist_vec = node.knit_position - getNode(e.to).knit_position;
        if(dist > dist_vec.norm()) {
          dist = dist_vec.norm();

          if(e.to+yo_fix < nodes.size()-1) {
            if((getNode(e.to+yo_fix).position - node.knit_position).norm() < dist_vec.norm())
              front_node = getNode(e.to+yo_fix);
            else front_node = getNode(e.to);
          } else {
            if((getNode(nodes.size()-1).position - node.knit_position).norm() < dist_vec.norm())
              front_node = getNode(nodes.size()-1);
            else front_node = getNode(e.to);

          }

          if(front_node.yarn_over) { // check if yarn_over
            yarn_over = true;
          }
          nodes[node.id].target_node_id = front_node.id;
          found = true;
        }
      }
    }

    if(!found) {
      front_node = getDecreaseNode(node, is_round);
      nodes[node.id].target_node_id = front_node.id;
      // if(front_node.id+yo_fix < nodes.size()-1) {
      //   front_node = getNode(front_node.id+yo_fix);
      // } else getNode(nodes.size()-1);

      found = true;
    }

    if((yarn_over || front_node.yarn_over) && found) { // if front is yarn over, skip it and set frontnext node
      front_node = getNode(front_node.id+1);
      nodes[node.id].target_node_id = front_node.id;
    }

  } else {
    front_node = getNode(nodes[node.id].target_node_id);
    found = true;
  }


  if (found) {
    col_pos_mod = front_node.knit_position - node.knit_position;

    if(nodes[node.id].inc_node_ids.size() == 0) {

      if (front_node.id < nodes.size()-1) {
        frontnext_node = getNode(front_node.id+1);

        if(front_node.position[1] - frontnext_node.position[1] < 1 &&
          ((is_round && next_node.start_of_row) || (!is_round && node.start_of_row))) {

          inc_nodes = checkForIncrease(frontnext_node);

          if (inc_nodes.size() != 0)  {
            for (auto inc_node : inc_nodes) {
              nodes[node.id].inc_node_ids.push_back(inc_node.id);
            }
            aux_path = constructIncrease(node, inc_nodes, loop_width, is_round);
          } else {nodes[node.id].inc_node_ids.push_back(0);} // set as no increase for this node
        }
      }
    } else if(nodes[node.id].inc_node_ids[0] != 0) {
      for (auto inc_ids : nodes[node.id].inc_node_ids) {
        inc_nodes.push_back(getNode(inc_ids));
      }
      aux_path = constructIncrease(node, inc_nodes, loop_width, is_round);
    }

    node_map.at(front_node.id)->has_above_node = true;
  }

  // construct extended version path

  Eigen::Vector3f corrected_row_mod;
  frontprev_node = getNode(front_node.previous_node_id);

  if (front_node.id < nodes.size()-1) {
    frontnext_node = getNode(front_node.id+1);

    if (frontnext_node.start_of_row) {
      corrected_row_mod = front_node.knit_position-frontprev_node.knit_position;
    } else if (front_node.start_of_row) { // if frontprev_node
      corrected_row_mod = frontnext_node.knit_position-front_node.knit_position;
    } else {
      corrected_row_mod = (frontnext_node.knit_position - frontprev_node.knit_position);
    }
  }
  else {
    corrected_row_mod = front_node.knit_position - frontprev_node.knit_position;
  }

  // if knitting in ROUND mode, node flow is consistant* --> make corrected_row_mod negative
  // *: in FLAT mode flow direction zig-zags, in ROUND mode it always flows in same direction
  // ROUND is never set(!), checking manually by comparing node normals (FLAT: all normals nearly identical, 0.1 error with increases)
  if(is_round) {
    corrected_row_mod = corrected_row_mod * -1;
  }
  corrected_row_mod.normalize();

  // connection to prev_node
  if(node.start_of_row) {
    path.push_back(node.knit_position - row_pos_mod*0.4*loop_width - (node.knit_position-prev_node.knit_position)*0.55);
  } else {
    path.push_back(node.knit_position - (node.knit_position-prev_node.knit_position)*0.55);
  }
  path.push_back(node.knit_position - row_pos_mod*0.6*loop_width);

  // add increase to main path if applicable
  if(inc_nodes.size() > 0 && !is_round) {
    path.insert(path.end(),aux_path.begin(),aux_path.end());
    path.push_back(node.knit_position + corrected_row_mod*0.3*loop_width - node.normal*0.1*type_mod);
    path.push_back(node.knit_position + corrected_row_mod*0.3*loop_width + node.normal*0.1*type_mod);
  }

  // loop path
  path.push_back(front_node.knit_position + corrected_row_mod*loop_width - col_pos_mod*0.1 + node.normal*0.1*type_mod);
  path.push_back(front_node.knit_position + corrected_row_mod*0.7*loop_width + col_pos_mod*0.1 + node.normal*0.1*(-type_mod));

  path.push_back(front_node.knit_position - corrected_row_mod*0.7*loop_width + col_pos_mod*0.1 + node.normal*0.1*(-type_mod));
  path.push_back(front_node.knit_position - corrected_row_mod*loop_width - col_pos_mod*0.1  + node.normal*0.1*type_mod);


  // add increase to main path if applicable
  if(inc_nodes.size() > 0 && is_round) {
    path.push_back(node.knit_position + corrected_row_mod*0.3*loop_width + node.normal*0.1*type_mod);
    path.push_back(node.knit_position + corrected_row_mod*0.3*loop_width - node.normal*0.1*type_mod);
    path.insert(path.end(),aux_path.begin(),aux_path.end());
  }

  // connection to next node
  if(next_node.start_of_row && !is_round) {
    path.push_back(node.knit_position + row_pos_mod*0.6*loop_width + node.normal*0.15*type_mod);
    path.push_back(node.knit_position + row_pos_mod*0.6*loop_width - node.normal*0.05*type_mod);
    path.push_back(node.knit_position + row_pos_mod*0.4*loop_width + (next_node.knit_position - node.knit_position)*0.55);
  }
  else {
    path.push_back(node.knit_position + row_pos_mod*0.6*loop_width);
    path.push_back(node.knit_position + (next_node.knit_position - node.knit_position)*0.55);
  }



  return path;
}