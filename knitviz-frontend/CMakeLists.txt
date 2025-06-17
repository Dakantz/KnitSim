cmake_minimum_required(VERSION 3.10.0)

set(CMAKE_BUILD_TYPE Release)
set(BUILD_TYPE "library")

project(knitsim-lib VERSION 0.0.1 DESCRIPTION "Knittin Simulation C++ library demo that compiles to WebAssembly")
set(CMAKE_CXX_FLAGS_DEBUG "-DLIB_LOG -DDEBUG")

if(LINUX AND APPLE)
  message(">>> MacOS detected")
  list(APPEND CMAKE_MODULE_PATH "$/cmake")
  include_directories(/opt/homebrew/include)
endif()

foreach(dir ${CMAKE_PREFIX_PATH})
  message(${dir})
endforeach()

find_package(Eigen3 3.4 REQUIRED CONFIG HINTS /opt/homebrew/Cellar/eigen/3.4.0_1/share/eigen3/cmake/)

include(cmake/wasm.cmake)
