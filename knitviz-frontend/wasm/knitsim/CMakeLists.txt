add_library(
    knitsim  ${CMAKE_CURRENT_SOURCE_DIR}/KnitSim.cpp
)

target_include_directories(knitsim PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
add_subdirectory(graph)