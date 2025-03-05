add_library(
    graph Graph.cpp
)

target_link_libraries (graph Eigen3::Eigen)
target_include_directories(graph PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})