message(STATUS "Compiling WASM module...")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_FLAGS "-Wall -Wextra")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g")
set(CMAKE_CXX_FLAGS_RELEASE "-O3")
add_definitions(-DTEST)

set(EXECUTABLE_NAME ${PROJECT_NAME})
set(EXECUTABLE_SOURCE wasm/wasm.cpp)

add_executable(${EXECUTABLE_NAME} ${EXECUTABLE_SOURCE})
add_subdirectory(wasm/knitsim)


target_include_directories(${EXECUTABLE_NAME} PRIVATE .)
target_link_libraries (${EXECUTABLE_NAME} Eigen3::Eigen)

target_link_libraries(${EXECUTABLE_NAME}  knitsim graph)

set_target_properties(${EXECUTABLE_NAME} PROPERTIES LINK_FLAGS "-sENVIRONMENT=web -s SINGLE_FILE=1 -s MODULARIZE -s EXPORT_NAME=KnitSimLib -s VERBOSE=1 --bind --emit-tsd 'knitsim-lib.d.ts'")
target_link_options(${EXECUTABLE_NAME} PRIVATE
   # or wherever else you want it to go
)
# target_link_options(${EXECUTABLE_NAME} PRIVATE
#    # or wherever else you want it to go
# )