
export CPPFLAGS="-I/opt/homebrew/include"
export Eigen3_DIR="/opt/homebrew/Cellar/eigen/3.4.0_1/share/eigen3/cmake/"

emcmake cmake . -B dist -DEigen3_DIR=$Eigen3_DIR
emmake make -C ./dist/
cp dist/knitsim-lib.js src/knitgraph/sim   
cp dist/knitsim-lib.d.ts src/knitgraph/sim