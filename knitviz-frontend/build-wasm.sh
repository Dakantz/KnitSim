#!/bin/bash
# set -e

# export CPPFLAGS="-I/opt/homebrew/include"
# export LDFLAGS="-L/opt/homebrew/lib \
#   -fsanitize=address \
#   -g2"
# export CXXFLAGS="-I/opt/homebrew/include \
#   -fsanitize=address \
#   -g2"
if [ -z "$Eigen3_DIR" ]; then
  echo "Eigen3_DIR not set, using default path"
  export Eigen3_DIR="/usr/share/eigen3/cmake/" 
fi
if ! type "emcmake" >/dev/null; then
  echo "emcmake not in path, trying to source emsdk"
  source "/home/$(whoami)/Downloads/Software/emsdk/emsdk_env.sh"
fi

emcmake cmake . -B dist -DEigen3_DIR=$Eigen3_DIR
emmake make -C ./dist/
cp dist/knitsim-lib.js src/knitgraph/sim
cp dist/knitsim-lib.d.ts src/knitgraph/sim
