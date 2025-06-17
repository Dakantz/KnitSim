# export CPPFLAGS="-I/opt/homebrew/include"
# export LDFLAGS="-L/opt/homebrew/lib \
#   -fsanitize=address \
#   -g2"
# export CXXFLAGS="-I/opt/homebrew/include \
#   -fsanitize=address \
#   -g2"
set -e
export Eigen3_DIR="/usr/share/eigen3/cmake/"
export EMPATH="/home/$(whoami)/Downloads/Software/emsdk/upstream/emscripten"

$EMPATH/emcmake cmake . -B dist -DEigen3_DIR=$Eigen3_DIR
$EMPATH/emmake make -C ./dist/
cp dist/knitsim-lib.js src/knitgraph/sim
cp dist/knitsim-lib.d.ts src/knitgraph/sim
