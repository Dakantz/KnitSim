#include "knitsim/common.h"
#include "knitsim/graph/Graph.hpp"
#include "knitsim/graph/Helpers.hpp"
#include "knitsim/graph/Elements.hpp"
#include "knitsim/graph/enums.hpp"
#include "knitsim/KnitSim.hpp"
#include <vector>

#include <emscripten/bind.h>

using namespace emscripten;
using namespace knitsim;

// Useful for debugging, see https://emscripten.org/docs/porting/Debugging.html#handling-c-exceptions-from-javascript
std::string getExceptionMessage(intptr_t exceptionPtr)
{
    return std::string(reinterpret_cast<std::exception *>(exceptionPtr)->what());
}

EMSCRIPTEN_BINDINGS(wasm_module)
{
    emscripten::function("getExceptionMessage", &getExceptionMessage);

    // function("getTotal", &Order::calculateTotal);
    // function("printEnum", &Order::printEnum);

    value_object<Node>("NodeC")
        .field("id", &Node::id)
        .field("line_number", &Node::line_number)
        .field("row_number", &Node::row_number)
        .field("col_number", &Node::col_number)
        .field("start_of_row", &Node::start_of_row)
        .field("type", &Node::type)
        .field("mode", &Node::mode)
        .field("side", &Node::side)
        .field("previous_node", &Node::previous_node_id)
        .field("position", &Node::position)
        .field("normal", &Node::normal)
        .field("next_dir", &Node::next_dir);
    value_object<Edge>("Edge")
        .field("id", &Edge::id)
        .field("from", &Edge::from)
        .field("to", &Edge::to)
        .field("direction", &Edge::direction);

    register_vector<Node>("NodeVector");
    register_vector<Edge>("EdgeVector");

    register_optional<Node>();
    register_optional<Edge>();
    register_optional<KnitEdgeDirectionC>();

    enum_<KnitNodeTypeC>("KnitNodeTypeC")
        .value("KnitNodeTypeC_PURL", KnitNodeTypeC::PURL)
        .value("KnitNodeTypeC_KNIT", KnitNodeTypeC::KNIT)
        .value("KnitNodeTypeC_SLIP", KnitNodeTypeC::SLIP)
        .value("KnitNodeTypeC_YARN_OVER", KnitNodeTypeC::YARN_OVER)
        .value("KnitNodeTypeC_INCREASE", KnitNodeTypeC::INCREASE)
        .value("KnitNodeTypeC_DECREASE", KnitNodeTypeC::DECREASE)
        .value("KnitNodeTypeC_BIND_OFF", KnitNodeTypeC::BIND_OFF)
        .value("KnitNodeTypeC_CAST_ON", KnitNodeTypeC::CAST_ON);
    enum_<KnitModeC>("KnitModeC")
        .value("KnitModeC_ROUND", KnitModeC::ROUND)
        .value("KnitModeC_FLAT", KnitModeC::FLAT);
    enum_<KnitEdgeDirectionC>("KnitEdgeDirectionC")
        .value("KnitEdgeDirectionC_ROW", KnitEdgeDirectionC::ROW)
        .value("KnitEdgeDirectionC_COLUMN", KnitEdgeDirectionC::COLUMN)
        .value("KnitEdgeDirectionC_BOTH", KnitEdgeDirectionC::BOTH)
        .value("KnitEdgeDirectionC_STITCH", KnitEdgeDirectionC::STITCH)
        .value("KnitEdgeDirectionC_START", KnitEdgeDirectionC::START);
    enum_<KnitSideC>("KnitSideC")
        .value("KnitSideC_RIGHT", KnitSideC::RIGHT)
        .value("KnitSideC_WRONG", KnitSideC::WRONG);

    class_<Eigen::Vector3f>("Vector3f")
        .constructor<float, float, float>()
        .constructor<>()
        .property("x", optional_override([](const Eigen::Vector3f &self)
                                         { return self.x(); }))
        .property("y", optional_override([](const Eigen::Vector3f &self)
                                         { return self.y(); }))
        .property("z", optional_override([](const Eigen::Vector3f &self)
                                         { return self.z(); }));
    class_<YarnSpecC>("YarnSpecC")
        .constructor<int, int>()
        .property("color", &YarnSpecC::color)
        .property("weight", &YarnSpecC::weight);

    class_<GraphConfig>("GraphConfig")
        .constructor<>()
        .constructor<float, float, float, float, float, float, Eigen::Vector3f, Eigen::Vector3f>()
        .property("step_size_x", &GraphConfig::step_size_x)
        .property("step_size_y", &GraphConfig::step_size_y)
        .property("offset_bidirectional", &GraphConfig::offset_bidirectional)
        .property("offset_purl", &GraphConfig::offset_purl)
        .property("offset_knit", &GraphConfig::offset_knit)
        .property("yarn_thickness", &GraphConfig::yarn_thickness)
        .property("up_vector", &GraphConfig::up_vector)
        .property("right_vector", &GraphConfig::right_vector);

    class_<TraversalResult>("TraversalResult")
        .constructor<std::vector<Node>, std::vector<Edge>>()
        .property("nodes", &TraversalResult::nodes)
        .property("edges", &TraversalResult::edges);

    class_<TraversalInstruction>("TraversalInstruction")
        .constructor<KnitEdgeDirectionC, bool>()
        .property("in", &TraversalInstruction::in)
        .property("direction", &TraversalInstruction::direction);

    class_<RowResult>("RowResult")
        .constructor<std::vector<Node>, bool>()
        .property("nodes", &RowResult::nodes)
        .property("closed", &RowResult::closed);

    class_<KnitGraphC>("KnitGraphC")
        .constructor<GraphConfig &, std::vector<Node> &, std::vector<Edge> &>()
        .function("setConfig", &KnitGraphC::setConfig)
        .function("setNodes", &KnitGraphC::setNodes)
        .function("setEdges", &KnitGraphC::setEdges)
        .function("getNodes", &KnitGraphC::getNodes)
        .function("getEdges", &KnitGraphC::getEdges)
        .function("getNode", &KnitGraphC::getNode)
        .function("getFromNodes", &KnitGraphC::getFromNodes)
        .function("getToNodes", &KnitGraphC::getToNodes)
        .function("edgesOf", &KnitGraphC::edgesOf)
        .function("computeHeuristicLayout", &KnitGraphC::computeHeuristicLayout)
        .function("row", &KnitGraphC::row);

    value_object<KnitSimConfig>("KnitSimConfig")
        .field("offset_scaler", &KnitSimConfig::offset_scaler)
        .field("f_flattening_factor", &KnitSimConfig::f_flattening_factor)
        .field("f_expansion_factor", &KnitSimConfig::f_expansion_factor);

    class_<KnitSim>("KnitSim")
        .constructor<KnitGraphC &, KnitSimConfig>()
        .function("initialize", &KnitSim::initialize)
        .function("step", &KnitSim::step);
}